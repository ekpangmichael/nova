import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { DEFAULT_TELEMETRY_ENDPOINT } from "./services/TelemetryService.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

const splitPathEntries = (value: string | undefined) =>
  (value ?? "")
    .split(":")
    .map((entry) => entry.trim())
    .filter(Boolean);

const binaryExistsAt = (candidatePath: string) => existsSync(candidatePath);

const compareNodeVersionLabels = (left: string, right: string) => {
  const leftParts = left.replace(/^v/, "").split(".").map(Number);
  const rightParts = right.replace(/^v/, "").split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue !== rightValue) {
      return rightValue - leftValue;
    }
  }

  return 0;
};

export const findBinaryOnPath = (binaryName: string) => {
  for (const pathEntry of splitPathEntries(process.env.PATH)) {
    const candidatePath = join(pathEntry, binaryName);

    if (binaryExistsAt(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
};

export const findNvmInstalledBinary = (binaryName: string) => {
  const nodeVersionsDir = join(homedir(), ".nvm", "versions", "node");

  if (!existsSync(nodeVersionsDir)) {
    return null;
  }

  const versionDirs = readdirSync(nodeVersionsDir)
    .filter((entry) => entry.startsWith("v"))
    .sort(compareNodeVersionLabels);

  for (const versionDir of versionDirs) {
    const candidatePath = join(nodeVersionsDir, versionDir, "bin", binaryName);

    if (binaryExistsAt(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
};

export const resolveOpenClawBinaryPath = (requestedPath: string) => {
  if (requestedPath !== "openclaw") {
    return requestedPath;
  }

  return (
    findBinaryOnPath("openclaw") ??
    findNvmInstalledBinary("openclaw") ??
    requestedPath
  );
};

export const resolveOpenClawStateDir = (requestedPath?: string | null) =>
  resolve(requestedPath ?? resolve(homedir(), ".openclaw"));

export const resolveOpenClawConfigPath = (
  stateDir: string,
  requestedPath?: string | null
) => resolve(requestedPath ?? resolve(stateDir, "openclaw.json"));

export const resolveCodexBinaryPath = (requestedPath: string) => {
  if (requestedPath !== "codex") {
    return requestedPath;
  }

  return (
    findBinaryOnPath("codex") ??
    findNvmInstalledBinary("codex") ??
    requestedPath
  );
};

export const resolveClaudeBinaryPath = (requestedPath: string) => {
  if (requestedPath !== "claude") {
    return requestedPath;
  }

  const localUserBinary = join(homedir(), ".local", "bin", "claude");

  return (
    findBinaryOnPath("claude") ??
    (binaryExistsAt(localUserBinary) ? localUserBinary : null) ??
    findNvmInstalledBinary("claude") ??
    requestedPath
  );
};

export const resolveCodexStateDir = (requestedPath?: string | null) =>
  resolve(requestedPath ?? resolve(homedir(), ".codex"));

export const resolveCodexConfigPath = (
  stateDir: string,
  requestedPath?: string | null
) => resolve(requestedPath ?? resolve(stateDir, "config.toml"));

export const resolveClaudeStateDir = (requestedPath?: string | null) =>
  resolve(requestedPath ?? resolve(homedir(), ".claude"));

export const resolveClaudeConfigPath = (
  stateDir: string,
  requestedPath?: string | null
) => resolve(requestedPath ?? resolve(stateDir, "settings.json"));

export const detectOpenClawRuntimeConfig = (overrides?: {
  profile?: string | null;
  binaryPath?: string | null;
  stateDir?: string | null;
  configPath?: string | null;
  gatewayUrl?: string | null;
}) => {
  const stateDir = resolveOpenClawStateDir(overrides?.stateDir);

  return {
    profile: overrides?.profile?.trim() || "apm",
    binaryPath: resolveOpenClawBinaryPath(
      overrides?.binaryPath?.trim() || "openclaw"
    ),
    stateDir,
    configPath: resolveOpenClawConfigPath(stateDir, overrides?.configPath),
    gatewayUrl: overrides?.gatewayUrl?.trim() || null,
  };
};

export const detectCodexRuntimeConfig = (overrides?: {
  binaryPath?: string | null;
  stateDir?: string | null;
  configPath?: string | null;
  defaultModel?: string | null;
}) => {
  const stateDir = resolveCodexStateDir(overrides?.stateDir);
  const configPath = resolveCodexConfigPath(stateDir, overrides?.configPath);

  return {
    binaryPath: resolveCodexBinaryPath(overrides?.binaryPath?.trim() || "codex"),
    stateDir,
    configPath,
    defaultModel:
      overrides?.defaultModel?.trim() ||
      detectCodexDefaultModel(configPath) ||
      null,
  };
};

export const normalizeClaudeModelId = (modelId: string | null | undefined) => {
  const normalized = modelId?.trim() ?? "";

  if (!normalized) {
    return null;
  }

  switch (normalized) {
    case "claude-sonnet-4-20250514":
      return "claude-sonnet-4-6";
    case "claude-opus-4-20250514":
      return "claude-opus-4-6";
    default:
      return normalized;
  }
};

export const detectClaudeRuntimeConfig = (overrides?: {
  binaryPath?: string | null;
  stateDir?: string | null;
  configPath?: string | null;
  defaultModel?: string | null;
}) => {
  const stateDir = resolveClaudeStateDir(overrides?.stateDir);
  const configPath = resolveClaudeConfigPath(stateDir, overrides?.configPath);

  return {
    binaryPath: resolveClaudeBinaryPath(
      overrides?.binaryPath?.trim() || "claude"
    ),
    stateDir,
    configPath,
    defaultModel:
      normalizeClaudeModelId(overrides?.defaultModel) ||
      normalizeClaudeModelId(detectClaudeDefaultModel(configPath)) ||
      "claude-sonnet-4-6",
  };
};

const detectCodexDefaultModel = (configPath: string) => {
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const raw = readFileSync(configPath, "utf8");
    const match = raw.match(/^\s*model\s*=\s*"([^"]+)"/m);
    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
};

const detectClaudeDefaultModel = (configPath: string) => {
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const candidate =
      parsed.defaultModel ??
      parsed.model ??
      parsed.preferredModel ??
      parsed.primaryModel;

    return typeof candidate === "string" && candidate.trim()
      ? normalizeClaudeModelId(candidate)
      : null;
  } catch {
    return null;
  }
};

const envSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NOVA_APP_DATA_DIR: z.string().optional(),
  NOVA_RUNTIME_MODE: z.enum(["mock", "openclaw"]).default("mock"),
  OPENCLAW_PROFILE: z.string().default("apm"),
  OPENCLAW_BINARY_PATH: z.string().default("openclaw"),
  OPENCLAW_CONFIG_PATH: z.string().optional(),
  OPENCLAW_STATE_DIR: z.string().optional(),
  OPENCLAW_GATEWAY_URL: z.string().optional(),
  OPENCLAW_GATEWAY_TOKEN: z.string().optional(),
  CODEX_BINARY_PATH: z.string().default("codex"),
  CODEX_CONFIG_PATH: z.string().optional(),
  CODEX_STATE_DIR: z.string().optional(),
  CODEX_DEFAULT_MODEL: z.string().optional(),
  CLAUDE_BINARY_PATH: z.string().default("claude"),
  CLAUDE_CONFIG_PATH: z.string().optional(),
  CLAUDE_STATE_DIR: z.string().optional(),
  CLAUDE_DEFAULT_MODEL: z.string().optional(),
  NOVA_ENABLE_OPENCLAW_SMOKE: z
    .string()
    .optional()
    .transform((value) => value === "1" || value === "true"),
  NOVA_TELEMETRY: z
    .string()
    .optional()
    .transform((value) => value !== "0" && value !== "false"),
  NOVA_TELEMETRY_ENDPOINT: z.string().optional(),
});

export type AppEnv = ReturnType<typeof loadEnv>;

export const loadEnv = (overrides: Partial<NodeJS.ProcessEnv> = {}) => {
  const parsed = envSchema.parse({
    ...process.env,
    ...overrides,
  });

  const appDataDir = resolve(
    parsed.NOVA_APP_DATA_DIR ?? resolve(repoRoot, ".nova-data")
  );
  const openClawStateDir = resolveOpenClawStateDir(parsed.OPENCLAW_STATE_DIR);
  const openClawConfigPath = resolveOpenClawConfigPath(
    openClawStateDir,
    parsed.OPENCLAW_CONFIG_PATH
  );
  const codexStateDir = resolveCodexStateDir(parsed.CODEX_STATE_DIR);
  const codexConfigPath = resolveCodexConfigPath(
    codexStateDir,
    parsed.CODEX_CONFIG_PATH
  );
  const claudeStateDir = resolveClaudeStateDir(parsed.CLAUDE_STATE_DIR);
  const claudeConfigPath = resolveClaudeConfigPath(
    claudeStateDir,
    parsed.CLAUDE_CONFIG_PATH
  );
  const detectedCodexDefaultModel = detectCodexRuntimeConfig({
    binaryPath: parsed.CODEX_BINARY_PATH,
    stateDir: codexStateDir,
    configPath: codexConfigPath,
    defaultModel: parsed.CODEX_DEFAULT_MODEL,
  }).defaultModel;
  const detectedClaudeDefaultModel = detectClaudeRuntimeConfig({
    binaryPath: parsed.CLAUDE_BINARY_PATH,
    stateDir: claudeStateDir,
    configPath: claudeConfigPath,
    defaultModel: parsed.CLAUDE_DEFAULT_MODEL,
  }).defaultModel;

  return {
    host: parsed.HOST,
    port: parsed.PORT,
    nodeEnv: parsed.NODE_ENV,
    repoRoot,
    appDataDir,
    dbPath: resolve(appDataDir, "db", "app.db"),
    attachmentsDir: resolve(appDataDir, "attachments"),
    logsDir: resolve(appDataDir, "logs"),
    tempDir: resolve(appDataDir, "temp"),
    agentHomesDir: resolve(appDataDir, "agent-homes"),
    runtimeMode: parsed.NOVA_RUNTIME_MODE,
    openclawProfile: parsed.OPENCLAW_PROFILE,
    openclawBinaryPath: resolveOpenClawBinaryPath(parsed.OPENCLAW_BINARY_PATH),
    openclawConfigPath: openClawConfigPath,
    openclawStateDir: openClawStateDir,
    openclawGatewayUrl: parsed.OPENCLAW_GATEWAY_URL ?? null,
    openclawGatewayToken: parsed.OPENCLAW_GATEWAY_TOKEN ?? null,
    codexBinaryPath: resolveCodexBinaryPath(parsed.CODEX_BINARY_PATH),
    codexConfigPath,
    codexStateDir,
    codexDefaultModel: detectedCodexDefaultModel,
    claudeBinaryPath: resolveClaudeBinaryPath(parsed.CLAUDE_BINARY_PATH),
    claudeConfigPath,
    claudeStateDir,
    claudeDefaultModel: detectedClaudeDefaultModel,
    enableOpenClawSmoke: parsed.NOVA_ENABLE_OPENCLAW_SMOKE,
    telemetryEnabled: parsed.NOVA_TELEMETRY,
    telemetryEndpoint:
      parsed.NOVA_TELEMETRY_ENDPOINT?.trim() ||
      DEFAULT_TELEMETRY_ENDPOINT ||
      null,
  };
};
