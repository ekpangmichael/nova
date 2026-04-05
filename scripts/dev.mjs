import { execFile, spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const webDir = resolve(repoRoot, "apps/web");
const packagesDir = resolve(repoRoot, "packages");
const webLockPath = resolve(webDir, ".next/dev/lock");
const desiredWebPort = 3000;
const desiredServerPort = 4010;
const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const isLanMode =
  process.env.NOVA_DEV_LAN === "1" || process.env.NOVA_DEV_LAN === "true";

const detectLanIp = () => {
  const interfaces = networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (
        entry &&
        entry.family === "IPv4" &&
        !entry.internal &&
        !entry.address.startsWith("169.254.")
      ) {
        return entry.address;
      }
    }
  }

  return null;
};

const lanIp = process.env.NOVA_DEV_LAN_IP || detectLanIp();
const webHostname = isLanMode ? "0.0.0.0" : "127.0.0.1";
const backendHost = isLanMode ? "0.0.0.0" : process.env.HOST ?? "0.0.0.0";
const webOriginHost = isLanMode ? lanIp : "127.0.0.1";
const desiredBackendUrl = `http://127.0.0.1:${desiredServerPort}/api`;
const desiredWebOrigin = `http://${webOriginHost}:${desiredWebPort}`;

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

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

const loadDotEnvFiles = async () => {
  const env = {};
  const candidates = [
    resolve(repoRoot, ".env"),
    resolve(repoRoot, ".env.local"),
    resolve(packagesDir, ".env"),
    resolve(packagesDir, ".env.local"),
  ];

  for (const candidatePath of candidates) {
    try {
      const fileContent = await readFile(candidatePath, "utf8");
      Object.assign(env, parseDotEnv(fileContent));
    } catch {
      // Ignore missing env files.
    }
  }

  return env;
};

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

const listProcesses = async () => {
  const { stdout } = await execFileAsync("ps", ["-axo", "pid=,pgid=,command="]);

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(\d+)\s+(.*)$/);
      if (!match) {
        return null;
      }

      return {
        pid: Number(match[1]),
        pgid: Number(match[2]),
        command: match[3],
      };
    })
    .filter((entry) => entry && Number.isInteger(entry.pid) && Number.isInteger(entry.pgid));
};

const getProcessCommand = async (pid) => {
  try {
    const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "command="]);
    return stdout.trim();
  } catch {
    return "";
  }
};

const getProcessGroupId = async (pid) => {
  try {
    const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "pgid="]);
    const pgid = Number(stdout.trim());
    return Number.isInteger(pgid) && pgid > 0 ? pgid : null;
  } catch {
    return null;
  }
};

const isWorkspaceServerProcess = (command) =>
  command.includes(repoRoot) &&
  (command.includes("@nova/server run dev") ||
    command.includes("tsx watch src/index.ts") ||
    command.includes("src/index.ts"));

const isWorkspaceWebProcess = (command) =>
  command.includes(repoRoot) &&
  (command.includes("@nova/web exec next dev") ||
    command.includes("next dev --hostname 127.0.0.1 --port 3000") ||
    command.includes("next dev --hostname 0.0.0.0 --port 3000"));

const readJsonIfPresent = async (path) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
};

const isProcessAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const waitForProcessExit = async (pid, timeoutMs = 5000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (!isProcessAlive(pid)) {
      return;
    }

    await sleep(100);
  }

  throw new Error(`Timed out while waiting for process ${pid} to exit.`);
};

const terminateProcess = async (pid) => {
  if (!isProcessAlive(pid)) {
    return;
  }

  process.kill(pid, "SIGTERM");

  try {
    await waitForProcessExit(pid);
  } catch {
    process.kill(pid, "SIGKILL");
    await waitForProcessExit(pid, 1000).catch(() => undefined);
  }
};

const terminateProcessGroup = async (pgid) => {
  try {
    process.kill(-pgid, "SIGTERM");
  } catch {
    return;
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < 5000) {
    try {
      process.kill(-pgid, 0);
      await sleep(100);
    } catch {
      return;
    }
  }

  try {
    process.kill(-pgid, "SIGKILL");
  } catch {
    return;
  }

  const forceStartedAt = Date.now();
  while (Date.now() - forceStartedAt < 1000) {
    try {
      process.kill(-pgid, 0);
      await sleep(50);
    } catch {
      return;
    }
  }
};

const getPidsListeningOnPort = async (port) => {
  try {
    const { stdout } = await execFileAsync("lsof", [
      "-ti",
      `tcp:${port}`,
      "-sTCP:LISTEN",
    ]);
    return stdout
      .split("\n")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 1) {
      return [];
    }

    throw error;
  }
};

const stopLingeringWorkspaceProcesses = async () => {
  const processes = await listProcesses();
  const serverPgids = new Set();
  const webPgids = new Set();

  for (const processInfo of processes) {
    if (!processInfo || processInfo.pid === process.pid) {
      continue;
    }

    if (isWorkspaceServerProcess(processInfo.command)) {
      serverPgids.add(processInfo.pgid);
    }

    if (isWorkspaceWebProcess(processInfo.command)) {
      webPgids.add(processInfo.pgid);
    }
  }

  for (const pgid of serverPgids) {
    console.log(`Stopping stale nova server dev group ${pgid}.`);
    await terminateProcessGroup(pgid);
  }

  for (const pgid of webPgids) {
    console.log(`Stopping stale @nova/web dev group ${pgid}.`);
    await terminateProcessGroup(pgid);
  }
};

