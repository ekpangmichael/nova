import { mkdir, access } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  RuntimeAdapter,
  RuntimeAutomation,
  RuntimeAutomationRun,
  RuntimeCapabilities,
  RuntimeEvent,
  StartRunInput,
  StartRunResult,
  ProjectSeed,
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
};

export class MockRuntimeAdapter implements RuntimeAdapter {
  kind = "openclaw-native" as const;
  #sessions = new Map<string, SessionState>();

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
      details: ["Mock runtime adapter is active."],
      updatedAt: nowIso(),
    };
  }

  async ensureRuntimeReady(): Promise<void> {
    return;
  }

  async ensureAgentHome(_agentId: string, agentHomePath: string): Promise<void> {
    await mkdir(agentHomePath, { recursive: true });
    await mkdir(`${agentHomePath}/.apm`, { recursive: true });
  }

  async ensureProjectRoot(
    _agentId: string,
    agentHomePath: string,
    projectRoot: string,
    seed?: ProjectSeed | null
  ): Promise<void> {
    const fullPath = resolveProjectPath(agentHomePath, projectRoot).absolutePath;
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
        prompt: buildRuntimePrompt(input.runId),
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
