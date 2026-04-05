import {
  spawn,
  type ChildProcess,
} from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
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
  RuntimeWorkspaceFile,
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
import { toClaudeEffort } from "../../lib/runtime-thinking.js";
import { nowIso } from "../../lib/utils.js";
import { ClaudeProcessManager } from "./ClaudeProcessManager.js";

const CLAUDE_MODELS = [
  "claude-sonnet-4-6",
  "claude-opus-4-6",
  "claude-haiku-4-5-20251001",
] as const;

const MAX_TURNS_PER_RUN = 40;
const STOP_KILL_TIMEOUT_MS = 5_000;
const MAX_STDERR_LINES = 12;

const formatClaudeModelName = (modelId: string) => {
  switch (modelId) {
    case "claude-sonnet-4-6":
      return "Claude Sonnet 4.6";
    case "claude-opus-4-6":
      return "Claude Opus 4.6";
    case "claude-haiku-4-5-20251001":
      return "Claude Haiku 4.5";
    default:
      return modelId;
  }
};

type Listener = (event: RuntimeEvent) => Promise<void> | void;

type ClaudeToolUse = {
  type: "tool_use";
  id?: string;
  name?: string;
  input?: Record<string, JsonValue>;
};

type ClaudeTextBlock = {
  type: "text";
  text?: string;
};

type ClaudeAssistantMessage = {
  id?: string;
  content?: Array<ClaudeToolUse | ClaudeTextBlock | Record<string, unknown>>;
  usage?: Record<string, JsonValue>;
};

type ClaudeToolUseResult = {
  type?: string;
  filePath?: string;
  content?: string;
  structuredPatch?: unknown;
  originalFile?: string | null;
};

type ClaudeLine =
  | {
      type: "system";
      subtype?: string;
      session_id?: string;
      model?: string;
      permissionMode?: string;
    }
  | {
      type: "assistant";
      message?: ClaudeAssistantMessage;
      session_id?: string;
    }
  | {
      type: "user";
      message?: {
        content?: Array<{
          tool_use_id?: string;
          type?: string;
          content?: string;
        }>;
      };
      tool_use_result?: ClaudeToolUseResult;
      session_id?: string;
    }
  | {
      type: "stream_event";
      event?: {
        type?: string;
        message?: {
          id?: string;
        };
        content_block?: {
          type?: string;
          id?: string;
          name?: string;
          input?: Record<string, JsonValue>;
          text?: string;
        };
        delta?: {
          type?: string;
          text?: string;
          stop_reason?: string | null;
          stop_sequence?: string | null;
          stop_details?: string | null;
        } & Record<string, JsonValue>;
        usage?: Record<string, JsonValue>;
      };
      session_id?: string;
    }
  | {
      type: "rate_limit_event";
      rate_limit_info?: Record<string, JsonValue>;
      session_id?: string;
    }
  | {
      type: "result";
      subtype?: string;
      is_error?: boolean;
      result?: string;
      stop_reason?: string | null;
      usage?: Record<string, JsonValue>;
      session_id?: string;
    };

type PendingTool = {
  id: string;
  name: string;
  input: Record<string, JsonValue> | null;
};

type ClaudeSessionState = {
  runtimeSessionKey: string;
  cwd: string;
  agentHomePath: string;
  runtimeRunId: string | null;
  currentProcess: ChildProcess | null;
  bufferedEvents: RuntimeEvent[];
  listeners: Set<Listener>;
  stopRequested: boolean;
  stderrTail: string[];
  history: RuntimeSessionHistoryMessage[];
  lastAssistantMessage: string | null;
  lastAssistantMessageId: string | null;
  activeAssistantMessageId: string | null;
  activeAssistantDelta: string;
  pendingTools: Map<string, PendingTool>;
  runStartedEmitted: boolean;
  permissionMode: "acceptEdits" | "bypassPermissions";
};

const isUuid = (value: string | null | undefined) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value?.trim() ?? ""
  );

const joinAssistantText = (
  content: ClaudeAssistantMessage["content"]
) =>
  (content ?? [])
    .filter(
      (item): item is ClaudeTextBlock =>
        !!item &&
        typeof item === "object" &&
        "type" in item &&
        item.type === "text"
    )
    .map((item) => (typeof item.text === "string" ? item.text : ""))
    .join("")
    .trim();

const getToolUses = (content: ClaudeAssistantMessage["content"]) =>
  (content ?? []).filter(
    (item): item is ClaudeToolUse =>
      !!item &&
      typeof item === "object" &&
      "type" in item &&
      item.type === "tool_use"
  );

