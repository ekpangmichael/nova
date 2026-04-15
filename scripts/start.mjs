import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { applyLoadedEnv, pathExists, repoRoot } from "./lib/env.mjs";

const webDir = resolve(repoRoot, "apps/web");
const serverDir = resolve(repoRoot, "apps/server");
const nextBinPath = resolve(webDir, "node_modules/next/dist/bin/next");
const serverEntryPath = resolve(serverDir, "dist/index.js");
const webBuildIdPath = resolve(webDir, ".next/BUILD_ID");

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const coercePort = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const isWildcardHost = (host) =>
  host === "0.0.0.0" || host === "::" || host === "[::]" || host === "::0";

const localConnectHost = (host) => {
  const normalized = host?.trim();

  if (!normalized || normalized === "localhost" || isWildcardHost(normalized)) {
    return "127.0.0.1";
  }

  return normalized;
};

const displayOrigin = (host, port) =>
  `http://${localConnectHost(host)}:${port}`;

const assertBuildArtifacts = async () => {
  const missing = [];

  if (!(await pathExists(serverEntryPath))) {
    missing.push("apps/server/dist/index.js");
  }

  if (!(await pathExists(webBuildIdPath))) {
    missing.push("apps/web/.next/BUILD_ID");
  }

  if (!(await pathExists(nextBinPath))) {
    missing.push("node_modules/next/dist/bin/next");
  }

  if (missing.length === 0) {
    return;
  }

  throw new Error(
    [
      "Production build artifacts are missing:",
      ...missing.map((entry) => `- ${entry}`),
      "",
      "Run `pnpm build` before starting Nova in production mode.",
    ].join("\n")
  );
};

const spawnChild = (label, command, args, options = {}) => {
  const child = spawn(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: {
      ...process.env,
      ...options.env,
    },
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(`${label} failed to start.`);
    console.error(error instanceof Error ? error.message : String(error));
  });

  return child;
};

const waitForBackendHealth = async (healthUrl, timeoutMs = 30000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(healthUrl, {
        cache: "no-store",
      });

      if (response.ok) {
        const payload = await response.json();

        if (payload?.service === "nova-server") {
          return;
        }
      }
    } catch {
      // Retry until the timeout expires.
    }

    await sleep(250);
  }

  throw new Error("Timed out while waiting for the Fastify backend to become healthy.");
};

const terminateChild = (child) =>
  new Promise((resolvePromise) => {
    if (!child?.pid || child.exitCode !== null) {
      resolvePromise();
      return;
    }

    const handleDone = () => {
      child.removeListener("exit", handleDone);
      resolvePromise();
    };

    child.once("exit", handleDone);
    child.kill("SIGTERM");

    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }, 5000).unref();
  });

const shutdown = async (children) => {
  await Promise.all(children.map((child) => terminateChild(child)));
};

const main = async () => {
  await applyLoadedEnv();
  await assertBuildArtifacts();

  const serverHost = process.env.HOST?.trim() || "0.0.0.0";
  const serverPort = coercePort(process.env.PORT, 4000);
  const webHost = process.env.NOVA_WEB_HOST?.trim() || "127.0.0.1";
  const webPort = coercePort(process.env.NOVA_WEB_PORT, 3000);
  const backendUrl = `http://${localConnectHost(serverHost)}:${serverPort}/api`;
  const healthUrl = `${backendUrl}/health`;
  const webOrigin =
    process.env.NEXT_PUBLIC_WEB_ORIGIN?.trim() || displayOrigin(webHost, webPort);

  console.log("Starting Nova production launcher");
  console.log(`- API server: ${backendUrl}`);
  console.log(`- Web app: ${webOrigin}`);

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

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      void handleExit(0);
    });
  }

  const server = spawnChild("@nova/server", process.execPath, [serverEntryPath], {
    cwd: serverDir,
    env: {
      NODE_ENV: "production",
      HOST: serverHost,
      PORT: String(serverPort),
    },
  });
  children.push(server);

  server.on("exit", (code) => {
    if (!shuttingDown) {
      void handleExit(code ?? 1);
    }
  });

  await waitForBackendHealth(healthUrl);

  const web = spawnChild(
    "@nova/web",
    process.execPath,
    [nextBinPath, "start", "--hostname", webHost, "--port", String(webPort)],
    {
      cwd: webDir,
      env: {
        NODE_ENV: "production",
        NOVA_BACKEND_URL: backendUrl,
        NEXT_PUBLIC_WEB_ORIGIN: webOrigin,
      },
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
  console.error("Nova production launcher failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
