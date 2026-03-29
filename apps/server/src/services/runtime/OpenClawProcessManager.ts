import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RuntimeHealth } from "@nova/shared";
import type { AppEnv } from "../../env.js";
import { nowIso } from "../../lib/utils.js";

const execFileAsync = promisify(execFile);

export class OpenClawProcessManager {
  #env: AppEnv;
  #lastHealth: RuntimeHealth | null = null;

  constructor(env: AppEnv) {
    this.#env = env;
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
        details: ["Mock runtime mode is enabled."],
        updatedAt: nowIso(),
      };
    }

    try {
      const { stdout } = await execFileAsync(this.#env.openclawBinaryPath, [
        "--version",
      ]);

      const health: RuntimeHealth = {
        status: "healthy",
        mode: "openclaw",
        profile: this.#env.openclawProfile,
        gatewayUrl: this.#env.openclawGatewayUrl,
        binaryPath: this.#env.openclawBinaryPath,
        binaryVersion: stdout.trim() || null,
        details: this.#env.enableOpenClawSmoke
          ? ["OpenClaw binary detected. Full smoke checks are not implemented yet."]
          : ["OpenClaw binary detected."],
        updatedAt: nowIso(),
      };

      this.#lastHealth = health;
      return health;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "OpenClaw binary detection failed.";
      const health: RuntimeHealth = {
        status: "missing_binary",
        mode: "openclaw",
        profile: this.#env.openclawProfile,
        gatewayUrl: this.#env.openclawGatewayUrl,
        binaryPath: this.#env.openclawBinaryPath,
        binaryVersion: null,
        details: [message],
        updatedAt: nowIso(),
      };

      this.#lastHealth = health;
      return health;
    }
  }

  async setup() {
    return this.getHealth();
  }

  async restart() {
    return this.getHealth();
  }
}
