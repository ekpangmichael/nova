import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

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
  OPENCLAW_GATEWAY_URL: z.string().optional(),
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
    openclawBinaryPath: parsed.OPENCLAW_BINARY_PATH,
    openclawGatewayUrl: parsed.OPENCLAW_GATEWAY_URL ?? null,
    enableOpenClawSmoke: parsed.NOVA_ENABLE_OPENCLAW_SMOKE,
  };
};
