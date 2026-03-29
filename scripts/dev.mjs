import { execFile, spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const webDir = resolve(repoRoot, "apps/web");
const webLockPath = resolve(webDir, ".next/dev/lock");
const desiredWebPort = 3000;
const desiredServerPort = 4010;
const desiredBackendUrl = `http://127.0.0.1:${desiredServerPort}/api`;
const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

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

const getProcessCommand = async (pid) => {
  try {
    const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "command="]);
    return stdout.trim();
  } catch {
    return "";
  }
};

const isWorkspaceServerProcess = (command) =>
  command.includes(repoRoot) && command.includes("src/index.ts");

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
    await terminateProcess(lock.pid);
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

    for (const pid of pids) {
      await terminateProcess(pid);
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
      PORT: String(desiredServerPort),
    }
  );
  children.push(server);

  server.on("exit", (code) => {
    if (!shuttingDown) {
      void handleExit(code ?? 1);
    }
  });

  await waitForNovaHealth();

  const web = spawnChild(
    "@nova/web",
    [
      "--filter",
      "@nova/web",
      "exec",
      "next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(desiredWebPort),
    ],
    {
      NOVA_BACKEND_URL: desiredBackendUrl,
      NEXT_PUBLIC_WEB_ORIGIN: `http://127.0.0.1:${desiredWebPort}`,
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
