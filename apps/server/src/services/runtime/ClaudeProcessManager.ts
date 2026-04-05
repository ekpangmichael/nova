import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { promisify } from "node:util";
import type { RuntimeHealth } from "@nova/shared";
import type { AppEnv } from "../../env.js";
import { normalizeClaudeModelId } from "../../env.js";
import { nowIso } from "../../lib/utils.js";

const execFileAsync = promisify(execFile);

export type ClaudeLoginSummary = {
  status: "logged_in" | "logged_out" | "unknown";
  authMode: string | null;
  email: string | null;
  subscriptionType: string | null;
  message: string;
};

export type ClaudeDetectedConfig = {
  binaryPath: string;
  stateDir: string;
  configPath: string;
  defaultModel: string | null;
};

type ClaudeAuthStatusPayload = {
  loggedIn?: boolean;
  authMethod?: string | null;
  email?: string | null;
  subscriptionType?: string | null;
};

type ClaudeSettingsPayload = {
  defaultModel?: string;
  model?: string;
  preferredModel?: string;
  primaryModel?: string;
};

export class ClaudeProcessManager {
  static #HEALTH_CACHE_TTL_MS = 10_000;

  #env: AppEnv;
  #lastHealth: RuntimeHealth | null = null;
  #lastHealthAt = 0;

  constructor(env: AppEnv) {
    this.#env = env;
  }

  async getBinaryVersion(): Promise<string | null> {
    try {
      const { stdout } = await this.run(["--version"]);
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  getDetectedConfig(): ClaudeDetectedConfig {
    return {
      binaryPath: this.#env.claudeBinaryPath,
      stateDir: this.#env.claudeStateDir,
      configPath: this.#env.claudeConfigPath,
      defaultModel:
        normalizeClaudeModelId(
          this.#readDefaultModelFromConfig(this.#env.claudeConfigPath)
        ) ?? normalizeClaudeModelId(this.#env.claudeDefaultModel),
    };
  }

  async getLoginSummary(): Promise<ClaudeLoginSummary> {
    try {
      const { stdout } = await this.run(["auth", "status"]);
      const parsed = JSON.parse(stdout) as ClaudeAuthStatusPayload;

      if (parsed.loggedIn) {
        const planSuffix = parsed.subscriptionType
          ? ` (${parsed.subscriptionType})`
          : "";

        return {
          status: "logged_in",
          authMode: parsed.authMethod ?? null,
          email: parsed.email ?? null,
          subscriptionType: parsed.subscriptionType ?? null,
          message: `Logged in using ${parsed.authMethod ?? "Claude"}${planSuffix}`,
        };
      }

      return {
        status: "logged_out",
        authMode: parsed.authMethod ?? null,
        email: parsed.email ?? null,
        subscriptionType: parsed.subscriptionType ?? null,
        message: "Claude Code is installed but not signed in.",
      };
    } catch {
      return {
        status: "unknown",
        authMode: null,
        email: null,
        subscriptionType: null,
        message: "Claude login status is unavailable.",
      };
    }
  }

  async getHealth(): Promise<RuntimeHealth> {
    if (
      this.#lastHealth &&
      Date.now() - this.#lastHealthAt < ClaudeProcessManager.#HEALTH_CACHE_TTL_MS
    ) {
      return this.#lastHealth;
    }

    const binaryVersion = await this.getBinaryVersion();

    if (!binaryVersion) {
      const health: RuntimeHealth = {
        status: "missing_binary",
        mode: "claude",
        profile: "local-account",
        gatewayUrl: null,
        binaryPath: this.#env.claudeBinaryPath,
        binaryVersion: null,
        configPath: this.#env.claudeConfigPath,
        stateDir: this.#env.claudeStateDir,
        details: ["Claude Code CLI was not found on this system."],
        updatedAt: nowIso(),
      };
      this.#lastHealth = health;
      this.#lastHealthAt = Date.now();
      return health;
    }

    const login = await this.getLoginSummary();

    const health: RuntimeHealth = {
      status:
        login.status === "logged_in"
          ? "healthy"
          : login.status === "logged_out"
            ? "degraded"
            : "error",
      mode: "claude",
      profile: "local-account",
      gatewayUrl: null,
      binaryPath: this.#env.claudeBinaryPath,
      binaryVersion,
      configPath: this.#env.claudeConfigPath,
      stateDir: this.#env.claudeStateDir,
      details: [
        login.message,
        login.email ? `Account: ${login.email}` : "",
      ].filter(Boolean),
      updatedAt: nowIso(),
    };

    this.#lastHealth = health;
    this.#lastHealthAt = Date.now();
    return health;
  }

  clearCache() {
    this.#lastHealth = null;
    this.#lastHealthAt = 0;
  }

  async run(args: string[]) {
    const { stdout, stderr } = await execFileAsync(this.#env.claudeBinaryPath, args, {
      env: process.env,
    });

    return {
      stdout: stdout.toString(),
      stderr: stderr.toString(),
    };
  }

  #readDefaultModelFromConfig(path: string) {
    if (!existsSync(path)) {
      return null;
    }

    try {
      const parsed = JSON.parse(
        readFileSync(path, "utf8")
      ) as ClaudeSettingsPayload;

      return normalizeClaudeModelId(
        parsed.defaultModel?.trim() ||
          parsed.model?.trim() ||
          parsed.preferredModel?.trim() ||
          parsed.primaryModel?.trim() ||
          null
      );
    } catch {
      return null;
    }
  }
}
