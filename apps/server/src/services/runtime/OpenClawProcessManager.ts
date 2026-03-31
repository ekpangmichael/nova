import { execFile } from "node:child_process";
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

export type OpenClawCommandResult = {
  stdout: string;
  stderr: string;
};

export class OpenClawProcessManager {
  #env: AppEnv;
  #lastHealth: RuntimeHealth | null = null;

  constructor(env: AppEnv) {
    this.#env = env;
  }

  async getBinaryVersion(): Promise<string | null> {
    try {
      const result = await this.run(["--version"]);
      return result.stdout.trim() || null;
    } catch {
      return null;
    }
  }

  async getGatewayStatus(): Promise<OpenClawGatewayStatus | null> {
    try {
      return await this.runJson<OpenClawGatewayStatus>([
        "gateway",
        "status",
        "--json",
      ]);
    } catch {
      return null;
    }
  }

  async listAgents(): Promise<OpenClawAgentListItem[]> {
    try {
      return await this.runJson<OpenClawAgentListItem[]>([
        "agents",
        "list",
        "--json",
      ]);
    } catch {
      return [];
    }
  }

  async listModels(): Promise<NonNullable<OpenClawModelsList["models"]>> {
    try {
      const payload = await this.runJson<OpenClawModelsList>([
        "models",
        "list",
        "--json",
      ]);
      return payload.models ?? [];
    } catch {
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

    return this.runJson<Record<string, unknown>>(args);
  }

  async deleteAgent(runtimeAgentId: string) {
    await this.run([
      "agents",
      "delete",
      runtimeAgentId,
      "--force",
      "--json",
    ]);
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
    if (this.#env.runtimeMode === "mock") {
      return {
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
    }

    const binaryVersion = await this.getBinaryVersion();

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
      return health;
    }

    const gatewayStatus = await this.getGatewayStatus();
    const gatewayUrl =
      this.#env.openclawGatewayUrl ??
      gatewayStatus?.rpc?.url ??
      gatewayStatus?.gateway?.probeUrl ??
      null;
    const details =
      gatewayStatus?.service?.configAudit?.issues?.map((issue) =>
        issue.detail ? `${issue.message} (${issue.detail})` : issue.message ?? ""
      ).filter(Boolean) ?? [];

    const health: RuntimeHealth = {
      status:
        gatewayStatus?.health?.healthy && gatewayStatus?.rpc?.ok
          ? "healthy"
          : "degraded",
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
          : gatewayStatus?.health?.healthy
            ? ["OpenClaw gateway is reachable."]
            : ["OpenClaw gateway is not healthy or not reachable."],
      updatedAt: nowIso(),
    };

    this.#lastHealth = health;
    return health;
  }

  async setup() {
    return this.getHealth();
  }

  async restart() {
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

  #buildCommandEnv() {
    return {
      ...process.env,
      OPENCLAW_CONFIG_PATH: this.#env.openclawConfigPath,
      OPENCLAW_STATE_DIR: this.#env.openclawStateDir,
    };
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
}
