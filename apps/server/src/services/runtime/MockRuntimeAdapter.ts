import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  ProvisionRuntimeAgentInput,
  ProvisionRuntimeAgentResult,
  RuntimeRunInput,
  RuntimeSessionHistoryMessage,
  RuntimeAdapter,
  RuntimeAgentCatalogItem,
  RuntimeAutomation,
  RuntimeAutomationRun,
  RuntimeCapabilities,
  RuntimeCatalog,
  RuntimeEvent,
  RuntimeSummary,
  StartRunInput,
  StartRunResult,
  ProjectSeed,
  SyncRuntimeWorkspaceInput,
  SyncRuntimeWorkspaceResult,
} from "@nova/runtime-adapter";
import type { RuntimeHealth } from "@nova/shared";
import { buildRuntimePrompt } from "../../lib/task-file.js";
import { resolveProjectPath } from "../../lib/paths.js";
import { nowIso } from "../../lib/utils.js";

type Listener = (event: RuntimeEvent) => Promise<void> | void;

type SessionState = {
  input: StartRunInput;
  events: RuntimeEvent[];
  listeners: Set<Listener>;
  timers: NodeJS.Timeout[];
  closed: boolean;
  history: RuntimeSessionHistoryMessage[];
};

export class MockRuntimeAdapter implements RuntimeAdapter {
  kind = "openclaw-native" as const;
  #sessions = new Map<string, SessionState>();
  #runtimeAgents = new Map<
    string,
    {
      workspacePath: string;
      runtimeStatePath: string;
      defaultModelId: string | null;
    }
  >();

  async getCapabilities(): Promise<RuntimeCapabilities> {
    return {
      kind: this.kind,
      executionTargetMode: "external",
      supportsStreaming: true,
      supportsStop: true,
      supportsRetry: true,
      supportsPause: false,
      supportsResume: false,
      supportsAutomations: false,
      supportsUsageMetrics: true,
    };
  }