const portHasNovaServer = async (port) => {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);

    if (!response.ok) {
      return false;
    }

    const payload = await response.json();
    return payload?.service === "nova-server";
  } catch {
    return false;
  }
};

const assertPortIsFree = async (port, label) => {
  const pids = await getPidsListeningOnPort(port);

  if (pids.length > 0) {
    throw new Error(
      `${label} port ${port} is already in use by PID ${pids.join(", ")}.`
    );
  }
};

const stopWorkspaceNextServer = async () => {
  const lock = await readJsonIfPresent(webLockPath);

  if (!lock?.pid) {
    return;
  }

  if (isProcessAlive(lock.pid)) {
    console.log(`Stopping existing @nova/web dev server (PID ${lock.pid}).`);
    const [command, pgid] = await Promise.all([
      getProcessCommand(lock.pid),
      getProcessGroupId(lock.pid),
    ]);

    if (pgid && isWorkspaceWebProcess(command)) {
      await terminateProcessGroup(pgid);
    } else {
      await terminateProcess(lock.pid);
    }
  }

  await rm(webLockPath, { force: true }).catch(() => undefined);
};

const prepareServerPort = async () => {
  const pids = await getPidsListeningOnPort(desiredServerPort);

  if (pids.length === 0) {
    return;
  }

  const [isNovaServer, commands] = await Promise.all([
    portHasNovaServer(desiredServerPort),
    Promise.all(pids.map((pid) => getProcessCommand(pid))),
  ]);

  if (isNovaServer || commands.some((command) => isWorkspaceServerProcess(command))) {
    console.log(
      `Stopping existing nova server on port ${desiredServerPort} (PID ${pids.join(", ")}).`
    );

    const pgids = new Set();
    for (let index = 0; index < pids.length; index += 1) {
      const pid = pids[index];
      const command = commands[index] ?? "";
      const pgid = await getProcessGroupId(pid);

      if (pgid && isWorkspaceServerProcess(command)) {
        pgids.add(pgid);
        continue;
      }

      await terminateProcess(pid);
    }

    for (const pgid of pgids) {
      await terminateProcessGroup(pgid);
    }

    return;
  }

  throw new Error(
    `Backend port ${desiredServerPort} is already in use by PID ${pids.join(", ")}.`
  );
};

const waitForNovaHealth = async (timeoutMs = 30000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await portHasNovaServer(desiredServerPort)) {
      return;
    }

    await sleep(250);
  }

  throw new Error("Timed out while waiting for the Fastify backend to become healthy.");
};

const spawnChild = (label, args, env = {}) => {
  const child = spawn(pnpmBin, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    detached: process.platform !== "win32",
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(`${label} failed to start.`);
    console.error(error);
  });

  return child;
};

const shutdown = async (children) => {
  for (const child of children) {
    if (child?.pid && !child.killed) {
      if (process.platform !== "win32") {
        try {
          process.kill(-child.pid, "SIGTERM");
          continue;
        } catch {
          // Fall through to direct child termination.
        }
      }

      child.kill("SIGTERM");
    }
  }
};

const main = async () => {
  const dotEnv = await loadDotEnvFiles();
  Object.assign(process.env, dotEnv, process.env);

  if (isLanMode && !lanIp) {
    throw new Error(
      "Unable to detect a LAN IPv4 address. Set NOVA_DEV_LAN_IP=<your-local-ip> and retry."
    );
  }

  await stopLingeringWorkspaceProcesses();
  await stopWorkspaceNextServer();
  await prepareServerPort();
  await assertPortIsFree(desiredWebPort, "Web");

  const children = [];
  let shuttingDown = false;

  const handleExit = async (code = 0) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    await shutdown(children);
    process.exit(code);
  };

  process.on("SIGINT", () => {
    void handleExit(0);
  });
  process.on("SIGTERM", () => {
    void handleExit(0);
  });

  const server = spawnChild(
    "@nova/server",
    ["--filter", "@nova/server", "run", "dev"],
    {
      HOST: backendHost,
      PORT: String(desiredServerPort),
      NOVA_RUNTIME_MODE: process.env.NOVA_RUNTIME_MODE ?? "openclaw",
    }
  );
  children.push(server);

  server.on("exit", (code) => {
    if (!shuttingDown) {
      void handleExit(code ?? 1);
    }
  });

  await waitForNovaHealth();

  console.log(
    isLanMode
      ? `Starting Nova in LAN mode at ${desiredWebOrigin}`
      : `Starting Nova locally at ${desiredWebOrigin}`
  );

  const web = spawnChild(
    "@nova/web",
    [
      "--filter",
      "@nova/web",
      "exec",
      "next",
      "dev",
      "--hostname",
      webHostname,
      "--port",
      String(desiredWebPort),
    ],
    {
      NOVA_BACKEND_URL: desiredBackendUrl,
      NEXT_PUBLIC_WEB_ORIGIN: desiredWebOrigin,
    }
  );
  children.push(web);

  web.on("exit", (code) => {
    if (!shuttingDown) {
      void handleExit(code ?? 1);
    }
  });
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
