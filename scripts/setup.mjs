import { copyFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

import {
  ensureAppDataDir,
  parseDotEnv,
  pathExists,
  repoRoot,
} from "./lib/env.mjs";

const envExamplePath = resolve(repoRoot, ".env.example");
const envLocalPath = resolve(repoRoot, ".env.local");

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
  console.log("2. Run `pnpm dev` for local development or `pnpm dev:lan` for same-Wi-Fi access.");

  if (process.platform === "darwin") {
    console.log("3. For a background macOS service, run `pnpm build && pnpm service:macos:install`.");
  } else {
    console.log("3. For production mode, run `pnpm build && pnpm start`.");
  }

  console.log("4. Open http://127.0.0.1:3000 after the server reports healthy.");
};

main().catch((error) => {
  console.error("Nova setup failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
