import { mkdir, writeFile } from "node:fs/promises";
import type {
  ProjectSeed,
  ProvisionRuntimeAgentInput,
  ProvisionRuntimeAgentResult,
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
} from "@nova/runtime-adapter";
import type { RuntimeHealth } from "@nova/shared";
import type { AppEnv } from "../../env.js";
import { serviceUnavailable } from "../../lib/errors.js";
import { resolveProjectPath } from "../../lib/paths.js";
import { nowIso } from "../../lib/utils.js";
import {
  OpenClawGatewayClient,
  type OpenClawAgentEventPayload,
  type OpenClawChatEventPayload,
} from "./OpenClawGatewayClient.js";
import { OpenClawProcessManager } from "./OpenClawProcessManager.js";
import { extractOpenClawIdentityPatch } from "./openclaw-identity.js";

type Listener = (event: RuntimeEvent) => Promise<void> | void;

type GatewaySessionState = {
  runtimeSessionKey: string;
  runtimeRunId: string | null;
  bufferedEvents: RuntimeEvent[];
  listeners: Set<Listener>;
  hasActiveLifecycle: boolean;
  terminalRunIds: Set<string>;
};

export class OpenClawNativeAdapter implements RuntimeAdapter {
  kind = "openclaw-native" as const;
  #env: AppEnv;
  #processManager: OpenClawProcessManager;
  #gatewayClient: OpenClawGatewayClient;
  #sessions = new Map<string, GatewaySessionState>();

