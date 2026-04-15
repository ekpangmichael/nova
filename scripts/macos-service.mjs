import { execFile, spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { applyLoadedEnv, ensureAppDataDir, repoRoot } from "./lib/env.mjs";

if (process.platform !== "darwin") {
  console.error("The macOS service launcher is only supported on macOS.");
  process.exit(1);
}

const command = process.argv[2] ?? "status";
const serviceLabel = "ai.nova.production";
const launchAgentDir = resolve(homedir(), "Library/LaunchAgents");
const plistPath = resolve(launchAgentDir, `${serviceLabel}.plist`);
const launcherPath = resolve(repoRoot, "scripts/start.mjs");
const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const launchDomain = `gui/${process.getuid()}`;
const launchTarget = `${launchDomain}/${serviceLabel}`;
const fallbackPath = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";

const coercePort = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const localConnectHost = (host) => {
  const normalized = host?.trim();

  if (
    !normalized ||
    normalized === "localhost" ||
    normalized === "0.0.0.0" ||
    normalized === "::" ||
    normalized === "[::]" ||
    normalized === "::0"
  ) {
    return "127.0.0.1";
  }

  return normalized;
};

const xmlEscape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const execFileAsync = (file, args, options = {}) =>
  new Promise((resolvePromise, rejectPromise) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        rejectPromise(Object.assign(error, { stdout, stderr }));
        return;
      }

      resolvePromise({ stdout, stderr });
    });
  });

const runPnpmBuild = () =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(pnpmBin, ["build"], {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`pnpm build exited with code ${code ?? 1}.`));
    });
  });

const createPlist = ({ stdoutPath, stderrPath, webOrigin }) => {
  const pathValue = process.env.PATH?.trim() || fallbackPath;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${xmlEscape(serviceLabel)}</string>
    <key>ProgramArguments</key>
    <array>
      <string>${xmlEscape(process.execPath)}</string>
      <string>${xmlEscape(launcherPath)}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${xmlEscape(repoRoot)}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${xmlEscape(stdoutPath)}</string>
    <key>StandardErrorPath</key>
    <string>${xmlEscape(stderrPath)}</string>
    <key>EnvironmentVariables</key>
    <dict>
      <key>HOME</key>
      <string>${xmlEscape(homedir())}</string>
      <key>PATH</key>
      <string>${xmlEscape(pathValue)}</string>
      <key>NEXT_PUBLIC_WEB_ORIGIN</key>
      <string>${xmlEscape(webOrigin)}</string>
    </dict>
  </dict>
</plist>
`;
};

const bootoutIfLoaded = async () => {
  try {
    await execFileAsync("launchctl", ["bootout", launchTarget]);
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";

    if (
      stderr.includes("Could not find service") ||
      stderr.includes("No such process") ||
      stderr.includes("not found")
    ) {
      return;
    }

    const code =
      error && typeof error === "object" && "code" in error ? Number(error.code) : null;

    if (code === 113 || code === 3) {
      return;
    }

    throw error;
  }
};

const bootstrapService = async () => {
  await execFileAsync("launchctl", ["bootstrap", launchDomain, plistPath]);
  await execFileAsync("launchctl", ["enable", launchTarget]).catch(() => undefined);
  await execFileAsync("launchctl", ["kickstart", "-k", launchTarget]);
};

const printStatus = async () => {
  try {
    const { stdout } = await execFileAsync("launchctl", ["print", launchTarget]);
    process.stdout.write(stdout);
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";

    if (stderr.trim()) {
      console.error(stderr.trim());
    } else {
      console.error("Nova macOS service is not currently loaded.");
    }

    process.exitCode = 1;
  }
};

const install = async () => {
  await applyLoadedEnv();

  const appDataDir = await ensureAppDataDir(process.env);
  const logsDir = resolve(appDataDir, "logs");
  const stdoutPath = resolve(logsDir, "nova-macos-service.log");
  const stderrPath = resolve(logsDir, "nova-macos-service.error.log");
  const webHost = process.env.NOVA_WEB_HOST?.trim() || "127.0.0.1";
  const webPort = coercePort(process.env.NOVA_WEB_PORT, 3000);
  const webOrigin =
    process.env.NEXT_PUBLIC_WEB_ORIGIN?.trim() ||
    `http://${localConnectHost(webHost)}:${webPort}`;

  await mkdir(launchAgentDir, { recursive: true });
  await mkdir(logsDir, { recursive: true });

  console.log("Building Nova for production...");
  await runPnpmBuild();

  await writeFile(
    plistPath,
    createPlist({
      stdoutPath,
      stderrPath,
      webOrigin,
    }),
    "utf8"
  );

  await bootoutIfLoaded();
  await bootstrapService();

  console.log("Nova macOS service installed.");
  console.log(`- LaunchAgent: ${plistPath}`);
  console.log(`- Logs: ${stdoutPath}`);
  console.log(`- Open: ${webOrigin}`);
};

const start = async () => {
  await applyLoadedEnv();
  await bootoutIfLoaded();
  await bootstrapService();
  console.log("Nova macOS service started.");
};

const stop = async () => {
  await bootoutIfLoaded();
  console.log("Nova macOS service stopped.");
};

const restart = async () => {
  await stop();
  await start();
};

const uninstall = async () => {
  await stop();
  await rm(plistPath, { force: true });
  console.log("Nova macOS service uninstalled.");
};

const main = async () => {
  switch (command) {
    case "install":
      await install();
      break;
    case "start":
      await start();
      break;
    case "stop":
      await stop();
      break;
    case "restart":
      await restart();
      break;
    case "status":
      await printStatus();
      break;
    case "uninstall":
      await uninstall();
      break;
    default:
      console.error(
        "Unknown command. Use one of: install, start, stop, restart, status, uninstall."
      );
      process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error("Nova macOS service command failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
