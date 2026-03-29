import type { RuntimeAdapter } from "@nova/runtime-adapter";
import type { RuntimeHealth } from "@nova/shared";
import type { AppEnv } from "../../env.js";
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
    this.#openClawAdapter = new OpenClawNativeAdapter(this.#processManager);
  }

  getAdapter(): RuntimeAdapter {
    return this.#env.runtimeMode === "mock"
      ? this.#mockAdapter
      : this.#openClawAdapter;
  }

  async getHealth(): Promise<RuntimeHealth> {
    return this.getAdapter().getHealth();
  }

  async setup() {
    return this.#processManager.setup();
  }

  async restart() {
    return this.#processManager.restart();
  }
}
