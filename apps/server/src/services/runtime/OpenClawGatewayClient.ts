import { readFile } from "node:fs/promises";
import WebSocket from "ws";
import type { AppEnv } from "../../env.js";
import { serviceUnavailable } from "../../lib/errors.js";
import { generateId } from "../../lib/utils.js";
import { OpenClawProcessManager } from "./OpenClawProcessManager.js";
import {
  buildOpenClawDeviceAuthPayloadV3,
  loadOrCreateOpenClawDeviceIdentity,
  openClawPublicKeyRawBase64UrlFromPem,
  signOpenClawDevicePayload,
} from "./openclaw-device-identity.js";

const PROTOCOL_VERSION = 3;
const CLIENT_VERSION = "0.1.0";
const CONNECT_CHALLENGE_TIMEOUT_MS = 10_000;
const GATEWAY_CLIENT_ID = "gateway-client";
const GATEWAY_CLIENT_MODE = "backend";
const OPERATOR_SCOPES = ["operator.write"];

type GatewayRequestFrame = {
  type: "req";
  id: string;
  method: string;
  params: Record<string, unknown>;
};

type GatewayResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

type GatewayEventFrame = {
  type: "event";
  event: string;
  payload: Record<string, unknown>;
  seq?: number;
  stateVersion?: number;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export type OpenClawChatEventPayload = {
  runId?: string;
  sessionKey?: string;
  seq?: number;
  state?: string;
  stopReason?: string;
  errorMessage?: string;
  message?: {
    role?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
    timestamp?: number;
    __openclaw?: {
      id?: string;
      seq?: number;
    };
  };
};

export type OpenClawAgentEventPayload = {
  runId?: string;
  sessionKey?: string;
  stream?: string;
  ts?: number;
  seq?: number;
  data?: Record<string, unknown>;
};

const isGatewayResponseFrame = (value: unknown): value is GatewayResponseFrame =>
  typeof value === "object" &&
  value !== null &&
  (value as { type?: string }).type === "res" &&
  typeof (value as { id?: string }).id === "string" &&
  typeof (value as { ok?: boolean }).ok === "boolean";

const isGatewayEventFrame = (value: unknown): value is GatewayEventFrame =>
  typeof value === "object" &&
  value !== null &&
  (value as { type?: string }).type === "event" &&
  typeof (value as { event?: string }).event === "string" &&
  typeof (value as { payload?: unknown }).payload === "object" &&
  (value as { payload?: unknown }).payload !== null;

export class OpenClawGatewayClient {
  #env: AppEnv;
  #processManager: OpenClawProcessManager;
  #socket: WebSocket | null = null;
  #connectPromise: Promise<void> | null = null;
  #pending = new Map<string, PendingRequest>();
  #listeners = new Set<(frame: GatewayEventFrame) => void>();
  #closed = false;

  constructor(env: AppEnv, processManager: OpenClawProcessManager) {
    this.#env = env;
    this.#processManager = processManager;
  }

  onEvent(listener: (frame: GatewayEventFrame) => void) {
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  }

  async request<T>(method: string, params: Record<string, unknown>): Promise<T> {
    await this.#ensureConnected();

    if (!this.#socket || this.#socket.readyState !== WebSocket.OPEN) {
      throw serviceUnavailable("OpenClaw gateway socket is not connected.");
    }

    const id = generateId();
    const frame: GatewayRequestFrame = {
      type: "req",
      id,
      method,
      params,
    };

    const response = await new Promise<unknown>((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#socket?.send(JSON.stringify(frame), (error) => {
        if (!error) {
          return;
        }

        this.#pending.delete(id);
        reject(error);
      });
    });

    return response as T;
  }

  async close() {
    this.#closed = true;
    const socket = this.#socket;
    this.#socket = null;
    this.#connectPromise = null;

    if (!socket) {
      this.#rejectPending(new Error("OpenClaw gateway client closed."));
      return;
    }

    await new Promise<void>((resolve) => {
      socket.once("close", () => resolve());
      socket.close();
      setTimeout(resolve, 500);
    });
    this.#rejectPending(new Error("OpenClaw gateway client closed."));
  }

  async #ensureConnected() {
    if (this.#socket?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.#connectPromise) {
      return this.#connectPromise;
    }

    this.#closed = false;
    this.#connectPromise = this.#connect();

    try {
      await this.#connectPromise;
    } finally {
      this.#connectPromise = null;
    }
  }

  async #connect() {
    const connection = await this.#resolveConnection();
    const deviceIdentity = await loadOrCreateOpenClawDeviceIdentity(
      this.#env.appDataDir
    );

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(connection.url);
      let settled = false;
      let connectSent = false;
      const connectChallengeTimer = setTimeout(() => {
        if (settled || connectSent || socket.readyState !== WebSocket.OPEN) {
          return;
        }

        fail(new Error("OpenClaw gateway connect challenge timed out."));
        socket.close(1008, "connect challenge timeout");
      }, CONNECT_CHALLENGE_TIMEOUT_MS);
      connectChallengeTimer.unref?.();

      const cleanup = () => {
        clearTimeout(connectChallengeTimer);
        socket.removeAllListeners("open");
        socket.removeAllListeners("message");
        socket.removeAllListeners("error");
        socket.removeAllListeners("close");
      };

      const fail = (error: unknown) => {
        const normalized =
          error instanceof Error
            ? error
            : new Error(typeof error === "string" ? error : "OpenClaw gateway failed.");

        if (!settled) {
          settled = true;
          cleanup();
          reject(normalized);
        }

        this.#socket = null;
        this.#rejectPending(normalized);
      };

      socket.on("open", () => {
        this.#socket = socket;
      });

      socket.on("message", (rawData) => {
        let parsed: unknown;

        try {
          parsed = JSON.parse(rawData.toString());
        } catch {
          return;
        }

        if (isGatewayEventFrame(parsed)) {
          if (parsed.event === "connect.challenge") {
            const nonce =
              typeof parsed.payload.nonce === "string"
                ? parsed.payload.nonce.trim()
                : "";

            if (!nonce) {
              fail(new Error("OpenClaw gateway connect challenge missing nonce."));
              socket.close(1008, "connect challenge missing nonce");
              return;
            }

            if (!connectSent) {
              connectSent = true;
              const signedAtMs = Date.now();
              const devicePayload = buildOpenClawDeviceAuthPayloadV3({
                deviceId: deviceIdentity.deviceId,
                clientId: GATEWAY_CLIENT_ID,
                clientMode: GATEWAY_CLIENT_MODE,
                role: "operator",
                scopes: OPERATOR_SCOPES,
                signedAtMs,
                token: connection.token,
                nonce,
                platform: process.platform,
              });
              const deviceSignature = signOpenClawDevicePayload(
                deviceIdentity.privateKeyPem,
                devicePayload
              );
              socket.send(
                JSON.stringify({
                  type: "req",
                  id: "connect",
                  method: "connect",
                  params: {
                    minProtocol: PROTOCOL_VERSION,
                    maxProtocol: PROTOCOL_VERSION,
                    client: {
                      id: GATEWAY_CLIENT_ID,
                      displayName: "Nova Server",
                      version: CLIENT_VERSION,
                      platform: process.platform,
                      mode: GATEWAY_CLIENT_MODE,
                      instanceId: `nova-${process.pid}`,
                    },
                    role: "operator",
                    scopes: OPERATOR_SCOPES,
                    caps: [],
                    commands: [],
                    permissions: {},
                    auth: connection.token ? { token: connection.token } : undefined,
                    device: {
                      id: deviceIdentity.deviceId,
                      publicKey: openClawPublicKeyRawBase64UrlFromPem(
                        deviceIdentity.publicKeyPem
                      ),
                      signature: deviceSignature,
                      signedAt: signedAtMs,
                      nonce,
                    },
                    locale: "en-US",
                    userAgent: `nova-server/${CLIENT_VERSION}`,
                  },
                }),
                (error) => {
                  if (error) {
                    fail(error);
                  }
                }
              );
            }
            return;
          }

          for (const listener of this.#listeners) {
            listener(parsed);
          }

          return;
        }

        if (!isGatewayResponseFrame(parsed)) {
          return;
        }

        if (parsed.id === "connect") {
          if (!parsed.ok) {
            fail(
              new Error(
                parsed.error?.message ?? "OpenClaw gateway rejected the Nova connection."
              )
            );
            return;
          }

          if (!settled) {
            settled = true;
            clearTimeout(connectChallengeTimer);
            resolve();
          }

          return;
        }

        const pending = this.#pending.get(parsed.id);

        if (!pending) {
          return;
        }

        this.#pending.delete(parsed.id);

        if (parsed.ok) {
          pending.resolve(parsed.payload);
          return;
        }

        pending.reject(
          new Error(parsed.error?.message ?? `Gateway request ${parsed.id} failed.`)
        );
      });

      socket.on("error", (error) => {
        fail(error);
      });

      socket.on("close", (code, reason) => {
        const normalizedReason = reason.toString().trim();
        const message = normalizedReason
          ? `OpenClaw gateway socket closed (${code}): ${normalizedReason}`
          : `OpenClaw gateway socket closed (${code}).`;

        this.#socket = null;

        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error(message));
          return;
        }

        cleanup();

        if (!this.#closed) {
          this.#rejectPending(new Error(message));
        }
      });
    });
  }

  async #resolveConnection() {
    const gatewayStatus = await this.#processManager.getGatewayStatus();
    const config = await this.#readConfig();
    const url =
      this.#env.openclawGatewayUrl ??
      gatewayStatus?.rpc?.url ??
      gatewayStatus?.gateway?.probeUrl ??
      "ws://127.0.0.1:18789";
    const authMode =
      config?.gateway?.auth?.mode ??
      (this.#env.openclawGatewayToken ? "token" : null);
    const token =
      this.#env.openclawGatewayToken ??
      (typeof config?.gateway?.auth?.token === "string"
        ? config.gateway.auth.token
        : null);

    if (authMode === "password") {
      throw serviceUnavailable(
        "OpenClaw gateway password auth is not supported by Nova yet."
      );
    }

    if (authMode === "token" && !token) {
      throw serviceUnavailable(
        "OpenClaw gateway token auth is enabled, but Nova could not resolve the token."
      );
    }

    return {
      url,
      token,
    };
  }

  async #readConfig() {
    try {
      const raw = await readFile(this.#env.openclawConfigPath, "utf8");
      return JSON.parse(raw) as {
        gateway?: {
          auth?: {
            mode?: string;
            token?: string;
          };
        };
      };
    } catch {
      return null;
    }
  }

  #rejectPending(error: Error) {
    for (const pending of this.#pending.values()) {
      pending.reject(error);
    }

    this.#pending.clear();
  }
}
