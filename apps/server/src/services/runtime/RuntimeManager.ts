import type { RuntimeAdapter, RuntimeCatalog, RuntimeSummary } from "@nova/runtime-adapter";
import type { RuntimeHealth, RuntimeKind } from "@nova/shared";
import type { AppEnv } from "../../env.js";
import { badRequest } from "../../lib/errors.js";
import { MockRuntimeAdapter } from "./MockRuntimeAdapter.js";
import { OpenClawNativeAdapter } from "./OpenClawNativeAdapter.js";
import { OpenClawProcessManager } from "./OpenClawProcessManager.js";

export class RuntimeManager {
  #env: AppEnv;
  #processManager: OpenClawProcessManager;
  #mockAdapter: MockRuntimeAdapter;
  #openClawAdapter: OpenClawNativeAdapter;

  constructor(env: AppEnv) {
    this.#env = env;
    this.#processManager = new OpenClawProcessManager(env);
    this.#mockAdapter = new MockRuntimeAdapter();
    this.#openClawAdapter = new OpenClawNativeAdapter(env, this.#processManager);
  }

  getAdapter(kind: RuntimeKind = "openclaw-native"): RuntimeAdapter {
    if (kind !== "openclaw-native") {
      throw badRequest(`Runtime ${kind} is not implemented yet.`);
    }

    return this.#env.runtimeMode === "mock"
      ? this.#mockAdapter
      : this.#openClawAdapter;
  }

  async listRuntimes(): Promise<RuntimeSummary[]> {
    return [await this.getAdapter("openclaw-native").getSummary()];
  }

  async getOpenClawCatalog(): Promise<RuntimeCatalog> {
    return this.getAdapter("openclaw-native").getCatalog();
  }

  async getHealth(): Promise<RuntimeHealth> {
    return this.getAdapter("openclaw-native").getHealth();
  }

  async setup() {
    return this.#processManager.setup();
  }

  async restart() {
    return this.#processManager.restart();
  }

  async close() {
    await this.#openClawAdapter.close();
  }
}