const serializeToolResult = (toolResult?: ClaudeToolUseResult | null): JsonValue =>
  toolResult
    ? {
        type: toolResult.type ?? null,
        filePath: toolResult.filePath ?? null,
        content: toolResult.content ?? null,
        originalFile: toolResult.originalFile ?? null,
      }
    : null;

export class ClaudeRuntimeAdapter implements RuntimeAdapter {
  kind = "claude-code" as const;

  #env: AppEnv;
  #processManager: ClaudeProcessManager;
  #sessions = new Map<string, ClaudeSessionState>();

  constructor(env: AppEnv, processManager: ClaudeProcessManager) {
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
      providerKey: "claude",
      kind: this.kind,
      label: "Claude Code",
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
    const defaultModel = detected.defaultModel ?? CLAUDE_MODELS[0];
    const modelIds = Array.from(new Set([defaultModel, ...CLAUDE_MODELS]));

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
        defaultModelId: defaultModel,
        workspacePathTemplate: `${this.#env.agentHomesDir}/<agentId>`,
        runtimeStatePathTemplate: `${detected.stateDir}/nova-agents/<agentId>`,
      },
      models: modelIds.map((id) => ({
        id,
        name: formatClaudeModelName(id),
        available: true,
        local: false,
        input: "text",
        contextWindow: null,
        tags: id === defaultModel ? ["configured"] : [],
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
      throw serviceUnavailable("Claude Code CLI is not available.");
    }

    if (health.status !== "healthy") {
      throw serviceUnavailable("Claude Code is not signed in yet.");
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
      await this.#writeWorkspaceFile(input.workspacePath, file);
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
    const existingSessionId = isUuid(input.previousRuntimeSessionKey)
      ? input.previousRuntimeSessionKey!
      : null;
    const permissionMode =
      input.sandboxMode === "off" ? "bypassPermissions" : "acceptEdits";
    const { sessionId, startedAt } = await this.#startTurn({
      runId: input.runId,
      cwd,
      agentHomePath: input.agentHomePath,
      prompt: input.prompt,
      existingSessionId,
      modelOverride: input.modelOverride ?? null,
      thinkingLevel: input.thinkingLevel ?? null,
      permissionMode,
    });

    return {
      runtimeSessionKey: sessionId,
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
      throw conflict("Claude session is not available anymore.");
    }

    if (state.currentProcess) {
      throw conflict("Claude is still processing the current turn.");
    }

    const { startedAt } = await this.#startTurn({
      runId: state.runtimeRunId ?? input.idempotencyKey ?? null,
      cwd: state.cwd,
      agentHomePath: state.agentHomePath,
      prompt: input.text,
      existingSessionId: runtimeSessionKey,
      modelOverride: null,
      thinkingLevel: input.thinkingLevel ?? null,
      permissionMode: state.permissionMode,
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

    if (!state) {
      return [];
    }

    return state.history.filter(
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

  async listAutomations(): Promise<RuntimeAutomation[]> {
    return [];
  }

  async createAutomation(
    _input: CreateRuntimeAutomationInput
  ): Promise<RuntimeAutomation> {
    throw serviceUnavailable("Claude automations are not implemented yet.");
  }

  async updateAutomation(
    _id: string,
    _patch: UpdateRuntimeAutomationInput
  ): Promise<RuntimeAutomation> {
    throw serviceUnavailable("Claude automations are not implemented yet.");
  }

  async deleteAutomation(): Promise<void> {
    return;
  }

  async runAutomationNow(): Promise<{ runtimeRunId?: string | null }> {
    throw serviceUnavailable("Claude automations are not implemented yet.");
  }

  async getAutomationRuns(): Promise<RuntimeAutomationRun[]> {
    return [];
  }

  async #startTurn(input: {
    runId: string | null;
    cwd: string;
    agentHomePath: string;
    prompt: string;
    existingSessionId: string | null;
    modelOverride: string | null;
    thinkingLevel: StartRunInput["thinkingLevel"];
    permissionMode: "acceptEdits" | "bypassPermissions";
    resetBufferedEvents?: boolean;
  }) {
    const startedAt = nowIso();
    const existingState =
      input.existingSessionId && this.#sessions.has(input.existingSessionId)
        ? this.#sessions.get(input.existingSessionId)!
        : null;

    if (existingState?.currentProcess) {
      throw conflict("Claude is already processing this task.");
    }

    const args = this.#buildExecArgs({
      existingSessionId: input.existingSessionId,
      agentHomePath: input.agentHomePath,
      modelOverride: input.modelOverride,
      thinkingLevel: input.thinkingLevel ?? null,
      permissionMode: input.permissionMode,
      prompt: input.prompt,
    });

    const child = spawn(this.#env.claudeBinaryPath, args, {
      cwd: input.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let resolvedSessionId: string | null = input.existingSessionId;
    let currentState =
      resolvedSessionId && this.#sessions.has(resolvedSessionId)
        ? this.#sessions.get(resolvedSessionId)!
        : null;
    let terminalEventSeen = false;
    let startResolved = false;
    const stderrTail: string[] = [];
    let resolveStart!: (sessionId: string) => void;
    let rejectStart!: (reason?: unknown) => void;
    const startPromise = new Promise<string>((resolve, reject) => {
      resolveStart = resolve;
      rejectStart = reject;
    });

    const stdoutReader = createInterface({ input: child.stdout });
    const stderrReader = createInterface({ input: child.stderr });

    const bindState = async (sessionId: string) => {
      const reboundState =
        resolvedSessionId === sessionId && currentState ? currentState : null;
      resolvedSessionId = sessionId;
      currentState =
        reboundState ?? this.#getOrCreateSessionState(sessionId, input.cwd, input.agentHomePath);
      this.#resetStateForNewTurn(currentState, {
        runId: input.runId,
        cwd: input.cwd,
        agentHomePath: input.agentHomePath,
        permissionMode: input.permissionMode,
        resetBufferedEvents: input.resetBufferedEvents ?? true,
      });
      currentState.currentProcess = child;
      currentState.stderrTail = stderrTail;

      if (!startResolved) {
        startResolved = true;
        await this.#emit(sessionId, {
          type: "run.accepted",
          at: startedAt,
          data: {
            runtimeRunId: input.runId,
            sessionId,
          },
        });
        resolveStart(sessionId);
      }

      return currentState;
    };

    stdoutReader.on("line", (line) => {
      void (async () => {
        const parsed = this.#parseJsonLine(line);

        if (!parsed) {
          return;
        }

        if (
          parsed.type === "system" &&
          parsed.subtype === "init" &&
          typeof parsed.session_id === "string"
        ) {
          await bindState(parsed.session_id);
          return;
        }

        if (!currentState) {
          return;
        }

        const eventAt = nowIso();

        if (!currentState.runStartedEmitted && parsed.type !== "rate_limit_event") {
          currentState.runStartedEmitted = true;
          await this.#emit(currentState.runtimeSessionKey, {
            type: "run.started",
            at: eventAt,
            data: {
              runtimeRunId: currentState.runtimeRunId,
            },
          });
        }

        if (parsed.type === "stream_event") {
          await this.#handleStreamEvent(currentState, parsed, eventAt);
          return;
        }

        if (parsed.type === "assistant") {
          await this.#handleAssistantMessage(currentState, parsed, eventAt);
          return;
        }

        if (parsed.type === "user") {
          await this.#handleToolResult(currentState, parsed, eventAt);
          return;
        }

        if (parsed.type === "rate_limit_event") {
          return;
        }

        if (parsed.type === "result") {
          terminalEventSeen = true;

          if (parsed.usage && Object.keys(parsed.usage).length > 0) {
            await this.#emit(currentState.runtimeSessionKey, {
              type: "usage",
              at: eventAt,
              data: parsed.usage,
            });
          }

          if (!parsed.is_error && parsed.subtype === "success") {
            await this.#emit(currentState.runtimeSessionKey, {
              type: "run.completed",
              at: eventAt,
              data: {
                runtimeRunId: currentState.runtimeRunId,
                finalSummary:
                  currentState.lastAssistantMessage ??
                  (typeof parsed.result === "string" ? parsed.result : null) ??
                  "Claude completed the task.",
              },
            });
            return;
          }

          await this.#emit(currentState.runtimeSessionKey, {
            type: "run.failed",
            at: eventAt,
            data: {
              runtimeRunId: currentState.runtimeRunId,
              reason: this.#buildResultFailureMessage(parsed),
            },
          });
        }
      })().catch((error) => {
        if (!startResolved) {
          rejectStart(error);
        }
      });
    });

    stderrReader.on("line", (line) => {
      const normalized = line.trim();

      if (!normalized) {
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
        if (currentState && currentState.currentProcess === child) {
          currentState.currentProcess = null;
        }

        if (!startResolved) {
          rejectStart(
            new Error(stderrTail.join(" ").trim() || "Claude exited before a session was created.")
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
                currentState.lastAssistantMessage ?? "Claude completed the task.",
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
      const sessionId = await startPromise;
      return { sessionId, startedAt };
    } catch (error) {
      child.kill("SIGKILL");
      throw error;
    }
  }

  async #handleStreamEvent(
    state: ClaudeSessionState,
    parsed: Extract<ClaudeLine, { type: "stream_event" }>,
    eventAt: string
  ) {
    const event = parsed.event;

    if (!event?.type) {
      return;
    }

    if (
      event.type === "message_start" &&
      event.message?.id &&
      typeof event.message.id === "string"
    ) {
      state.activeAssistantMessageId = event.message.id;
      state.activeAssistantDelta = "";
      return;
    }

    if (
      event.type === "content_block_start" &&
      event.content_block?.type === "tool_use" &&
      typeof event.content_block.id === "string"
    ) {
      const toolId = event.content_block.id;
      const toolName =
        typeof event.content_block.name === "string"
          ? event.content_block.name
          : "tool";
      state.pendingTools.set(toolId, {
        id: toolId,
        name: toolName,
        input: event.content_block.input ?? null,
      });
      await this.#emit(state.runtimeSessionKey, {
        type: "tool.started",
        at: eventAt,
        data: {
          runtimeRunId: state.runtimeRunId,
          toolName,
          toolUseId: toolId,
          raw: {
            id: toolId,
            name: toolName,
            input: event.content_block.input ?? null,
          },
        },
      });
      return;
    }

    if (
      event.type === "content_block_delta" &&
      event.delta?.type === "text_delta" &&
      typeof event.delta.text === "string"
    ) {
      state.activeAssistantDelta += event.delta.text;
      const message = state.activeAssistantDelta.trim();

      if (!message) {
        return;
      }

      await this.#emit(state.runtimeSessionKey, {
        type: "message.delta",
        at: eventAt,
        data: {
          runtimeRunId: state.runtimeRunId,
          message,
          externalMessageId: state.activeAssistantMessageId,
        },
      });
      return;
    }

    if (event.type === "message_delta" && event.usage) {
      await this.#emit(state.runtimeSessionKey, {
        type: "usage",
        at: eventAt,
        data: event.usage,
      });
    }
  }

  async #handleAssistantMessage(
    state: ClaudeSessionState,
    parsed: Extract<ClaudeLine, { type: "assistant" }>,
    eventAt: string
  ) {
    const message = parsed.message ?? {};
    const toolUses = getToolUses(message.content);
    const text = joinAssistantText(message.content);

    for (const toolUse of toolUses) {
      const toolId =
        typeof toolUse.id === "string" ? toolUse.id : `tool-${eventAt}`;
      const toolName =
        typeof toolUse.name === "string" ? toolUse.name : "tool";

      if (!state.pendingTools.has(toolId)) {
        state.pendingTools.set(toolId, {
          id: toolId,
          name: toolName,
          input: toolUse.input ?? null,
        });
        await this.#emit(state.runtimeSessionKey, {
          type: "tool.started",
          at: eventAt,
          data: {
            runtimeRunId: state.runtimeRunId,
            toolName,
            toolUseId: toolId,
            raw: {
              id: toolId,
              name: toolName,
              input: toolUse.input ?? null,
            },
          },
        });
      }
    }

    if (!text) {
      return;
    }

    state.lastAssistantMessage = text;
    state.lastAssistantMessageId =
      typeof message.id === "string" ? message.id : null;
    state.activeAssistantMessageId = state.lastAssistantMessageId;
    state.activeAssistantDelta = text;
    this.#appendHistoryMessage(state, {
      role: "assistant",
      text,
      id: state.lastAssistantMessageId,
      timestamp: eventAt,
    });

    await this.#emit(state.runtimeSessionKey, {
      type: "message.completed",
      at: eventAt,
      data: {
        runtimeRunId: state.runtimeRunId,
        message: text,
        externalMessageId: state.lastAssistantMessageId,
      },
    });
  }

  async #handleToolResult(
    state: ClaudeSessionState,
    parsed: Extract<ClaudeLine, { type: "user" }>,
    eventAt: string
  ) {
    const firstContent = parsed.message?.content?.[0];
    const toolUseId =
      typeof firstContent?.tool_use_id === "string"
        ? firstContent.tool_use_id
        : null;

    if (!toolUseId) {
      return;
    }

    const pendingTool = state.pendingTools.get(toolUseId);
    const toolName = pendingTool?.name ?? "tool";
    state.pendingTools.delete(toolUseId);

    await this.#emit(state.runtimeSessionKey, {
      type: "tool.completed",
      at: eventAt,
        data: {
          runtimeRunId: state.runtimeRunId,
          toolName,
          toolUseId,
          raw: serializeToolResult(parsed.tool_use_result),
        },
      });

    const artifact = this.#extractArtifactFromToolResult(parsed.tool_use_result);

    if (!artifact) {
      return;
    }

    await this.#emit(state.runtimeSessionKey, {
      type: "artifact.created",
      at: eventAt,
      data: {
        runtimeRunId: state.runtimeRunId,
        path: artifact.path,
        kind: artifact.kind,
        label: null,
        summary: "Claude changed a workspace file.",
      },
    });
  }

  #extractArtifactFromToolResult(toolResult?: ClaudeToolUseResult) {
    const filePath =
      toolResult && typeof toolResult.filePath === "string"
        ? toolResult.filePath
        : null;

    if (!filePath) {
      return null;
    }

    return {
      path: filePath,
      kind: "modified",
    };
  }

  #buildExecArgs(input: {
    existingSessionId: string | null;
    agentHomePath: string;
    modelOverride: string | null;
    thinkingLevel: StartRunInput["thinkingLevel"];
    permissionMode: "acceptEdits" | "bypassPermissions";
    prompt: string;
  }) {
    const args = [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-partial-messages",
      "--max-turns",
      String(MAX_TURNS_PER_RUN),
      "--permission-mode",
      input.permissionMode,
      "--add-dir",
      input.agentHomePath,
    ];

    if (input.existingSessionId) {
      args.push("--resume", input.existingSessionId);
    }

    if (input.modelOverride?.trim()) {
      args.push("--model", input.modelOverride.trim());
    }

    const effort = toClaudeEffort(input.thinkingLevel);

    if (effort) {
      args.push("--effort", effort);
    }

    args.push(input.prompt);
    return args;
  }

  #getOrCreateSessionState(
    runtimeSessionKey: string,
    cwd: string,
    agentHomePath: string
  ) {
    const existing = this.#sessions.get(runtimeSessionKey);

    if (existing) {
      existing.cwd = cwd || existing.cwd;
      existing.agentHomePath = agentHomePath || existing.agentHomePath;
      return existing;
    }

    const created: ClaudeSessionState = {
      runtimeSessionKey,
      cwd,
      agentHomePath,
      runtimeRunId: null,
      currentProcess: null,
      bufferedEvents: [],
      listeners: new Set(),
      stopRequested: false,
      stderrTail: [],
      history: [],
      lastAssistantMessage: null,
      lastAssistantMessageId: null,
      activeAssistantMessageId: null,
      activeAssistantDelta: "",
      pendingTools: new Map(),
      runStartedEmitted: false,
      permissionMode: "acceptEdits",
    };
    this.#sessions.set(runtimeSessionKey, created);
    return created;
  }

  #resetStateForNewTurn(
    state: ClaudeSessionState,
    input: {
      runId: string | null;
      cwd: string;
      agentHomePath: string;
      permissionMode: "acceptEdits" | "bypassPermissions";
      resetBufferedEvents: boolean;
    }
  ) {
    state.cwd = input.cwd;
    state.agentHomePath = input.agentHomePath;
    state.runtimeRunId = input.runId;
    state.currentProcess = null;
    state.stopRequested = false;
    state.stderrTail = [];
    state.lastAssistantMessage = null;
    state.lastAssistantMessageId = null;
    state.activeAssistantMessageId = null;
    state.activeAssistantDelta = "";
    state.pendingTools.clear();
    state.runStartedEmitted = false;
    state.permissionMode = input.permissionMode;

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
    state: ClaudeSessionState,
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

  #parseJsonLine(line: string): ClaudeLine | null {
    const candidate = line.trim();

    if (!candidate.startsWith("{")) {
      return null;
    }

    try {
      return JSON.parse(candidate) as ClaudeLine;
    } catch {
      return null;
    }
  }

  #buildResultFailureMessage(result: Extract<ClaudeLine, { type: "result" }>) {
    if (typeof result.result === "string" && result.result.trim()) {
      return result.result.trim();
    }

    if (result.subtype === "error_max_turns") {
      return "Claude reached the maximum number of turns before completing the task.";
    }

    if (result.subtype === "error_during_execution") {
      return "Claude encountered an error while executing the task.";
    }

    return "Claude failed to complete the task.";
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
      return `Claude exited due to signal ${signal}.`;
    }

    if (typeof code === "number") {
      return `Claude exited with code ${code}.`;
    }

    return "Claude exited unexpectedly.";
  }

  async #writeWorkspaceFile(
    workspacePath: string,
    file: RuntimeWorkspaceFile
  ) {
    const absolutePath = `${workspacePath}/${file.relativePath}`;
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.content, "utf8");
  }
}
