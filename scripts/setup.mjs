import { access, copyFile, mkdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const envExamplePath = resolve(repoRoot, ".env.example");
const envLocalPath = resolve(repoRoot, ".env.local");

const parseDotEnv = (content) => {
  const result = {};

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
};

const pathExists = async (path) => {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const detectBinary = (binary) =>
  new Promise((resolvePromise) => {
    const child = spawn("sh", ["-lc", `command -v ${binary}`], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "ignore"],
    });

    let stdout = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise(stdout.trim() || "available");
        return;
      }

      resolvePromise(null);
    });
  });

const ensureEnvLocal = async () => {
  if (await pathExists(envLocalPath)) {
    return { created: false };
  }

  await copyFile(envExamplePath, envLocalPath);
  return { created: true };
};

const loadEnvLocal = async () => {
  const envFile = await readFile(envLocalPath, "utf8");
  return parseDotEnv(envFile);
};

const ensureAppDataDir = async (env) => {
  const configured = env.NOVA_APP_DATA_DIR?.trim();
  const appDataDir = configured
    ? resolve(repoRoot, configured)
    : resolve(repoRoot, ".nova-data");

  await mkdir(appDataDir, { recursive: true });
  return appDataDir;
};

const formatBinaryStatus = (label, detectedPath) => {
  if (!detectedPath) {
    return `- ${label}: not found`;
  }

  return `- ${label}: ${detectedPath}`;
};

const main = async () => {
  console.log("Nova setup");
  console.log("");

  const { created } = await ensureEnvLocal();
  const env = await loadEnvLocal();
  const appDataDir = await ensureAppDataDir(env);

  const [openclaw, codex, claude] = await Promise.all([
    detectBinary("openclaw"),
    detectBinary("codex"),
    detectBinary("claude"),
  ]);

  if (created) {
    console.log(`- Created .env.local from .env.example`);
  } else {
    console.log(`- Reusing existing .env.local`);
  }

  console.log(`- App data directory: ${appDataDir}`);
  console.log("");
  console.log("Detected runtimes");
  console.log(formatBinaryStatus("OpenClaw", openclaw));
  console.log(formatBinaryStatus("Codex", codex));
  console.log(formatBinaryStatus("Claude Code", claude));
  console.log("");
  console.log("Next steps");
  console.log("1. Review .env.local and adjust runtime or auth settings if needed.");
  console.log("2. Run `pnpm dev` for local-only access or `pnpm dev:lan` for same-Wi-Fi access.");
  console.log("3. Open http://127.0.0.1:3000 after the server reports healthy.");
};

main().catch((error) => {
  console.error("Nova setup failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
