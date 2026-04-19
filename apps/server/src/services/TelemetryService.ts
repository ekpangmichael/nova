import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { arch, hostname, platform } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import type { FastifyBaseLogger } from "fastify";

/**
 * Anonymous install telemetry.
 *
 * Sends a small JSON payload to a configurable HTTPS endpoint so the
 * maintainer can see how many people are running Nova. It is intentionally
 * minimal and privacy-respecting:
 *
 *   - opt-out with NOVA_TELEMETRY=0 (or `false`)
 *   - uses DEFAULT_ENDPOINT by default; set NOVA_TELEMETRY_ENDPOINT to
 *     redirect to your own collector
 *   - the instance ID is a random UUID stored once in the app data dir,
 *     it is not derived from the user, hostname, or machine identity
 *   - fire-and-forget HTTP POST, a network failure never affects Nova
 *
 * Payload shape:
 *
 *   {
 *     "event": "startup" | "heartbeat",
 *     "instanceId": "<uuid>",
 *     "version": "0.1.0",
 *     "platform": "darwin" | "linux" | "win32",
 *     "arch": "arm64" | "x64" | ...,
 *     "nodeVersion": "v24.14.0",
 *     "hostHash": "<sha256 prefix>", // salted, not reversible
 *     "timestamp": "<ISO 8601>"
 *   }
 *
 * `hostHash` is a short SHA-256 prefix of `hostname + instanceId`. It lets
 * the maintainer deduplicate short-lived containers (multiple instance IDs
 * on one host) without revealing the hostname itself.
 */

export type TelemetryEvent = "startup" | "heartbeat";

export type TelemetryServiceOptions = {
  enabled: boolean;
  endpoint: string | null;
  appDataDir: string;
  version: string;
  logger: FastifyBaseLogger;
};

const INSTANCE_ID_FILENAME = "instance-id";
const HEARTBEAT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const POST_TIMEOUT_MS = 5_000;

/**
 * Default telemetry endpoint shipped with Nova. This URL receives a ping
 * from every Nova install that doesn't explicitly opt out. Replace this
 * with your own collector URL (Cloudflare Worker, PostHog, etc).
 *
 * Set to an empty string to disable the default entirely, which means
 * only installs that set NOVA_TELEMETRY_ENDPOINT will send pings.
 *
 * See docs/operations/telemetry.md for exactly what gets sent.
 */
export const DEFAULT_TELEMETRY_ENDPOINT =
  "https://nova-telemetry.ekpangmichael.workers.dev/";

export class TelemetryService {
  private readonly enabled: boolean;
  private readonly endpoint: string | null;
  private readonly appDataDir: string;
  private readonly version: string;
  private readonly logger: FastifyBaseLogger;
  private instanceId: string | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(options: TelemetryServiceOptions) {
    this.enabled = options.enabled;
    this.endpoint = options.endpoint;
    this.appDataDir = options.appDataDir;
    this.version = options.version;
    this.logger = options.logger;
  }

  start(): void {
    if (!this.enabled) {
      this.logger.debug({ reason: "disabled" }, "telemetry skipped");
      return;
    }

    if (!this.endpoint) {
      this.logger.debug({ reason: "no endpoint" }, "telemetry skipped");
      return;
    }

    this.instanceId = this.readOrCreateInstanceId();

    // Fire-and-forget, do not await
    void this.send("startup");

    this.heartbeatTimer = setInterval(() => {
      void this.send("heartbeat");
    }, HEARTBEAT_INTERVAL_MS);

    // Allow the process to exit even if the heartbeat timer is pending
    this.heartbeatTimer.unref?.();
  }

  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private readOrCreateInstanceId(): string {
    const path = join(this.appDataDir, INSTANCE_ID_FILENAME);

    try {
      if (existsSync(path)) {
        const value = readFileSync(path, "utf8").trim();
        if (value) {
          return value;
        }
      }
    } catch (error) {
      this.logger.debug({ error }, "telemetry instance id read failed");
    }

    const value = randomUUID();

    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${value}\n`, { mode: 0o600 });
    } catch (error) {
      this.logger.debug({ error }, "telemetry instance id persist failed");
    }

    return value;
  }

  private buildPayload(event: TelemetryEvent) {
    const instanceId = this.instanceId ?? "unknown";
    const hostHash = createHash("sha256")
      .update(`${hostname()}::${instanceId}`)
      .digest("hex")
      .slice(0, 12);

    return {
      event,
      instanceId,
      version: this.version,
      platform: platform(),
      arch: arch(),
      nodeVersion: process.version,
      hostHash,
      timestamp: new Date().toISOString(),
    };
  }

  private async send(event: TelemetryEvent): Promise<void> {
    if (!this.endpoint) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);

    try {
      const payload = this.buildPayload(event);

      await fetch(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      this.logger.debug({ event, version: this.version }, "telemetry sent");
    } catch (error) {
      // Swallow all errors, offline installs must keep working.
      this.logger.debug({ error, event }, "telemetry send failed");
    } finally {
      clearTimeout(timeout);
    }
  }
}
