import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import type { RuntimeHealth } from "@nova/shared";
import type { AppEnv } from "../../env.js";
import { nowIso } from "../../lib/utils.js";

const execFileAsync = promisify(execFile);

export type CodexLoginSummary = {
  status: "logged_in" | "logged_out" | "unknown";
  authMode: string | null;
  lastRefresh: string | null;
  message: string;
};

export type CodexDetectedConfig = {
  binaryPath: string;
  stateDir: string;
  configPath: string;
  defaultModel: string | null;
};

type CodexAuthFile = {
  auth_mode?: string;
  tokens?: Record<string, unknown> | null;
  last_refresh?: string | null;
};

export class CodexProcessManager {
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

  getDetectedConfig(): CodexDetectedConfig {
    return {
      binaryPath: this.#env.codexBinaryPath,
      stateDir: this.#env.codexStateDir,
      configPath: this.#env.codexConfigPath,
      defaultModel:
        this.#readDefaultModelFromConfig(this.#env.codexConfigPath) ??
        this.#env.codexDefaultModel,
    };
  }

  async getLoginSummary(): Promise<CodexLoginSummary> {
    const authPath = join(this.#env.codexStateDir, "auth.json");
    const authFile = this.#readAuthFile(authPath);

    if (authFile?.tokens && authFile.auth_mode) {
      return {
        status: "logged_in",
        authMode: authFile.auth_mode,
        lastRefresh: authFile.last_refresh ?? null,
        message:
          authFile.auth_mode === "chatgpt"
            ? "Logged in using ChatGPT"
            : "Codex authentication is available.",
      };
    }

    try {
      const { stdout, stderr } = await this.run(["login", "status"]);
      const message = `${stdout}\n${stderr}`.trim() || "Codex login status is unknown.";
      const normalized = message.toLowerCase();

      if (normalized.includes("logged in")) {
        return {
          status: "logged_in",
          authMode: authFile?.auth_mode ?? null,
          lastRefresh: authFile?.last_refresh ?? null,
          message,
        };
      }

      return {
        status: "logged_out",
        authMode: authFile?.auth_mode ?? null,
        lastRefresh: authFile?.last_refresh ?? null,
        message,
      };
    } catch {
      return {
        status: authFile ? "logged_out" : "unknown",
        authMode: authFile?.auth_mode ?? null,
        lastRefresh: authFile?.last_refresh ?? null,
        message: authFile
          ? "Codex auth data exists, but CLI login status could not be verified."
          : "Codex login status is unavailable.",
      };
    }
  }

  async getHealth(): Promise<RuntimeHealth> {
    if (
      this.#lastHealth &&
      Date.now() - this.#lastHealthAt < CodexProcessManager.#HEALTH_CACHE_TTL_MS
    ) {
      return this.#lastHealth;
    }

    const binaryVersion = await this.getBinaryVersion();

    if (!binaryVersion) {
      const health: RuntimeHealth = {
        status: "missing_binary",
        mode: "codex",
        profile: "local-account",
        gatewayUrl: null,
        binaryPath: this.#env.codexBinaryPath,
        binaryVersion: null,
        configPath: this.#env.codexConfigPath,
        stateDir: this.#env.codexStateDir,
        details: ["Codex CLI was not found on this system."],
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
      mode: "codex",
      profile: "local-account",
      gatewayUrl: null,
      binaryPath: this.#env.codexBinaryPath,
      binaryVersion,
      configPath: this.#env.codexConfigPath,
      stateDir: this.#env.codexStateDir,
      details: [
        login.message,
        login.lastRefresh ? `Last auth refresh: ${login.lastRefresh}` : "",
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
    const { stdout, stderr } = await execFileAsync(this.#env.codexBinaryPath, args, {
      env: process.env,
    });

    return {
      stdout: stdout.toString(),
      stderr: stderr.toString(),
    };
  }

  #readAuthFile(path: string): CodexAuthFile | null {
    if (!existsSync(path)) {
      return null;
    }

    try {
      return JSON.parse(readFileSync(path, "utf8")) as CodexAuthFile;
    } catch {
      return null;
    }
  }

  #readDefaultModelFromConfig(path: string) {
    if (!existsSync(path)) {
      return null;
    }

    try {
      const raw = readFileSync(path, "utf8");
      const match = raw.match(/^\s*model\s*=\s*"([^"]+)"/m);
      return match?.[1]?.trim() || null;
    } catch {
      return null;
    }
  }
}