  constructor(env: AppEnv, processManager: OpenClawProcessManager) {
    this.#env = env;
    this.#processManager = processManager;
    this.#gatewayClient = new OpenClawGatewayClient(env, processManager);
    this.#gatewayClient.onEvent((frame) => {
      void this.#handleGatewayFrame(frame.event, frame.payload);
    });
  }

  async getCapabilities(): Promise<RuntimeCapabilities> {
    return {
      kind: this.kind,
      executionTargetMode: "external",
      supportsStreaming: true,
      supportsStop: true,
      supportsRetry: true,
      supportsPause: false,
      supportsResume: false,
      supportsAutomations: true,
      supportsUsageMetrics: true,
    };
  }

  async getHealth(): Promise<RuntimeHealth> {
    return this.#processManager.getHealth();
  }

  async getSummary(): Promise<RuntimeSummary> {
    const [health, capabilities] = await Promise.all([
      this.getHealth(),
      this.getCapabilities(),
    ]);

    return {
      providerKey: "openclaw",
      kind: this.kind,
      label: "OpenClaw",
      available: health.status !== "missing_binary",
      health,
      capabilities,
    };
  }

  async getCatalog(): Promise<RuntimeCatalog> {
    const [summary, agents, models] = await Promise.all([
      this.getSummary(),
      this.listRuntimeAgents(),
      this.#processManager.listModels(),
    ]);
    const defaultAgent = agents.find((agent) => agent.isDefault) ?? null;
    const defaultModel =
      models.find((model) => model.tags?.includes("default")) ??
      models.find((model) => model.available && !model.missing) ??
      null;

    return {
      providerKey: summary.providerKey,
      kind: summary.kind,
      label: summary.label,
      available: summary.available,
      health: summary.health,
      capabilities: summary.capabilities,
      configPath: summary.health.configPath ?? this.#env.openclawConfigPath,
      stateDir: summary.health.stateDir ?? this.#env.openclawStateDir,
      gateway: {
        reachable: summary.health.status === "healthy",
        url: summary.health.gatewayUrl,
        bindMode: null,
        bindHost: null,
        port: this.#inferPort(summary.health.gatewayUrl),
        authMode: "server-only",
      },
      defaults: {
        defaultAgentId: defaultAgent?.runtimeAgentId ?? null,
        defaultModelId: defaultModel?.key ?? null,
        workspacePathTemplate: `${this.#env.openclawStateDir}/workspace-<agentId>`,
        runtimeStatePathTemplate: `${this.#env.openclawStateDir}/agents/<agentId>/agent`,
      },
      models: models.map((model) => ({
        id: model.key,
        name: model.name ?? model.key,
        available: Boolean(model.available) && !Boolean(model.missing),
        local: Boolean(model.local),
        input: model.input ?? null,
        contextWindow: model.contextWindow ?? null,
        tags: model.tags ?? [],
      })),
      existingAgents: agents,
    };
  }

  async listRuntimeAgents(): Promise<RuntimeAgentCatalogItem[]> {
    const agents = await this.#processManager.listAgents();

    return agents.map((agent) => ({
      runtimeAgentId: agent.id,
      workspacePath: agent.workspace ?? "",
      runtimeStatePath: agent.agentDir ?? "",
      displayName: agent.identityName ?? null,
      defaultModelId: agent.model ?? null,
      isDefault: Boolean(agent.isDefault),
    }));
  }

  async ensureRuntimeReady(): Promise<void> {
    const health = await this.#processManager.getHealth();

    if (health.status !== "healthy") {
      throw serviceUnavailable("OpenClaw runtime is not healthy.", health);
    }
  }

  async provisionAgent(
    input: ProvisionRuntimeAgentInput
  ): Promise<ProvisionRuntimeAgentResult> {
    await this.ensureRuntimeReady();
    await this.#processManager.provisionAgent(input);

    return {
      runtimeAgentId: input.runtimeAgentId,
      workspacePath: input.workspacePath,
      runtimeStatePath: input.runtimeStatePath,
      defaultModelId: input.defaultModelId ?? null,
    };
  }

  async deleteAgent(runtimeAgentId: string): Promise<void> {
    await this.#processManager.deleteAgent(runtimeAgentId);
  }

  async ensureAgentWorkspace(
    _agentId: string,
    workspacePath: string,
    runtimeStatePath: string
  ): Promise<void> {
    await Promise.all([
      mkdir(workspacePath, { recursive: true }),
      mkdir(runtimeStatePath, { recursive: true }),
      mkdir(`${workspacePath}/.apm`, { recursive: true }),
    ]);
  }

  async syncAgentWorkspace(
    input: SyncRuntimeWorkspaceInput
  ): Promise<SyncRuntimeWorkspaceResult> {
    await this.ensureAgentWorkspace(
      input.runtimeAgentId,
      input.workspacePath,
      input.runtimeStatePath
    );
    await Promise.all(
      input.files.map(async (file) => {
        const absolutePath = `${input.workspacePath}/${file.relativePath}`;
        const directoryPath = absolutePath.split("/").slice(0, -1).join("/");
        await mkdir(directoryPath, { recursive: true });
        await writeFile(absolutePath, file.content, "utf8");
      })
    );

    const identityFile = input.files.find((file) => file.relativePath === "IDENTITY.md");
    const parsedIdentity = identityFile
      ? extractOpenClawIdentityPatch(identityFile.content)
      : null;
    const identityPatch = {
      name: parsedIdentity?.name ?? input.identityDefaults?.name ?? undefined,
      theme: parsedIdentity?.theme,
      emoji: parsedIdentity?.emoji,
      avatar: parsedIdentity?.avatar,
    };

    if (Object.values(identityPatch).some(Boolean)) {
      await this.#processManager.setIdentity({
        runtimeAgentId: input.runtimeAgentId,
        identity: identityPatch,
      });
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
    seed?: ProjectSeed | null
  ): Promise<void> {
    const fullPath = resolveProjectPath(workspacePath, projectRoot).absolutePath;
    await mkdir(fullPath, { recursive: true });

    if (seed?.type === "git" && seed.url) {
      await mkdir(`${fullPath}/.git`, { recursive: true });
    }
  }

  async startRun(input: StartRunInput): Promise<StartRunResult> {
    await this.ensureRuntimeReady();

    const runtimeSessionKey = this.#buildTaskSessionKey(
      input.runtimeAgentId,
      input.taskId
    );
    const state = this.#getOrCreateSessionState(runtimeSessionKey);
    const startedAt = nowIso();
    state.bufferedEvents = [];
    state.hasActiveLifecycle = false;

    const response = await this.#gatewayClient.request<{
      runId?: string;
      status?: string;
    }>("chat.send", {
      sessionKey: runtimeSessionKey,
      message: input.prompt,
      thinking: input.thinkingLevel ?? undefined,
      deliver: false,
      timeoutMs: 60 * 60 * 1000,
      idempotencyKey: input.runId,
    });

    state.runtimeRunId =
      typeof response.runId === "string" ? response.runId : input.runId;
    if (state.runtimeRunId) {
      state.terminalRunIds.delete(state.runtimeRunId);
    }

    this.#emit(runtimeSessionKey, {
      type: "run.accepted",
      at: startedAt,
      data: {
        runtimeRunId: state.runtimeRunId,
        status: response.status ?? "started",
      },
    });

    return {
      runtimeSessionKey,
      runtimeRunId: state.runtimeRunId,
      startedAt,
    };
  }

  async stopRun(runtimeSessionKey: string): Promise<void> {
    await this.ensureRuntimeReady();
    await this.#gatewayClient.request("chat.abort", {
      sessionKey: runtimeSessionKey,
    });
  }

  async sendRunInput(
    runtimeSessionKey: string,
    input: RuntimeRunInput
  ): Promise<{ runtimeRunId: string | null; startedAt: string }> {
    await this.ensureRuntimeReady();

    const state = this.#getOrCreateSessionState(runtimeSessionKey);
    const startedAt = nowIso();
    const idempotencyKey = input.idempotencyKey ?? `nova-input-${Date.now()}`;
    const response = await this.#gatewayClient.request<{
      runId?: string;
    }>("chat.send", {
      sessionKey: runtimeSessionKey,
      message: input.text,
      thinking: input.thinkingLevel ?? undefined,
      deliver: false,
      timeoutMs: 60 * 60 * 1000,
      idempotencyKey,
    });

    return {
      runtimeRunId:
        typeof response.runId === "string"
          ? response.runId
          : state.runtimeRunId,
      startedAt,
    };
  }

  async loadSessionHistory(
    runtimeSessionKey: string,
    after = 0
  ): Promise<RuntimeSessionHistoryMessage[]> {
    await this.ensureRuntimeReady();

    const response = await this.#gatewayClient.request<{
      messages?: Array<{
        role?: string;
        content?: Array<{
          type?: string;
          text?: string;
        }>;
        timestamp?: number;
        __openclaw?: {
          id?: string;
          seq?: number;
        };
      }>;
    }>("chat.history", {
      sessionKey: runtimeSessionKey,
      limit: 500,
    });

    return (response.messages ?? [])
      .map((message) => {
        const seq =
          typeof message.__openclaw?.seq === "number"
            ? message.__openclaw.seq
            : null;
        const text = this.#extractMessageText(message.content);

        if (!text) {
          return null;
        }

        return {
          id:
            typeof message.__openclaw?.id === "string"
              ? message.__openclaw.id
              : null,
          seq,
          role:
            message.role === "assistant" || message.role === "system"
              ? message.role
              : "user",
          text,
          timestamp:
            typeof message.timestamp === "number"
              ? new Date(message.timestamp).toISOString()
              : null,
        } satisfies RuntimeSessionHistoryMessage;
      })
      .filter(
        (message): message is RuntimeSessionHistoryMessage =>
          message !== null && ((message.seq ?? 0) > after || after <= 0)
      );
  }

  async subscribeRun(
    runtimeSessionKey: string,
    onEvent: (event: RuntimeEvent) => Promise<void> | void
  ): Promise<() => Promise<void>> {
    const state = this.#getOrCreateSessionState(runtimeSessionKey);
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

  async createAutomation(): Promise<RuntimeAutomation> {
    throw serviceUnavailable("Automations are not implemented in this slice.");
  }

  async updateAutomation(): Promise<RuntimeAutomation> {
    throw serviceUnavailable("Automations are not implemented in this slice.");
  }

  async deleteAutomation(): Promise<void> {
    throw serviceUnavailable("Automations are not implemented in this slice.");
  }

  async runAutomationNow(): Promise<{ runtimeRunId?: string | null }> {
    throw serviceUnavailable("Automations are not implemented in this slice.");
  }

  async getAutomationRuns(_id: string): Promise<RuntimeAutomationRun[]> {
    return [];
  }

  async close() {
    await this.#gatewayClient.close();
  }

  #buildTaskSessionKey(runtimeAgentId: string, taskId: string) {
    return `agent:${runtimeAgentId}:nova:task:${taskId}`;
  }

  #getOrCreateSessionState(runtimeSessionKey: string) {
    const existing = this.#sessions.get(runtimeSessionKey);

    if (existing) {
      return existing;
    }

    const created: GatewaySessionState = {
      runtimeSessionKey,
      runtimeRunId: null,
      bufferedEvents: [],
      listeners: new Set(),
      hasActiveLifecycle: false,
      terminalRunIds: new Set(),
    };
    this.#sessions.set(runtimeSessionKey, created);
    return created;
  }

  async #handleGatewayFrame(
    eventType: string,
    payload: Record<string, unknown>
  ) {
    if (eventType === "chat") {
      await this.#handleChatEvent(payload as OpenClawChatEventPayload);
      return;
    }

    if (eventType === "agent") {
      await this.#handleAgentEvent(payload as OpenClawAgentEventPayload);
    }
  }

  async #handleChatEvent(payload: OpenClawChatEventPayload) {
    const runtimeSessionKey = payload.sessionKey?.trim();

    if (!runtimeSessionKey) {
      return;
    }

    const state = this.#sessions.get(runtimeSessionKey);

    if (!state) {
      return;
    }

    if (typeof payload.runId === "string") {
      state.runtimeRunId = payload.runId;
    }

    const eventAt = this.#timestampFromMs(payload.message?.timestamp);
    const messageText = this.#extractMessageText(payload.message?.content);
    const externalMessageId = this.#extractExternalMessageId(payload.message);

    if (payload.state === "delta" && messageText) {
      await this.#emit(runtimeSessionKey, {
        type: "message.delta",
        at: eventAt,
        data: {
          runtimeRunId: payload.runId ?? state.runtimeRunId,
          sessionKey: runtimeSessionKey,
          seq: payload.seq ?? null,
          delta: messageText,
        },
      });
      return;
    }

    if (payload.state === "final") {
      if (messageText) {
        await this.#emit(runtimeSessionKey, {
          type: "message.completed",
          at: eventAt,
          data: {
            runtimeRunId: payload.runId ?? state.runtimeRunId,
            sessionKey: runtimeSessionKey,
            seq: payload.seq ?? null,
            message: messageText,
            externalMessageId,
          },
        });
      }

      const finalizedRunId = payload.runId ?? state.runtimeRunId;

      if (finalizedRunId && !state.hasActiveLifecycle && !state.terminalRunIds.has(finalizedRunId)) {
        state.terminalRunIds.add(finalizedRunId);
        await this.#emit(runtimeSessionKey, {
          type: "run.completed",
          at: eventAt,
          data: {
            runtimeRunId: finalizedRunId,
            finalSummary: messageText || "OpenClaw completed the task.",
          },
        });
      }

      return;
    }

    if (payload.state === "error") {
      await this.#emit(runtimeSessionKey, {
        type: "error",
        at: eventAt,
        data: {
          runtimeRunId: payload.runId ?? state.runtimeRunId,
          sessionKey: runtimeSessionKey,
          message: payload.errorMessage ?? "OpenClaw reported an error.",
        },
      });

      const failedRunId = payload.runId ?? state.runtimeRunId;

      if (failedRunId && !state.hasActiveLifecycle && !state.terminalRunIds.has(failedRunId)) {
        state.terminalRunIds.add(failedRunId);
        await this.#emit(runtimeSessionKey, {
          type: "run.failed",
          at: eventAt,
          data: {
            runtimeRunId: failedRunId,
            reason: payload.errorMessage ?? "OpenClaw reported an error.",
          },
        });
      }

      return;
    }

    if (payload.state === "aborted") {
      const abortedRunId = payload.runId ?? state.runtimeRunId;

      if (abortedRunId && !state.terminalRunIds.has(abortedRunId)) {
        state.terminalRunIds.add(abortedRunId);
        await this.#emit(runtimeSessionKey, {
          type: "run.aborted",
          at: eventAt,
          data: {
            runtimeRunId: abortedRunId,
            reason: payload.stopReason ?? "Stopped by user.",
          },
        });
      }
    }
  }

  async #handleAgentEvent(payload: OpenClawAgentEventPayload) {
    const runtimeSessionKey = payload.sessionKey?.trim();

    if (!runtimeSessionKey) {
      return;
    }

    const state = this.#sessions.get(runtimeSessionKey);

    if (!state) {
      return;
    }

    if (typeof payload.runId === "string") {
      state.runtimeRunId = payload.runId;
    }

    const eventAt = this.#timestampFromMs(payload.ts);
    const stream = payload.stream?.trim();
    const data = payload.data ?? {};
    const phase = typeof data.phase === "string" ? data.phase : null;

    if (stream === "lifecycle") {
      if (phase === "start") {
        state.hasActiveLifecycle = true;
        await this.#emit(runtimeSessionKey, {
          type: "run.started",
          at: eventAt,
          data: {
            runtimeRunId: payload.runId ?? state.runtimeRunId,
          },
        });
        return;
      }

      if (phase === "end") {
        state.hasActiveLifecycle = false;
        const finalizedRunId = payload.runId ?? state.runtimeRunId;

        if (finalizedRunId && !state.terminalRunIds.has(finalizedRunId)) {
          state.terminalRunIds.add(finalizedRunId);
          await this.#emit(runtimeSessionKey, {
            type: "run.completed",
            at: eventAt,
            data: {
              runtimeRunId: finalizedRunId,
              finalSummary:
                typeof data.summary === "string"
                  ? data.summary
                  : "OpenClaw completed the task.",
            },
          });
        }

        return;
      }

      if (phase === "error") {
        state.hasActiveLifecycle = false;
        const failedRunId = payload.runId ?? state.runtimeRunId;

        if (failedRunId && !state.terminalRunIds.has(failedRunId)) {
          state.terminalRunIds.add(failedRunId);
          await this.#emit(runtimeSessionKey, {
            type: "run.failed",
            at: eventAt,
            data: {
              runtimeRunId: failedRunId,
              reason:
                typeof data.error === "string"
                  ? data.error
                  : typeof data.message === "string"
                    ? data.message
                    : "OpenClaw lifecycle error.",
            },
          });
        }

        return;
      }
    }

    if (stream === "tool") {
      const toolName = this.#extractToolName(data);

      if (phase === "start") {
        await this.#emit(runtimeSessionKey, {
          type: "tool.started",
          at: eventAt,
          data: {
            runtimeRunId: payload.runId ?? state.runtimeRunId,
            toolName,
            raw: data as unknown as import("@nova/shared").JsonValue,
          },
        });
        return;
      }

      if (phase === "end") {
        await this.#emit(runtimeSessionKey, {
          type: "tool.completed",
          at: eventAt,
          data: {
            runtimeRunId: payload.runId ?? state.runtimeRunId,
            toolName,
            raw: data as unknown as import("@nova/shared").JsonValue,
          },
        });
        return;
      }
    }

    if (stream === "warning") {
      await this.#emit(runtimeSessionKey, {
        type: "warning",
        at: eventAt,
        data: {
          runtimeRunId: payload.runId ?? state.runtimeRunId,
          raw: data as unknown as import("@nova/shared").JsonValue,
        },
      });
      return;
    }

    if (stream === "usage") {
      await this.#emit(runtimeSessionKey, {
        type: "usage",
        at: eventAt,
        data: data as Record<string, import("@nova/shared").JsonValue>,
      });
    }
  }

  async #emit(runtimeSessionKey: string, event: RuntimeEvent) {
    const state = this.#getOrCreateSessionState(runtimeSessionKey);
    state.bufferedEvents.push(event);

    for (const listener of state.listeners) {
      await Promise.resolve(listener(event));
    }
  }

  #timestampFromMs(value?: number) {
    return typeof value === "number" ? new Date(value).toISOString() : nowIso();
  }

  #extractMessageText(
    content?: Array<{
      type?: string;
      text?: string;
    }>
  ) {
    const text = (content ?? [])
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => part.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n\n")
      .trim();

    return text || null;
  }

  #extractExternalMessageId(message?: {
    __openclaw?: {
      id?: string;
    };
  }) {
    return typeof message?.__openclaw?.id === "string"
      ? message.__openclaw.id
      : null;
  }

  #extractToolName(data: Record<string, unknown>) {
    if (typeof data.toolName === "string" && data.toolName.trim()) {
      return data.toolName.trim();
    }

    if (typeof data.name === "string" && data.name.trim()) {
      return data.name.trim();
    }

    if (
      typeof data.tool === "object" &&
      data.tool !== null &&
      typeof (data.tool as { name?: unknown }).name === "string"
    ) {
      return ((data.tool as { name: string }).name || "").trim() || "tool";
    }

    return "tool";
  }

  #inferPort(url: string | null) {
    if (!url) {
      return null;
    }

    try {
      return new URL(url).port ? Number(new URL(url).port) : null;
    } catch {
      return null;
    }
  }
}
