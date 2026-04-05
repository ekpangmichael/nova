import {
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import type {
  CreateRuntimeAutomationInput,
  ProvisionRuntimeAgentInput,
  ProvisionRuntimeAgentResult,
  ProjectSeed,
  RuntimeAdapter,
  RuntimeAgentCatalogItem,
  RuntimeAutomation,
  RuntimeAutomationRun,
  RuntimeCapabilities,
  RuntimeCatalog,
  RuntimeEvent,
  RuntimeRunInput,
  RuntimeSessionHistoryMessage,
  RuntimeSummary,
  StartRunInput,
  StartRunResult,
  SyncRuntimeWorkspaceInput,
  SyncRuntimeWorkspaceResult,
  UpdateRuntimeAutomationInput,
} from "@nova/runtime-adapter";
import type { JsonValue } from "@nova/shared";
import type { AppEnv } from "../../env.js";
import { conflict, serviceUnavailable } from "../../lib/errors.js";
import { resolveProjectPath } from "../../lib/paths.js";
import { toCodexReasoningEffort } from "../../lib/runtime-thinking.js";
import { nowIso } from "../../lib/utils.js";
import { CodexProcessManager } from "./CodexProcessManager.js";

type Listener = (event: RuntimeEvent) => Promise<void> | void;

type CodexItemPayload =
  | {
      id?: string;
      type?: string;
      text?: string;
    }
  | {
      id?: string;
      type?: string;
      changes?: Array<{
        path?: string;
        kind?: string;
      }>;
      status?: string;
    };

type CodexJsonLine =
  | {
      type: "thread.started";
      thread_id?: string;
    }
  | {
      type: "turn.started";
    }
  | {
      type: "turn.completed";
      usage?: Record<string, JsonValue>;
    }
  | {
      type: "item.started" | "item.completed";
      item?: CodexItemPayload;
    }
  | {
      type: string;
      [key: string]: unknown;
    };

type CodexSessionState = {
  runtimeSessionKey: string;
  cwd: string;
  runtimeRunId: string | null;
  currentProcess: ChildProcessWithoutNullStreams | null;
  bufferedEvents: RuntimeEvent[];
  listeners: Set<Listener>;
  currentTurnCompleted: boolean;
  stopRequested: boolean;
  stderrTail: string[];
  history: RuntimeSessionHistoryMessage[];
  sessionFilePath: string | null;
  lastAssistantMessage: string | null;
  lastAssistantMessageId: string | null;
};

const THREAD_ID_TIMEOUT_MS = 10_000;
const STOP_KILL_TIMEOUT_MS = 5_000;
const MAX_STDERR_LINES = 12;
const SHELL_SNAPSHOT_WARNING = "shell_snapshot";
const CODEX_SUPPORTED_MODELS = [
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
  "gpt-5.2-codex",
  "gpt-5.2",
  "gpt-5.1-codex",
  "gpt-5.1-codex-max",
  "gpt-5.1-codex-mini",
] as const;

function formatCodexModelName(modelId: string) {
  return modelId
    .split("-")
    .map((part) => {
      if (/^gpt$/i.test(part)) {
        return "GPT";
      }

      if (/^codex$/i.test(part)) {
        return "Codex";
      }

      if (/^mini$/i.test(part)) {
        return "Mini";
      }

      if (/^max$/i.test(part)) {
        return "Max";
      }

      return part.replace(/^\d/, (digit) => digit);
    })
    .join("-");
}

function isFileChangeItem(
  item: unknown
): item is Extract<CodexItemPayload, { changes?: Array<{ path?: string; kind?: string }> }> & {
  type: "file_change";
} {
  return (
    !!item &&
    typeof item === "object" &&
    "type" in item &&
    item.type === "file_change"
  );
}

function isAgentMessageItem(
  item: unknown
): item is Extract<CodexItemPayload, { text?: string }> & { type: "agent_message"; text: string } {
  return (
    !!item &&
    typeof item === "object" &&
    "type" in item &&
    item.type === "agent_message" &&
    "text" in item &&
    typeof item.text === "string"
  );
}

export class CodexRuntimeAdapter implements RuntimeAdapter {
  kind = "codex" as const;

  #env: AppEnv;
  #processManager: CodexProcessManager;
  #sessions = new Map<string, CodexSessionState>();
  #sessionFileCache = new Map<string, string | null>();

  constructor(env: AppEnv, processManager: CodexProcessManager) {
    this.#env = env;
    this.#processManager = processManager;
  }

  async getCapabilities(): Promise<RuntimeCapabilities> {
    return {
      kind: this.kind,
      executionTargetMode: "runtime-cwd",
      supportsStreaming: true,
      supportsStop: true,
      supportsRetry: true,
      supportsPause: false,
      supportsResume: false,
      supportsAutomations: false,
      supportsUsageMetrics: true,
    };
  }

  async getHealth() {
    return this.#processManager.getHealth();
  }

  async getSummary(): Promise<RuntimeSummary> {
    const [health, capabilities] = await Promise.all([
      this.getHealth(),
      this.getCapabilities(),
    ]);

    return {
      providerKey: "codex",
      kind: this.kind,
      label: "Codex",
      available: health.status !== "missing_binary",
      health,
      capabilities,
    };
  }

  async getCatalog(): Promise<RuntimeCatalog> {
    const [summary, login] = await Promise.all([
      this.getSummary(),
      this.#processManager.getLoginSummary(),
    ]);
    const detected = this.#processManager.getDetectedConfig();
    const modelIds = Array.from(
      new Set([
        ...(detected.defaultModel ? [detected.defaultModel] : []),
        ...CODEX_SUPPORTED_MODELS,
      ])
    );

    return {
      providerKey: summary.providerKey,
      kind: summary.kind,
      label: summary.label,
      available: summary.available,
      health: summary.health,
      capabilities: summary.capabilities,
      configPath: detected.configPath,
      stateDir: detected.stateDir,
      gateway: {
        reachable: false,
        url: null,
        bindMode: null,
        bindHost: null,
        port: null,
        authMode: login.authMode,
      },
      defaults: {
        defaultAgentId: null,
        defaultModelId: detected.defaultModel,
        workspacePathTemplate: `${this.#env.agentHomesDir}/<agentId>`,
        runtimeStatePathTemplate: `${detected.stateDir}/nova-agents/<agentId>`,
      },
      models: modelIds.map((id) => ({
        id,
        name: formatCodexModelName(id),
        available: true,
        local: false,
        input: "text",
        contextWindow: null,
        tags: id === detected.defaultModel ? ["configured"] : [],
      })),
      existingAgents: [],
    };
  }

  async listRuntimeAgents(): Promise<RuntimeAgentCatalogItem[]> {
    return [];
  }

  async ensureRuntimeReady(): Promise<void> {
    const health = await this.getHealth();

    if (health.status === "missing_binary") {
      throw serviceUnavailable("Codex CLI is not available.");
    }

    if (health.status !== "healthy") {
      throw serviceUnavailable("Codex is not signed in yet.");
    }
  }

  async provisionAgent(
    input: ProvisionRuntimeAgentInput
  ): Promise<ProvisionRuntimeAgentResult> {
    await this.ensureRuntimeReady();
    await this.ensureAgentWorkspace(
      input.runtimeAgentId,
      input.workspacePath,
      input.runtimeStatePath
    );

    return {
      runtimeAgentId: input.runtimeAgentId,
      workspacePath: input.workspacePath,
      runtimeStatePath: input.runtimeStatePath,
      defaultModelId: input.defaultModelId ?? null,
    };
  }

  async deleteAgent(_runtimeAgentId: string): Promise<void> {
    return;
  }

  async ensureAgentWorkspace(
    _agentId: string,
    workspacePath: string,
    runtimeStatePath: string
  ): Promise<void> {
    await mkdir(workspacePath, { recursive: true });
    await mkdir(runtimeStatePath, { recursive: true });
    await mkdir(`${workspacePath}/.apm`, { recursive: true });
  }

  async syncAgentWorkspace(
    input: SyncRuntimeWorkspaceInput
  ): Promise<SyncRuntimeWorkspaceResult> {
    await this.ensureAgentWorkspace(
      input.runtimeAgentId,
      input.workspacePath,
      input.runtimeStatePath
    );

    for (const file of input.files) {
      const absolutePath = `${input.workspacePath}/${file.relativePath}`;
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, file.content, "utf8");
    }

    return {
      files: input.files.map((file) => file.relativePath),
      syncedAt: nowIso(),
    };
  }

  async ensureProjectRoot(
    _agentId: string,
    workspacePath: string,
    projectRoot: string,
    _seed?: ProjectSeed | null
  ): Promise<void> {
    const fullPath = resolveProjectPath(workspacePath, projectRoot).absolutePath;
    await mkdir(fullPath, { recursive: true });
  }

  async startRun(input: StartRunInput): Promise<StartRunResult> {
    await this.ensureRuntimeReady();

    const cwd = resolveProjectPath(
      input.agentHomePath,
      input.executionTarget
    ).absolutePath;
    const existingThreadId = this.#normalizeThreadId(
      input.previousRuntimeSessionKey
    );
    const { threadId, startedAt } = await this.#startTurn({
      runId: input.runId,
      cwd,
      prompt: input.prompt,
      existingThreadId,
      modelOverride: input.modelOverride ?? null,
      thinkingLevel: input.thinkingLevel ?? null,
      sandboxMode:
        !input.previousRuntimeSessionKey && input.sandboxMode === "off"
          ? "off"
          : !input.previousRuntimeSessionKey
            ? "workspace"
            : null,
    });

    return {
      runtimeSessionKey: threadId,
      runtimeRunId: input.runId,
      startedAt,
    };
  }

  async stopRun(runtimeSessionKey: string): Promise<void> {
    const state = this.#sessions.get(runtimeSessionKey);

    if (!state?.currentProcess) {
      return;
    }

    state.stopRequested = true;
    const child = state.currentProcess;
    child.kill("SIGINT");

    const forceKill = setTimeout(() => {
      if (state.currentProcess === child) {
        child.kill("SIGKILL");
      }
    }, STOP_KILL_TIMEOUT_MS);

    child.once("close", () => {
      clearTimeout(forceKill);
    });
  }

  async sendRunInput(
    runtimeSessionKey: string,
    input: RuntimeRunInput
  ): Promise<{ runtimeRunId: string | null; startedAt: string }> {
    await this.ensureRuntimeReady();

    const state = this.#sessions.get(runtimeSessionKey);

    if (!state) {
      throw conflict("Codex session is not available anymore.");
    }

    if (state.currentProcess) {
      throw conflict("Codex is still processing the current turn.");
    }

    const { startedAt } = await this.#startTurn({
      runId: state.runtimeRunId ?? input.idempotencyKey ?? null,
      cwd: state.cwd,
      prompt: input.text,
      existingThreadId: runtimeSessionKey,
      modelOverride: null,
      thinkingLevel: input.thinkingLevel ?? null,
      sandboxMode: null,
      resetBufferedEvents: false,
    });

    return {
      runtimeRunId: state.runtimeRunId,
      startedAt,
    };
  }

  async loadSessionHistory(
    runtimeSessionKey: string,
    after = 0
  ): Promise<RuntimeSessionHistoryMessage[]> {
    const state = this.#sessions.get(runtimeSessionKey);

    if (state?.history.length) {
      return state.history.filter(
        (message) => ((message.seq ?? 0) > after || after <= 0)
      );
    }

    const sessionFilePath = await this.#resolveSessionFilePath(runtimeSessionKey);

    if (!sessionFilePath) {
      return [];
    }

    const messages = await this.#readMessagesFromSessionFile(sessionFilePath);
    const persistedState = state ?? this.#createSessionState(runtimeSessionKey, "");
    persistedState.sessionFilePath = sessionFilePath;
    persistedState.history = messages;

    return messages.filter(
      (message) => ((message.seq ?? 0) > after || after <= 0)
    );
  }

  async subscribeRun(
    runtimeSessionKey: string,
    onEvent: (event: RuntimeEvent) => Promise<void> | void
  ): Promise<() => Promise<void>> {
    const state = this.#sessions.get(runtimeSessionKey);

    if (!state) {
      return async () => {};
    }

    state.listeners.add(onEvent);

    for (const event of state.bufferedEvents) {
      await onEvent(event);
    }

    return async () => {
      state.listeners.delete(onEvent);
    };
  }

  async listAutomations(_agentId?: string): Promise<RuntimeAutomation[]> {
    return [];
  }

  async createAutomation(
    _input: CreateRuntimeAutomationInput
  ): Promise<RuntimeAutomation> {
    throw serviceUnavailable("Codex automations are not implemented yet.");
  }

  async updateAutomation(
    _id: string,
    _patch: UpdateRuntimeAutomationInput
  ): Promise<RuntimeAutomation> {
    throw serviceUnavailable("Codex automations are not implemented yet.");
  }

  async deleteAutomation(_id: string): Promise<void> {
    throw serviceUnavailable("Codex automations are not implemented yet.");
  }

  async runAutomationNow(
    _id: string
  ): Promise<{ runtimeRunId?: string | null }> {
    throw serviceUnavailable("Codex automations are not implemented yet.");
  }

  async getAutomationRuns(_id: string): Promise<RuntimeAutomationRun[]> {
    return [];
  }

  async #startTurn(input: {
    runId: string | null;
    cwd: string;
    prompt: string;
    existingThreadId: string | null;
    modelOverride: string | null;
    thinkingLevel: StartRunInput["thinkingLevel"];
    sandboxMode: "workspace" | "off" | null;
    resetBufferedEvents?: boolean;
  }) {
    const startedAt = nowIso();
    const state =
      input.existingThreadId && this.#sessions.has(input.existingThreadId)
        ? this.#sessions.get(input.existingThreadId)!
        : null;

    if (state?.currentProcess) {
      throw conflict("Codex is already processing this task.");
    }

    const args = this.#buildExecArgs({
      existingThreadId: input.existingThreadId,
      cwd: input.cwd,
      modelOverride: input.modelOverride,
      thinkingLevel: input.thinkingLevel ?? null,
      sandboxMode: input.sandboxMode,
    });
    const child = spawn(this.#env.codexBinaryPath, args, {
      cwd: input.cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.end(input.prompt, "utf8");

    let resolvedThreadId: string | null = input.existingThreadId;
    let currentState =
      resolvedThreadId && this.#sessions.has(resolvedThreadId)
        ? this.#sessions.get(resolvedThreadId)!
        : null;
    let startResolved = false;
    let terminalEventSeen = false;
    const stderrTail: string[] = [];
    let resolveStart!: (value: string) => void;
    let rejectStart!: (reason?: unknown) => void;
    const startPromise = new Promise<string>((resolve, reject) => {
      resolveStart = resolve;
      rejectStart = reject;
    });

    const stdoutReader = createInterface({ input: child.stdout });
    const stderrReader = createInterface({ input: child.stderr });
    let stdoutQueue = Promise.resolve();

    const bindState = async (threadId: string) => {
      const existingStateForThread =
        resolvedThreadId === threadId ? currentState : null;
      resolvedThreadId = threadId;
      currentState =
        existingStateForThread
          ? existingStateForThread
          : this.#getOrCreateSessionState(threadId, input.cwd);
      this.#resetStateForNewTurn(currentState, {
        runId: input.runId,
        cwd: input.cwd,
        resetBufferedEvents: input.resetBufferedEvents ?? true,
      });
      currentState.currentProcess = child;
      currentState.stderrTail = stderrTail;
      currentState.sessionFilePath =
        currentState.sessionFilePath ??
        (await this.#resolveSessionFilePath(threadId));
      this.#appendHistoryMessage(currentState, {
        role: "user",
        text: input.prompt,
        timestamp: startedAt,
      });

      if (!startResolved) {
        startResolved = true;
        await this.#emit(threadId, {
          type: "run.accepted",
          at: startedAt,
          data: {
            runtimeRunId: input.runId,
            threadId,
          },
        });
        resolveStart(threadId);
      }

      return currentState;
    };

    stdoutReader.on("line", (line) => {
      stdoutQueue = stdoutQueue
        .then(async () => {
        const parsed = this.#parseJsonLine(line);

        if (!parsed) {
          return;
        }

        if (parsed.type === "thread.started" && typeof parsed.thread_id === "string") {
          await bindState(parsed.thread_id);
          return;
        }

        if (!currentState) {
          return;
        }

        const eventAt = nowIso();

        if (parsed.type === "turn.started") {
          await this.#emit(currentState.runtimeSessionKey, {
            type: "run.started",
            at: eventAt,
            data: {
              runtimeRunId: currentState.runtimeRunId,
            },
          });
          return;
        }

        if (
          (parsed.type === "item.started" || parsed.type === "item.completed") &&
          isFileChangeItem(parsed.item)
        ) {
          if (parsed.type === "item.started") {
            await this.#emit(currentState.runtimeSessionKey, {
              type: "tool.started",
              at: eventAt,
              data: {
                runtimeRunId: currentState.runtimeRunId,
                toolName: "file_change",
                raw: parsed.item as unknown as JsonValue,
              },
            });
            return;
          }

          const changes = Array.isArray(parsed.item.changes) ? parsed.item.changes : [];

          await this.#emit(currentState.runtimeSessionKey, {
            type: "tool.completed",
            at: eventAt,
            data: {
              runtimeRunId: currentState.runtimeRunId,
              toolName: "file_change",
              raw: parsed.item as unknown as JsonValue,
            },
          });

          for (const change of changes) {
            await this.#emit(currentState.runtimeSessionKey, {
              type: "artifact.created",
              at: eventAt,
              data: {
                runtimeRunId: currentState.runtimeRunId,
                path:
                  typeof change.path === "string" ? change.path : currentState.cwd,
                kind:
                  typeof change.kind === "string" ? change.kind : "modified",
                label: null,
                summary: "Codex changed a workspace file.",
              },
            });
          }
          return;
        }

        if (parsed.type === "item.completed" && isAgentMessageItem(parsed.item)) {
          const text = parsed.item.text.trim();

          if (!text) {
            return;
          }

          currentState.lastAssistantMessage = text;
          currentState.lastAssistantMessageId =
            typeof parsed.item.id === "string" ? parsed.item.id : null;
          this.#appendHistoryMessage(currentState, {
            role: "assistant",
            text,
            id:
              typeof parsed.item.id === "string" ? parsed.item.id : null,
            timestamp: eventAt,
          });

          await this.#emit(currentState.runtimeSessionKey, {
            type: "message.completed",
            at: eventAt,
            data: {
              runtimeRunId: currentState.runtimeRunId,
              message: text,
              externalMessageId:
                typeof parsed.item.id === "string" ? parsed.item.id : null,
            },
          });
          return;
        }

        if (parsed.type === "turn.completed") {
          currentState.currentTurnCompleted = true;
          terminalEventSeen = true;

          if (parsed.usage && Object.keys(parsed.usage).length > 0) {
            await this.#emit(currentState.runtimeSessionKey, {
              type: "usage",
              at: eventAt,
              data: parsed.usage as Record<string, JsonValue>,
            });
          }

          await this.#emit(currentState.runtimeSessionKey, {
            type: "run.completed",
            at: eventAt,
            data: {
              runtimeRunId: currentState.runtimeRunId,
              finalSummary:
                currentState.lastAssistantMessage ?? "Codex completed the task.",
            },
          });
        }
      })
        .catch((error) => {
          if (!startResolved) {
            rejectStart(error);
          }
        });
    });

    stderrReader.on("line", (line) => {
      const normalized = line.trim();

      if (!normalized || normalized.toLowerCase().includes(SHELL_SNAPSHOT_WARNING)) {
        return;
      }

      stderrTail.push(normalized);
      if (stderrTail.length > MAX_STDERR_LINES) {
        stderrTail.shift();
      }
    });

    child.once("error", (error) => {
      if (!startResolved) {
        rejectStart(error);
      }
    });

    child.once("close", (code, signal) => {
      void (async () => {
        await stdoutQueue;

        if (currentState && currentState.currentProcess === child) {
          currentState.currentProcess = null;
        }

        if (!startResolved) {
          const failure = stderrTail.join(" ").trim();
          rejectStart(
            new Error(failure || "Codex exited before a thread was created.")
          );
          return;
        }

        if (!currentState || terminalEventSeen) {
          return;
        }

        const eventAt = nowIso();

        if (currentState.stopRequested) {
          terminalEventSeen = true;
          await this.#emit(currentState.runtimeSessionKey, {
            type: "run.aborted",
            at: eventAt,
            data: {
              runtimeRunId: currentState.runtimeRunId,
              reason: "Stopped by operator.",
            },
          });
          return;
        }

        if (code === 0) {
          terminalEventSeen = true;
          await this.#emit(currentState.runtimeSessionKey, {
            type: "run.completed",
            at: eventAt,
            data: {
              runtimeRunId: currentState.runtimeRunId,
              finalSummary:
                currentState.lastAssistantMessage ?? "Codex completed the task.",
            },
          });
          return;
        }

        terminalEventSeen = true;
        await this.#emit(currentState.runtimeSessionKey, {
          type: "run.failed",
          at: eventAt,
          data: {
            runtimeRunId: currentState.runtimeRunId,
            reason: this.#buildProcessFailureMessage(stderrTail, code, signal),
          },
        });
      })().catch(() => {
        return;
      });
    });

    try {
      const threadId = await Promise.race([
        startPromise,
        new Promise<string>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error("Timed out while waiting for Codex to start a thread.")
            );
          }, THREAD_ID_TIMEOUT_MS);
        }),
      ]);

      return { threadId, startedAt };
    } catch (error) {
      child.kill("SIGKILL");
      throw error;
    }
  }

  #buildExecArgs(input: {
    existingThreadId: string | null;
    cwd: string;
    modelOverride: string | null;
    thinkingLevel: StartRunInput["thinkingLevel"];
    sandboxMode: "workspace" | "off" | null;
  }) {
    const args = ["exec"];

    if (input.existingThreadId) {
      args.push("resume", input.existingThreadId);
    }

    args.push("--json", "--skip-git-repo-check");

    if (!input.existingThreadId) {
      args.push("--cd", input.cwd);
    }

    if (input.modelOverride?.trim()) {
      args.push("--model", input.modelOverride.trim());
    }

    const reasoningEffort = toCodexReasoningEffort(input.thinkingLevel);

    if (reasoningEffort) {
      args.push(
        "--config",
        `model_reasoning_effort=${JSON.stringify(reasoningEffort)}`
      );
    }

    if (!input.existingThreadId && input.sandboxMode === "workspace") {
      args.push("--sandbox", "workspace-write");
    } else if (input.sandboxMode === "off") {
      args.push("--dangerously-bypass-approvals-and-sandbox");
    }

    args.push("-");
    return args;
  }

  #getOrCreateSessionState(runtimeSessionKey: string, cwd: string) {
    const existing = this.#sessions.get(runtimeSessionKey);

    if (existing) {
      if (cwd) {
        existing.cwd = cwd;
      }
      return existing;
    }

    return this.#createSessionState(runtimeSessionKey, cwd);
  }

  #createSessionState(runtimeSessionKey: string, cwd: string) {
    const created: CodexSessionState = {
      runtimeSessionKey,
      cwd,
      runtimeRunId: null,
      currentProcess: null,
      bufferedEvents: [],
      listeners: new Set(),
      currentTurnCompleted: false,
      stopRequested: false,
      stderrTail: [],
      history: [],
      sessionFilePath: null,
      lastAssistantMessage: null,
      lastAssistantMessageId: null,
    };
    this.#sessions.set(runtimeSessionKey, created);
    return created;
  }

  #resetStateForNewTurn(
    state: CodexSessionState,
    input: {
      runId: string | null;
      cwd: string;
      resetBufferedEvents: boolean;
    }
  ) {
    state.cwd = input.cwd;
    state.runtimeRunId = input.runId;
    state.currentProcess = null;
    state.currentTurnCompleted = false;
    state.stopRequested = false;
    state.stderrTail = [];
    state.lastAssistantMessage = null;
    state.lastAssistantMessageId = null;

    if (input.resetBufferedEvents) {
      state.bufferedEvents = [];
    }
  }

  async #emit(runtimeSessionKey: string, event: RuntimeEvent) {
    const state = this.#sessions.get(runtimeSessionKey);

    if (!state) {
      return;
    }

    state.bufferedEvents.push(event);

    for (const listener of state.listeners) {
      await Promise.resolve(listener(event));
    }
  }

  #appendHistoryMessage(
    state: CodexSessionState,
    input: {
      role: RuntimeSessionHistoryMessage["role"];
      text: string;
      id?: string | null;
      timestamp?: string | null;
    }
  ) {
    const text = input.text.trim();

    if (!text) {
      return;
    }

    const nextSeq = (state.history.at(-1)?.seq ?? 0) + 1;
    state.history.push({
      id: input.id ?? null,
      seq: nextSeq,
      role: input.role,
      text,
      timestamp: input.timestamp ?? null,
    });
  }

  #parseJsonLine(line: string): CodexJsonLine | null {
    const candidate = line.trim();

    if (!candidate.startsWith("{")) {
      return null;
    }

    try {
      return JSON.parse(candidate) as CodexJsonLine;
    } catch {
      return null;
    }
  }

  #buildProcessFailureMessage(
    stderrTail: string[],
    code: number | null,
    signal: NodeJS.Signals | null
  ) {
    const stderr = stderrTail.join(" ").trim();

    if (stderr) {
      return stderr;
    }

    if (signal) {
      return `Codex exited due to signal ${signal}.`;
    }

    if (typeof code === "number") {
      return `Codex exited with code ${code}.`;
    }

    return "Codex exited unexpectedly.";
  }

  #normalizeThreadId(value?: string | null) {
    const candidate = value?.trim() ?? "";
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      candidate
    )
      ? candidate
      : null;
  }

  async #resolveSessionFilePath(threadId: string): Promise<string | null> {
    if (this.#sessionFileCache.has(threadId)) {
      return this.#sessionFileCache.get(threadId) ?? null;
    }

    const sessionsRoot = join(this.#env.codexStateDir, "sessions");
    const found = await this.#findSessionFileRecursive(sessionsRoot, threadId);
    this.#sessionFileCache.set(threadId, found);
    return found;
  }

  async #findSessionFileRecursive(
    directoryPath: string,
    threadId: string
  ): Promise<string | null> {
    let entries: Array<{
      name: string;
      isFile(): boolean;
      isDirectory(): boolean;
    }>;

    try {
      entries = await readdir(directoryPath, {
        withFileTypes: true,
        encoding: "utf8",
      });
    } catch {
      return null;
    }

    for (const entry of entries) {
      const candidatePath = join(directoryPath, entry.name);

      if (entry.isFile() && entry.name.includes(threadId)) {
        return candidatePath;
      }
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const found = await this.#findSessionFileRecursive(
        join(directoryPath, entry.name),
        threadId
      );

      if (found) {
        return found;
      }
    }

    return null;
  }

  async #readMessagesFromSessionFile(sessionFilePath: string) {
    let raw = "";

    try {
      raw = await readFile(sessionFilePath, "utf8");
    } catch {
      return [];
    }

    const messages: RuntimeSessionHistoryMessage[] = [];
    let seq = 0;

    for (const line of raw.split("\n")) {
      const candidate = line.trim();

      if (!candidate.startsWith("{")) {
        continue;
      }

      let parsed: {
        timestamp?: string;
        type?: string;
        payload?: {
          type?: string;
          message?: string;
          phase?: string;
        };
      } | null = null;

      try {
        parsed = JSON.parse(candidate);
      } catch {
        parsed = null;
      }

      if (!parsed || parsed.type !== "event_msg") {
        continue;
      }

      if (parsed.payload?.type === "user_message" && parsed.payload.message) {
        seq += 1;
        messages.push({
          id: null,
          seq,
          role: "user",
          text: parsed.payload.message,
          timestamp: parsed.timestamp ?? null,
        });
        continue;
      }

      if (parsed.payload?.type === "agent_message" && parsed.payload.message) {
        seq += 1;
        messages.push({
          id: null,
          seq,
          role: "assistant",
          text: parsed.payload.message,
          timestamp: parsed.timestamp ?? null,
        });
      }
    }

    return messages;
  }
}
