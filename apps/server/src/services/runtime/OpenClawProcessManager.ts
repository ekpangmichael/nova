import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import type { RuntimeHealth } from "@nova/shared";
import type { AppEnv } from "../../env.js";
import { nowIso } from "../../lib/utils.js";

const execFileAsync = promisify(execFile);

type OpenClawGatewayStatus = {
  config?: {
    cli?: {
      path?: string;
      exists?: boolean;
      valid?: boolean;
    };
  };
  gateway?: {
    bindMode?: string;
    bindHost?: string;
    port?: number;
    probeUrl?: string;
  };
  port?: {
    status?: string;
  };
  rpc?: {
    ok?: boolean;
    url?: string;
  };
  health?: {
    healthy?: boolean;
  };
  service?: {
    configAudit?: {
      issues?: Array<{
        message?: string;
        detail?: string;
        level?: string;
      }>;
    };
  };
};

type OpenClawAgentListItem = {
  id: string;
  identityName?: string | null;
  workspace?: string | null;
  agentDir?: string | null;
  model?: string | null;
  isDefault?: boolean;
};

type OpenClawModelsList = {
  count?: number;
  models?: Array<{
    key: string;
    name?: string;
    input?: string;
    contextWindow?: number;
    local?: boolean;
    available?: boolean;
    tags?: string[];
    missing?: boolean;
  }>;
};

type OpenClawConfigEntry = {
  id?: string;
  workspace?: string | null;
  agentDir?: string | null;
  subagents?: {
    allowAgents?: string[];
  };
  [key: string]: unknown;
};

