import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

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

const findBinaryOnPath = (binaryName: string) => {
  for (const pathEntry of splitPathEntries(process.env.PATH)) {
    const candidatePath = join(pathEntry, binaryName);

    if (binaryExistsAt(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
};

const findNvmInstalledBinary = (binaryName: string) => {
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

const resolveOpenClawBinaryPath = (requestedPath: string) => {
  if (requestedPath !== "openclaw") {
    return requestedPath;
  }

  return (
    findBinaryOnPath("openclaw") ??
    findNvmInstalledBinary("openclaw") ??
    requestedPath
  );
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
  NOVA_ENABLE_OPENCLAW_SMOKE: z
    .string()
    .optional()
    .transform((value) => value === "1" || value === "true"),
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
  const openClawStateDir = resolve(
    parsed.OPENCLAW_STATE_DIR ?? resolve(homedir(), ".openclaw")
  );
  const openClawConfigPath = resolve(
    parsed.OPENCLAW_CONFIG_PATH ?? resolve(openClawStateDir, "openclaw.json")
  );

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
    enableOpenClawSmoke: parsed.NOVA_ENABLE_OPENCLAW_SMOKE,
  };
};
