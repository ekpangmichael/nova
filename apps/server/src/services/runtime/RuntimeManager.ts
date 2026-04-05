import type { RuntimeAdapter, RuntimeCatalog, RuntimeSummary } from "@nova/runtime-adapter";
import type { RuntimeHealth, RuntimeKind } from "@nova/shared";
import type { AppEnv } from "../../env.js";
import { badRequest } from "../../lib/errors.js";
import { ClaudeProcessManager } from "./ClaudeProcessManager.js";
import { ClaudeRuntimeAdapter } from "./ClaudeRuntimeAdapter.js";
import { CodexProcessManager } from "./CodexProcessManager.js";
import { CodexRuntimeAdapter } from "./CodexRuntimeAdapter.js";
import { MockRuntimeAdapter } from "./MockRuntimeAdapter.js";
import { OpenClawNativeAdapter } from "./OpenClawNativeAdapter.js";
import { OpenClawProcessManager } from "./OpenClawProcessManager.js";

export class RuntimeManager {
  #env: AppEnv;
  #openClawProcessManager: OpenClawProcessManager;
  #codexProcessManager: CodexProcessManager;
  #claudeProcessManager: ClaudeProcessManager;
  #mockAdapter: MockRuntimeAdapter;
  #openClawAdapter: OpenClawNativeAdapter;
  #codexAdapter: CodexRuntimeAdapter;
  #claudeAdapter: ClaudeRuntimeAdapter;

  constructor(env: AppEnv) {
    this.#env = env;
    this.#openClawProcessManager = new OpenClawProcessManager(env);
    this.#codexProcessManager = new CodexProcessManager(env);
    this.#claudeProcessManager = new ClaudeProcessManager(env);
    this.#mockAdapter = new MockRuntimeAdapter();
    this.#openClawAdapter = new OpenClawNativeAdapter(
      env,
      this.#openClawProcessManager
    );
    this.#codexAdapter = new CodexRuntimeAdapter(env, this.#codexProcessManager);
    this.#claudeAdapter = new ClaudeRuntimeAdapter(env, this.#claudeProcessManager);
  }

  getAdapter(kind: RuntimeKind = "openclaw-native"): RuntimeAdapter {
    if (kind === "codex") {
      return this.#codexAdapter;
    }

    if (kind === "claude-code") {
      return this.#claudeAdapter;
    }

    if (kind === "openclaw-native") {
      return this.#env.runtimeMode === "mock"
        ? this.#mockAdapter
        : this.#openClawAdapter;
    }

    throw badRequest(`Runtime ${kind} is not implemented yet.`);
  }

  async listRuntimes(): Promise<RuntimeSummary[]> {
    return Promise.all([
      this.getAdapter("openclaw-native").getSummary(),
      this.getAdapter("codex").getSummary(),
      this.getAdapter("claude-code").getSummary(),
    ]);
  }

  async getOpenClawCatalog(): Promise<RuntimeCatalog> {
    return this.getAdapter("openclaw-native").getCatalog();
  }

  async getCodexCatalog(): Promise<RuntimeCatalog> {
    return this.getAdapter("codex").getCatalog();
  }

  async getClaudeCatalog(): Promise<RuntimeCatalog> {
    return this.getAdapter("claude-code").getCatalog();
  }

  async getCodexLogin() {
    return this.#codexProcessManager.getLoginSummary();
  }

  async getClaudeLogin() {
    return this.#claudeProcessManager.getLoginSummary();
  }

  async getHealth(): Promise<RuntimeHealth> {
    return this.getAdapter("openclaw-native").getHealth();
  }

  async getCodexHealth(): Promise<RuntimeHealth> {
    return this.getAdapter("codex").getHealth();
  }

  async getClaudeHealth(): Promise<RuntimeHealth> {
    return this.getAdapter("claude-code").getHealth();
  }

  async setup() {
    return this.#openClawProcessManager.setup();
  }

  async restart() {
    return this.#openClawProcessManager.restart();
  }

  async reconfigure() {
    await this.#openClawAdapter.close();
    this.#openClawProcessManager = new OpenClawProcessManager(this.#env);
    this.#codexProcessManager = new CodexProcessManager(this.#env);
    this.#claudeProcessManager = new ClaudeProcessManager(this.#env);
    this.#openClawAdapter = new OpenClawNativeAdapter(
      this.#env,
      this.#openClawProcessManager
    );
    this.#codexAdapter = new CodexRuntimeAdapter(this.#env, this.#codexProcessManager);
    this.#claudeAdapter = new ClaudeRuntimeAdapter(this.#env, this.#claudeProcessManager);
  }

  async close() {
    await this.#openClawAdapter.close();
  }
}