type OpenClawConfigFile = {
  list?: OpenClawConfigEntry[];
  agents?: {
    list?: OpenClawConfigEntry[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type OpenClawCommandResult = {
  stdout: string;
  stderr: string;
};

export class OpenClawProcessManager {
  static #HEALTH_CACHE_TTL_MS = 10_000;
  static #BINARY_VERSION_CACHE_TTL_MS = 5 * 60_000;
  static #GATEWAY_STATUS_CACHE_TTL_MS = 10_000;
  static #AGENT_LIST_CACHE_TTL_MS = 60_000;
  static #MODEL_LIST_CACHE_TTL_MS = 5 * 60_000;
  #env: AppEnv;
  #lastHealth: RuntimeHealth | null = null;
  #lastHealthAt = 0;
  #lastBinaryVersion: string | null = null;
  #lastBinaryVersionAt = 0;
  #lastGatewayStatus: OpenClawGatewayStatus | null = null;
  #lastGatewayStatusAt = 0;
  #lastAgentList: OpenClawAgentListItem[] | null = null;
  #lastAgentListAt = 0;
  #lastModelList: NonNullable<OpenClawModelsList["models"]> | null = null;
  #lastModelListAt = 0;

  constructor(env: AppEnv) {
    this.#env = env;
  }

  async getBinaryVersion(): Promise<string | null> {
    if (
      this.#lastBinaryVersionAt > 0 &&
      Date.now() - this.#lastBinaryVersionAt <
        OpenClawProcessManager.#BINARY_VERSION_CACHE_TTL_MS
    ) {
      return this.#lastBinaryVersion;
    }

    try {
      const result = await this.run(["--version"]);
      this.#lastBinaryVersion = result.stdout.trim() || null;
      this.#lastBinaryVersionAt = Date.now();
      return this.#lastBinaryVersion;
    } catch {
      this.#lastBinaryVersion = null;
      this.#lastBinaryVersionAt = Date.now();
      return null;
    }
  }

  async getGatewayStatus(): Promise<OpenClawGatewayStatus | null> {
    if (
      this.#lastGatewayStatusAt > 0 &&
      Date.now() - this.#lastGatewayStatusAt <
        OpenClawProcessManager.#GATEWAY_STATUS_CACHE_TTL_MS
    ) {
      return this.#lastGatewayStatus;
    }

    try {
      this.#lastGatewayStatus = await this.runJson<OpenClawGatewayStatus>([
        "gateway",
        "status",
        "--json",
      ]);
      this.#lastGatewayStatusAt = Date.now();
      return this.#lastGatewayStatus;
    } catch {
      this.#lastGatewayStatus = null;
      this.#lastGatewayStatusAt = Date.now();
      return null;
    }
  }

  async listAgents(): Promise<OpenClawAgentListItem[]> {
    if (
      this.#lastAgentListAt > 0 &&
      this.#lastAgentList &&
      Date.now() - this.#lastAgentListAt <
        OpenClawProcessManager.#AGENT_LIST_CACHE_TTL_MS
    ) {
      return this.#lastAgentList;
    }

    try {
      this.#lastAgentList = await this.runJson<OpenClawAgentListItem[]>([
        "agents",
        "list",
        "--json",
      ]);
      this.#lastAgentListAt = Date.now();
      return this.#lastAgentList;
    } catch {
      this.#lastAgentList = [];
      this.#lastAgentListAt = Date.now();
      return [];
    }
  }

  async listModels(): Promise<NonNullable<OpenClawModelsList["models"]>> {
    if (
      this.#lastModelListAt > 0 &&
      this.#lastModelList &&
      Date.now() - this.#lastModelListAt <
        OpenClawProcessManager.#MODEL_LIST_CACHE_TTL_MS
    ) {
      return this.#lastModelList;
    }

    try {
      const payload = await this.runJson<OpenClawModelsList>([
        "models",
        "list",
        "--json",
      ]);
      this.#lastModelList = payload.models ?? [];
      this.#lastModelListAt = Date.now();
      return this.#lastModelList;
    } catch {
      this.#lastModelList = [];
      this.#lastModelListAt = Date.now();
      return [];
    }
  }

  async provisionAgent(input: {
    runtimeAgentId: string;
    workspacePath: string;
    runtimeStatePath: string;
    defaultModelId?: string | null;
  }) {
    const args = [
      "agents",
      "add",
      input.runtimeAgentId,
      "--workspace",
      input.workspacePath,
      "--agent-dir",
      input.runtimeStatePath,
      "--non-interactive",
      "--json",
    ];

    if (input.defaultModelId) {
      args.push("--model", input.defaultModelId);
    }

    const result = await this.runJson<Record<string, unknown>>(args);
    await this.ensureMainAgentCanInvoke(input.runtimeAgentId);
    await this.#restartAfterAgentMutation();
    return result;
  }

  async deleteAgent(runtimeAgentId: string) {
    let cliError: Error | null = null;

    try {
      await this.run([
        "agents",
        "delete",
        runtimeAgentId,
        "--force",
        "--json",
      ]);
    } catch (error) {
      cliError = error instanceof Error ? error : new Error(String(error));
    }

    const removedConfig = await this.removeAgentFromConfig(runtimeAgentId);
    await this.removeAgentLocalFiles(runtimeAgentId, removedConfig);

    await this.#restartAfterAgentMutation();

    if (cliError && !removedConfig.changed) {
      throw cliError;
    }
  }

  async setIdentityFromWorkspace(input: {
    runtimeAgentId: string;
    workspacePath: string;
  }) {
    await this.run([
      "agents",
      "set-identity",
      "--agent",
      input.runtimeAgentId,
      "--workspace",
      input.workspacePath,
      "--from-identity",
      "--json",
    ]);
  }

  async setIdentity(input: {
    runtimeAgentId: string;
    identity: {
      name?: string;
      theme?: string;
      emoji?: string;
      avatar?: string;
    };
  }) {
    const args = ["agents", "set-identity", "--agent", input.runtimeAgentId];

    if (input.identity.name) {
      args.push("--name", input.identity.name);
    }

    if (input.identity.theme) {
      args.push("--theme", input.identity.theme);
    }

    if (input.identity.emoji) {
      args.push("--emoji", input.identity.emoji);
    }

    if (input.identity.avatar) {
      args.push("--avatar", input.identity.avatar);
    }

    args.push("--json");

    await this.run(args);
    this.#invalidateAgentListCache();
  }

  async run(args: string[]): Promise<OpenClawCommandResult> {
    const { stdout, stderr } = await execFileAsync(this.#env.openclawBinaryPath, args, {
      env: this.#buildCommandEnv(),
    });

    return {
      stdout: stdout.toString(),
      stderr: stderr.toString(),
    };
  }

  async runJson<T>(args: string[]): Promise<T> {
    const result = await this.run(args);
    const payload = this.#extractJsonPayload(`${result.stdout}\n${result.stderr}`);

    return JSON.parse(payload) as T;
  }

  async getHealth(): Promise<RuntimeHealth> {
    if (
      this.#lastHealth &&
      Date.now() - this.#lastHealthAt < OpenClawProcessManager.#HEALTH_CACHE_TTL_MS
    ) {
      return this.#lastHealth;
    }

    if (this.#env.runtimeMode === "mock") {
      const health: RuntimeHealth = {
        status: "healthy",
        mode: "mock",
        profile: this.#env.openclawProfile,
        gatewayUrl: this.#env.openclawGatewayUrl,
        binaryPath: this.#env.openclawBinaryPath,
        binaryVersion: null,
        configPath: this.#env.openclawConfigPath,
        stateDir: this.#env.openclawStateDir,
        details: ["Mock runtime mode is enabled."],
        updatedAt: nowIso(),
      };
      this.#lastHealth = health;
      this.#lastHealthAt = Date.now();
      return health;
    }

    const [binaryVersion, gatewayStatus] = await Promise.all([
      this.getBinaryVersion(),
      this.getGatewayStatus(),
    ]);

    if (!binaryVersion) {
      const health: RuntimeHealth = {
        status: "missing_binary",
        mode: "openclaw",
        profile: this.#env.openclawProfile,
        gatewayUrl: this.#env.openclawGatewayUrl,
        binaryPath: this.#env.openclawBinaryPath,
        binaryVersion: null,
        configPath: this.#env.openclawConfigPath,
        stateDir: this.#env.openclawStateDir,
        details: ["OpenClaw binary detection failed."],
        updatedAt: nowIso(),
      };

      this.#lastHealth = health;
      this.#lastHealthAt = Date.now();
      return health;
    }

    const gatewayUrl =
      this.#env.openclawGatewayUrl ??
      gatewayStatus?.rpc?.url ??
      gatewayStatus?.gateway?.probeUrl ??
      null;
    const details =
      gatewayStatus?.service?.configAudit?.issues?.map((issue) =>
        issue.detail ? `${issue.message} (${issue.detail})` : issue.message ?? ""
      ).filter(Boolean) ?? [];

    const isRpcReachable = Boolean(gatewayStatus?.rpc?.ok);
    const health: RuntimeHealth = {
      status: isRpcReachable ? "healthy" : "degraded",
      mode: "openclaw",
      profile: this.#env.openclawProfile,
      gatewayUrl,
      binaryPath: this.#env.openclawBinaryPath,
      binaryVersion,
      configPath:
        gatewayStatus?.config?.cli?.path ?? this.#env.openclawConfigPath,
      stateDir: this.#env.openclawStateDir,
      details:
        details.length > 0
          ? details
          : isRpcReachable
            ? ["OpenClaw gateway is reachable."]
            : ["OpenClaw gateway is not healthy or not reachable."],
      updatedAt: nowIso(),
    };

    this.#lastHealth = health;
    this.#lastHealthAt = Date.now();
    return health;
  }

  async setup() {
    return this.getHealth();
  }

  async restart() {
    this.#resetCaches();

    if (this.#env.runtimeMode === "mock") {
      return this.getHealth();
    }

    try {
      await this.run(["gateway", "restart"]);
    } catch {
      return this.getHealth();
    }

    return this.getHealth();
  }

  async ensureMainAgentCanInvoke(runtimeAgentId: string) {
    const changed = await this.#mutateConfig((config) => {
      const list = this.#getAgentConfigList(config);
      const mainIndex = list.findIndex((entry) => entry?.id === "main");

      if (mainIndex < 0) {
        return { config, changed: false };
      }

      const main = this.#normalizeConfigEntry(list[mainIndex]);
      const subagents =
        main.subagents && typeof main.subagents === "object"
          ? { ...main.subagents }
          : {};
      const existingAllowAgents = Array.isArray(subagents.allowAgents)
        ? subagents.allowAgents.filter(
            (value): value is string => typeof value === "string" && value.trim().length > 0
          )
        : [];

      if (existingAllowAgents.includes(runtimeAgentId)) {
        return { config, changed: false };
      }

      subagents.allowAgents = [...existingAllowAgents, runtimeAgentId];
      list[mainIndex] = {
        ...main,
        subagents,
      };

      return {
        config: this.#setAgentConfigList(config, list),
        changed: true,
      };
    });

    if (changed) {
      await this.#restartAfterConfigMutation();
    }
  }

  async removeAgentFromConfig(runtimeAgentId: string) {
    let removedWorkspacePath: string | null = null;
    let removedAgentDirPath: string | null = null;

    const changed = await this.#mutateConfig((config) => {
      const list = this.#getAgentConfigList(config);
      let mutated = false;

      const filteredList = list
        .filter((entry) => {
          if (entry?.id === runtimeAgentId) {
            const normalized = this.#normalizeConfigEntry(entry);
            removedWorkspacePath =
              typeof normalized.workspace === "string" ? normalized.workspace : null;
            removedAgentDirPath =
              typeof normalized.agentDir === "string" ? normalized.agentDir : null;
            mutated = true;
            return false;
          }

          return true;
        })
        .map((entry) => {
          const normalized = this.#normalizeConfigEntry(entry);

          if (
            normalized.subagents &&
            typeof normalized.subagents === "object" &&
            Array.isArray(normalized.subagents.allowAgents) &&
            normalized.subagents.allowAgents.includes(runtimeAgentId)
          ) {
            mutated = true;
            return {
              ...normalized,
              subagents: {
                ...normalized.subagents,
                allowAgents: normalized.subagents.allowAgents.filter(
                  (value) => value !== runtimeAgentId
                ),
              },
            };
          }

          return normalized;
        });

      return {
        config: mutated ? this.#setAgentConfigList(config, filteredList) : config,
        changed: mutated,
      };
    });

    if (changed) {
      await this.#restartAfterConfigMutation();
    }

    return {
      changed,
      workspacePath: removedWorkspacePath,
      agentDirPath: removedAgentDirPath,
    };
  }

  async removeAgentLocalFiles(
    runtimeAgentId: string,
    configPaths?: {
      workspacePath?: string | null;
      agentDirPath?: string | null;
    }
  ) {
    const candidatePaths = new Set<string>();

    const addCandidate = (value: string | null | undefined) => {
      if (!value || !value.trim()) {
        return;
      }

      const resolvedPath = resolve(value);

      if (!this.#pathIsInsideOpenClawStateDir(resolvedPath)) {
        return;
      }

      candidatePaths.add(resolvedPath);
    };

    addCandidate(configPaths?.workspacePath ?? null);
    addCandidate(configPaths?.agentDirPath ?? null);
    if (configPaths?.agentDirPath) {
      addCandidate(dirname(configPaths.agentDirPath));
    }
    addCandidate(`${this.#env.openclawStateDir}/workspace-${runtimeAgentId}`);
    addCandidate(`${this.#env.openclawStateDir}/agents/${runtimeAgentId}/agent`);
    addCandidate(`${this.#env.openclawStateDir}/agents/${runtimeAgentId}`);

    for (const targetPath of candidatePaths) {
      await rm(targetPath, { recursive: true, force: true });
    }
  }

  #buildCommandEnv() {
    return {
      ...process.env,
      OPENCLAW_CONFIG_PATH: this.#env.openclawConfigPath,
      OPENCLAW_STATE_DIR: this.#env.openclawStateDir,
    };
  }

  async #mutateConfig(
    mutate: (config: OpenClawConfigFile) => {
      config: OpenClawConfigFile;
      changed: boolean;
    }
  ) {
    const config = await this.#readConfigFile();
    const result = mutate(config);

    if (!result.changed) {
      return false;
    }

    await mkdir(dirname(this.#env.openclawConfigPath), { recursive: true });
    await writeFile(
      this.#env.openclawConfigPath,
      `${JSON.stringify(result.config, null, 2)}\n`,
      "utf8"
    );

    return true;
  }

  async #readConfigFile(): Promise<OpenClawConfigFile> {
    try {
      const raw = await readFile(this.#env.openclawConfigPath, "utf8");
      const parsed = JSON.parse(raw) as OpenClawConfigFile;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return {};
      }

      throw error;
    }
  }

  #normalizeConfigEntry(entry: OpenClawConfigEntry | null | undefined): OpenClawConfigEntry {
    return entry && typeof entry === "object" ? { ...entry } : {};
  }

  #getAgentConfigList(config: OpenClawConfigFile) {
    if (config.agents && typeof config.agents === "object" && Array.isArray(config.agents.list)) {
      return [...config.agents.list];
    }

    return Array.isArray(config.list) ? [...config.list] : [];
  }

  #setAgentConfigList(config: OpenClawConfigFile, list: OpenClawConfigEntry[]): OpenClawConfigFile {
    if (config.agents && typeof config.agents === "object") {
      return {
        ...config,
        agents: {
          ...config.agents,
          list,
        },
      };
    }

    return {
      ...config,
      list,
    };
  }

  #pathIsInsideOpenClawStateDir(candidatePath: string) {
    const stateDir = resolve(this.#env.openclawStateDir);
    const relativePath = relative(stateDir, candidatePath);

    return (
      relativePath === "" ||
      (!relativePath.startsWith("..") && !relativePath.startsWith("../"))
    );
  }

  async #restartAfterConfigMutation() {
    this.#resetCaches();

    if (this.#env.runtimeMode === "mock") {
      return;
    }

    try {
      await this.restart();
    } catch {
      // Keep config reconciliation best-effort; the next health probe will surface issues.
    }
  }

  async #restartAfterAgentMutation() {
    this.#resetCaches();

    if (this.#env.runtimeMode === "mock") {
      return;
    }

    try {
      await this.restart();
    } catch {
      // Keep agent mutation best-effort; health and runtime checks will surface failures.
    }
  }

  #extractJsonPayload(text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      if (!line.startsWith("{") && !line.startsWith("[")) {
        continue;
      }

      for (let end = lines.length; end > index; end -= 1) {
        const candidate = lines.slice(index, end).join("\n");

        try {
          JSON.parse(candidate);
          return candidate;
        } catch {
          continue;
        }
      }
    }

    throw new Error("OpenClaw command did not return valid JSON.");
  }

  #invalidateAgentListCache() {
    this.#lastAgentList = null;
    this.#lastAgentListAt = 0;
  }

  #resetCaches() {
    this.#lastHealth = null;
    this.#lastHealthAt = 0;
    this.#lastBinaryVersion = null;
    this.#lastBinaryVersionAt = 0;
    this.#lastGatewayStatus = null;
    this.#lastGatewayStatusAt = 0;
    this.#lastAgentList = null;
    this.#lastAgentListAt = 0;
    this.#lastModelList = null;
    this.#lastModelListAt = 0;
  }
}
