import { mkdir } from "node:fs/promises";
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
import { serviceUnavailable } from "../../lib/errors.js";
import { resolveProjectPath } from "../../lib/paths.js";
import { OpenClawProcessManager } from "./OpenClawProcessManager.js";

export class OpenClawNativeAdapter implements RuntimeAdapter {
  kind = "openclaw-native" as const;
  #processManager: OpenClawProcessManager;

  constructor(processManager: OpenClawProcessManager) {
    this.#processManager = processManager;
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

  async ensureRuntimeReady(): Promise<void> {
    const health = await this.#processManager.getHealth();

    if (health.status !== "healthy") {
      throw serviceUnavailable("OpenClaw runtime is not healthy.", health);
    }
  }

  async ensureAgentHome(_agentId: string, agentHomePath: string): Promise<void> {
    await mkdir(agentHomePath, { recursive: true });
  }

  async ensureProjectRoot(
    _agentId: string,
    agentHomePath: string,
    projectRoot: string,
    seed?: ProjectSeed | null
  ): Promise<void> {
    const fullPath = resolveProjectPath(agentHomePath, projectRoot).absolutePath;
    await mkdir(fullPath, { recursive: true });

    if (seed?.type === "git" && seed.url) {
      await mkdir(`${fullPath}/.git`, { recursive: true });
    }
  }

  async startRun(_input: StartRunInput): Promise<StartRunResult> {
    throw serviceUnavailable(
      "Real OpenClaw run execution is not implemented in this slice. Use mock runtime mode."
    );
  }

  async stopRun(_runtimeSessionKey: string): Promise<void> {
    throw serviceUnavailable(
      "Real OpenClaw stop is not implemented in this slice. Use mock runtime mode."
    );
  }

  async subscribeRun(
    _runtimeSessionKey: string,
    _onEvent: (event: RuntimeEvent) => Promise<void> | void
  ): Promise<() => Promise<void>> {
    throw serviceUnavailable(
      "Real OpenClaw subscriptions are not implemented in this slice. Use mock runtime mode."
    );
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
}