  async getHealth(): Promise<RuntimeHealth> {
    return {
      status: "healthy",
      mode: "mock",
      profile: "apm",
      gatewayUrl: null,
      binaryPath: "mock",
      binaryVersion: null,
      configPath: "/tmp/mock-openclaw/openclaw.json",
      stateDir: "/tmp/mock-openclaw",
      details: ["Mock runtime adapter is active."],
      updatedAt: nowIso(),
    };
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
      available: true,
      health,
      capabilities,
    };
  }

  async getCatalog(): Promise<RuntimeCatalog> {
    const summary = await this.getSummary();

    return {
      providerKey: summary.providerKey,
      kind: summary.kind,
      label: summary.label,
      available: summary.available,
      health: summary.health,
      capabilities: summary.capabilities,
      configPath: "/tmp/mock-openclaw/openclaw.json",
      stateDir: "/tmp/mock-openclaw",
      gateway: {
        reachable: true,
        url: "ws://127.0.0.1:18789",
        bindMode: "loopback",
        bindHost: "127.0.0.1",
        port: 18789,
        authMode: "server-only",
      },
      defaults: {
        defaultAgentId: this.#runtimeAgents.keys().next().value ?? null,
        defaultModelId: "openai-codex/gpt-5.5",
        workspacePathTemplate: "/tmp/mock-openclaw/workspace-<agentId>",
        runtimeStatePathTemplate: "/tmp/mock-openclaw/agents/<agentId>/agent",
      },
      models: [
        {
          id: "openai-codex/gpt-5.5",
          name: "GPT-5.5",
          available: true,
          local: false,
          input: "text+image",
          contextWindow: 1000000,
          tags: ["default", "configured"],
        },
      ],
      existingAgents: await this.listRuntimeAgents(),
    };
  }

  async listRuntimeAgents(): Promise<RuntimeAgentCatalogItem[]> {
    return [...this.#runtimeAgents.entries()].map(([runtimeAgentId, value]) => ({
      runtimeAgentId,
      workspacePath: value.workspacePath,
      runtimeStatePath: value.runtimeStatePath,
      displayName: runtimeAgentId,
      defaultModelId: value.defaultModelId,
      isDefault: false,
    }));
  }

  async ensureRuntimeReady(): Promise<void> {
    return;
  }

  async provisionAgent(
    input: ProvisionRuntimeAgentInput
  ): Promise<ProvisionRuntimeAgentResult> {
    this.#runtimeAgents.set(input.runtimeAgentId, {
      workspacePath: input.workspacePath,
      runtimeStatePath: input.runtimeStatePath,
      defaultModelId: input.defaultModelId ?? null,
    });

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

  async deleteAgent(runtimeAgentId: string): Promise<void> {
    this.#runtimeAgents.delete(runtimeAgentId);
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
    seed?: ProjectSeed | null
  ): Promise<void> {
    const fullPath = resolveProjectPath(workspacePath, projectRoot).absolutePath;
    await mkdir(dirname(fullPath), { recursive: true });

    try {
      await access(fullPath);
    } catch {
      await mkdir(fullPath, { recursive: true });
    }

    if (seed?.type === "git" && seed.url) {
      try {
        await access(`${fullPath}/.git`);
      } catch {
        await mkdir(`${fullPath}/.git`, { recursive: true });
      }
    }
  }

  async startRun(input: StartRunInput): Promise<StartRunResult> {
    const runtimeSessionKey = `apm:task:${input.runId}`;
    const state: SessionState = {
      input,
      events: [],
      listeners: new Set(),
      timers: [],
      closed: false,
      history: [
        {
          id: `user-${input.runId}`,
          seq: 1,
          role: "user",
          text: input.prompt,
          timestamp: nowIso(),
        },
      ],
    };

    this.#sessions.set(runtimeSessionKey, state);

    const schedule = (
      delay: number,
      event: RuntimeEvent,
      { close = false }: { close?: boolean } = {}
    ) => {
      const timer = setTimeout(() => {
        if (state.closed) {
          return;
        }

        this.#emit(runtimeSessionKey, event);

        if (close) {
          state.closed = true;
        }
      }, delay);

      state.timers.push(timer);
    };

    schedule(0, {
      type: "run.accepted",
      at: nowIso(),
      data: {
        taskId: input.taskId,
        prompt: input.prompt,
      },
    });
    schedule(25, {
      type: "run.started",
      at: nowIso(),
      data: {
        executionTarget: input.executionTarget,
      },
    });
    schedule(50, {
      type: "message.delta",
      at: nowIso(),
      data: {
        delta: `Inspecting ${input.executionTarget}`,
      },
    });
    schedule(75, {
      type: "tool.started",
      at: nowIso(),
      data: {
        toolName: "filesystem.inspect",
      },
    });
    schedule(100, {
      type: "tool.completed",
      at: nowIso(),
      data: {
        toolName: "filesystem.inspect",
        result: "ok",
      },
    });
    schedule(125, {
      type: "artifact.created",
      at: nowIso(),
      data: {
        path: `${input.executionTarget}/mock-output.md`,
        kind: "modified",
      },
    });
    schedule(150, {
      type: "message.completed",
      at: nowIso(),
      data: {
        message: "Mock runtime completed the requested work.",
        externalMessageId: `assistant-${input.runId}`,
      },
    });
    schedule(175, {
      type: "usage",
      at: nowIso(),
      data: {
        promptTokens: 128,
        completionTokens: 256,
        totalTokens: 384,
      },
    });
    schedule(
      200,
      {
        type: "run.completed",
        at: nowIso(),
        data: {
          finalSummary: "Mock runtime completed successfully.",
          changedFiles: [`${input.executionTarget}/mock-output.md`],
        },
      },
      { close: true }
    );

    return {
      runtimeSessionKey,
      runtimeRunId: `mock-run-${input.runId}`,
      startedAt: nowIso(),
    };
  }

  async stopRun(runtimeSessionKey: string): Promise<void> {
    const session = this.#sessions.get(runtimeSessionKey);

    if (!session || session.closed) {
      return;
    }

    for (const timer of session.timers) {
      clearTimeout(timer);
    }

    session.closed = true;

    await this.#emit(runtimeSessionKey, {
      type: "run.aborted",
      at: nowIso(),
      data: {
        reason: "Stopped by user.",
      },
    });
  }

  async sendRunInput(runtimeSessionKey: string, input: RuntimeRunInput) {
    const session = this.#sessions.get(runtimeSessionKey);

    if (!session) {
      throw new Error(`Mock session ${runtimeSessionKey} does not exist.`);
    }

    const startedAt = nowIso();
    const runtimeRunId = input.idempotencyKey ?? `mock-input-${Date.now()}`;
    session.history.push({
      id: runtimeRunId,
      seq: session.history.length + 1,
      role: "user",
      text: input.text,
      timestamp: startedAt,
    });

    const schedule = (
      delay: number,
      event: RuntimeEvent,
      afterEmit?: () => void
    ) => {
      const timer = setTimeout(() => {
        if (session.closed) {
          return;
        }

        void this.#emit(runtimeSessionKey, event).then(() => {
          afterEmit?.();
        });
      }, delay);

      session.timers.push(timer);
    };

    schedule(25, {
      type: "message.delta",
      at: nowIso(),
      data: {
        delta: `Acknowledged: ${input.text.slice(0, 80)}`,
        runtimeRunId,
      },
    });
    schedule(
      75,
      {
        type: "message.completed",
        at: nowIso(),
        data: {
          message: `Mock agent received: ${input.text}`,
          externalMessageId: `assistant-${runtimeRunId}`,
          runtimeRunId,
        },
      },
      () => {
        session.history.push({
          id: `assistant-${runtimeRunId}`,
          seq: session.history.length + 1,
          role: "assistant",
          text: `Mock agent received: ${input.text}`,
          timestamp: nowIso(),
        });
      }
    );

    return {
      runtimeRunId,
      startedAt,
    };
  }

  async loadSessionHistory(
    runtimeSessionKey: string,
    after = 0
  ): Promise<RuntimeSessionHistoryMessage[]> {
    const session = this.#sessions.get(runtimeSessionKey);

    if (!session) {
      return [];
    }

    return session.history.filter((message) => (message.seq ?? 0) > after);
  }

  async subscribeRun(
    runtimeSessionKey: string,
    onEvent: (event: RuntimeEvent) => Promise<void> | void
  ) {
    const session = this.#sessions.get(runtimeSessionKey);

    if (!session) {
      throw new Error(`Mock session ${runtimeSessionKey} does not exist.`);
    }

    session.listeners.add(onEvent);

    for (const event of session.events) {
      await onEvent(event);
    }

    return async () => {
      session.listeners.delete(onEvent);
    };
  }

  async listAutomations(_agentId?: string): Promise<RuntimeAutomation[]> {
    return [];
  }

  async createAutomation(): Promise<RuntimeAutomation> {
    throw new Error("Automations are not implemented in the first backend slice.");
  }

  async updateAutomation(): Promise<RuntimeAutomation> {
    throw new Error("Automations are not implemented in the first backend slice.");
  }

  async deleteAutomation(): Promise<void> {
    throw new Error("Automations are not implemented in the first backend slice.");
  }

  async runAutomationNow(): Promise<{ runtimeRunId?: string | null }> {
    throw new Error("Automations are not implemented in the first backend slice.");
  }

  async getAutomationRuns(_id: string): Promise<RuntimeAutomationRun[]> {
    return [];
  }

  async #emit(runtimeSessionKey: string, event: RuntimeEvent) {
    const session = this.#sessions.get(runtimeSessionKey);

    if (!session) {
      return;
    }

    session.events.push(event);

    for (const listener of session.listeners) {
      await Promise.resolve(listener(event));
    }
  }
}
