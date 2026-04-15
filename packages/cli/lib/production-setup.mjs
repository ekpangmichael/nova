import { spawn } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir, networkInterfaces } from "node:os";
import { resolve } from "node:path";

import {
  confirm,
  intro,
  isCancel,
  note,
  outro,
  password,
  select,
  spinner,
  text,
} from "@clack/prompts";

import { cloneRepoIfNeeded, color, ensurePrerequisites, runCommand } from "./workspace.mjs";

const managedEnvKeys = [
  "NODE_ENV",
  "HOST",
  "PORT",
  "NOVA_WEB_HOST",
  "NOVA_WEB_PORT",
  "NEXT_PUBLIC_WEB_ORIGIN",
  "NOVA_APP_DATA_DIR",
  "NOVA_RUNTIME_MODE",
  "OPENCLAW_PROFILE",
  "OPENCLAW_BINARY_PATH",
  "CODEX_BINARY_PATH",
  "CLAUDE_BINARY_PATH",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
];

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

const serializeEnvValue = (value) => {
  if (/^[A-Za-z0-9_./:@+-]+$/.test(value)) {
    return value;
  }

  return JSON.stringify(value);
};

const readEnvFile = async (path) => {
  try {
    await access(path, constants.F_OK);
    return parseDotEnv(await readFile(path, "utf8"));
  } catch {
    return {};
  }
};

const writeEnvFile = async (path, envValues) => {
  const nextEnv = {};

  for (const [key, value] of Object.entries(envValues)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }

    nextEnv[key] = value;
  }

  const content = [
    "# Managed by nova-cli setup-production",
    ...Object.entries(nextEnv).map(([key, value]) => `${key}=${serializeEnvValue(value)}`),
    "",
  ].join("\n");

  await writeFile(path, content, "utf8");
};

const abortIfCancelled = (value) => {
  if (isCancel(value)) {
    throw new Error("Production setup cancelled.");
  }

  return value;
};

const promptText = async (message, options = {}) => {
  const value = await text({
    message,
    placeholder: options.placeholder,
    initialValue: options.initialValue,
    validate: options.validate,
  });

  return abortIfCancelled(value);
};

const promptPassword = async (message, options = {}) => {
  const value = await password({
    message,
    mask: "•",
    validate: options.validate,
  });

  return abortIfCancelled(value);
};

const promptConfirm = async (message, options = {}) => {
  const value = await confirm({
    message,
    initialValue: options.initialValue,
  });

  return abortIfCancelled(value);
};

const promptSelect = async (message, options) => {
  const value = await select({
    message,
    initialValue: options.initialValue,
    options: options.options,
  });

  return abortIfCancelled(value);
};

const detectBinary = (binary) =>
  new Promise((resolvePromise) => {
    const child = spawn("sh", ["-lc", `command -v ${binary}`], {
      stdio: ["ignore", "pipe", "ignore"],
      shell: false,
    });

    let stdout = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise(stdout.trim() || null);
        return;
      }

      resolvePromise(null);
    });
  });

const integerValidator = (label) => (value) => {
  if (!/^\d+$/.test(String(value).trim())) {
    return `${label} must be a positive integer.`;
  }

  const parsed = Number.parseInt(String(value).trim(), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return `${label} must be a positive integer.`;
  }

  return undefined;
};

const summarizeRuntimes = (runtimePaths) =>
  [
    `OpenClaw: ${runtimePaths.openclaw ?? "not found"}`,
    `Codex: ${runtimePaths.codex ?? "not found"}`,
    `Claude Code: ${runtimePaths.claude ?? "not found"}`,
  ].join("\n");

const buildProductionConfig = async ({ defaults, yes }) => {
  const lanIp = detectLanIp();
  const accessModeDefault =
    defaults.NOVA_WEB_HOST === "0.0.0.0" && defaults.NEXT_PUBLIC_WEB_ORIGIN?.includes("://")
      ? "lan"
      : "local";

  let accessMode = accessModeDefault;

  if (!yes) {
    accessMode = await promptSelect("How should the Nova web app be reachable?", {
      initialValue: accessModeDefault,
      options: [
        {
          value: "local",
          label: "Local only",
          hint: "Bind Nova to localhost on this Mac.",
        },
        {
          value: "lan",
          label: "Same network",
          hint: "Expose the web app on your LAN for other devices.",
        },
      ],
    });
  }

  const defaultAppDataDir =
    defaults.NOVA_APP_DATA_DIR || resolve(homedir(), "Library/Application Support/Nova");
  const defaultServerPort = defaults.PORT || "4000";
  const defaultWebPort = defaults.NOVA_WEB_PORT || "3000";
  const defaultServerHost = defaults.HOST || "127.0.0.1";
  const defaultWebHost =
    accessMode === "lan" ? "0.0.0.0" : defaults.NOVA_WEB_HOST || "127.0.0.1";
  const defaultWebOrigin =
    defaults.NEXT_PUBLIC_WEB_ORIGIN ||
    (accessMode === "lan" && lanIp
      ? `http://${lanIp}:${defaultWebPort}`
      : `http://127.0.0.1:${defaultWebPort}`);

  const appDataDir = yes
    ? defaultAppDataDir
    : await promptText("App data directory", {
        initialValue: defaultAppDataDir,
        validate: (value) => (!value.trim() ? "App data directory is required." : undefined),
      });

  const serverPort = yes
    ? defaultServerPort
    : await promptText("Backend port", {
        initialValue: defaultServerPort,
        validate: integerValidator("Backend port"),
      });

  const webPort = yes
    ? defaultWebPort
    : await promptText("Web port", {
        initialValue: defaultWebPort,
        validate: integerValidator("Web port"),
      });

  const webOriginDefault =
    accessMode === "lan" && lanIp
      ? `http://${lanIp}:${webPort}`
      : accessMode === "lan"
        ? defaultWebOrigin
        : `http://127.0.0.1:${webPort}`;

  const webOrigin = yes
    ? webOriginDefault
    : await promptText("Public web origin", {
        initialValue: webOriginDefault,
        validate: (value) =>
          /^https?:\/\//.test(value.trim()) ? undefined : "Enter a valid http:// or https:// URL.",
      });

  let runtimeMode = defaults.NOVA_RUNTIME_MODE || "openclaw";

  if (!yes) {
    runtimeMode = await promptSelect("Primary runtime mode", {
      initialValue: runtimeMode,
      options: [
        {
          value: "openclaw",
          label: "OpenClaw",
          hint: "Use a real local OpenClaw-backed runtime.",
        },
        {
          value: "mock",
          label: "Mock",
          hint: "UI-only setup without real runtime execution.",
        },
      ],
    });
  }

  let openClawProfile = defaults.OPENCLAW_PROFILE || "apm";

  if (runtimeMode === "openclaw" && !yes) {
    openClawProfile = await promptText("OpenClaw profile", {
      initialValue: openClawProfile,
      validate: (value) => (!value.trim() ? "OpenClaw profile is required." : undefined),
    });
  }

  return {
    accessMode,
    appDataDir,
    serverHost: defaultServerHost,
    serverPort,
    webHost: accessMode === "lan" ? "0.0.0.0" : defaultWebHost,
    webPort,
    webOrigin,
    runtimeMode,
    openClawProfile,
  };
};

const buildRuntimeOverrides = async ({ defaults, runtimePaths, yes, runtimeMode }) => {
  const initial = {
    openclaw: defaults.OPENCLAW_BINARY_PATH || runtimePaths.openclaw || "openclaw",
    codex: defaults.CODEX_BINARY_PATH || runtimePaths.codex || "codex",
    claude: defaults.CLAUDE_BINARY_PATH || runtimePaths.claude || "claude",
  };

  if (yes) {
    return initial;
  }

  const shouldEdit =
    runtimeMode === "openclaw" && !runtimePaths.openclaw
      ? true
      : await promptConfirm("Review runtime binary paths now?", {
          initialValue: false,
        });

  if (!shouldEdit) {
    return initial;
  }

  return {
    openclaw: await promptText("OpenClaw binary path", {
      initialValue: initial.openclaw,
      validate: (value) =>
        runtimeMode === "openclaw" && !value.trim()
          ? "OpenClaw binary path is required when runtime mode is OpenClaw."
          : undefined,
    }),
    codex: await promptText("Codex binary path", {
      initialValue: initial.codex,
    }),
    claude: await promptText("Claude Code binary path", {
      initialValue: initial.claude,
    }),
  };
};

const buildGoogleConfig = async ({ defaults, yes }) => {
  const currentlyEnabled = Boolean(
    defaults.GOOGLE_CLIENT_ID?.trim() && defaults.GOOGLE_CLIENT_SECRET?.trim()
  );

  const enabled = yes
    ? currentlyEnabled
    : await promptConfirm("Enable Google sign-in now?", {
        initialValue: currentlyEnabled,
      });

  if (!enabled) {
    return {
      enabled: false,
      clientId: null,
      clientSecret: null,
    };
  }

  const clientId = yes
    ? defaults.GOOGLE_CLIENT_ID || ""
    : await promptText("Google OAuth client ID", {
        initialValue: defaults.GOOGLE_CLIENT_ID || "",
        validate: (value) => (!value.trim() ? "Google client ID is required." : undefined),
      });

  const clientSecret = yes
    ? defaults.GOOGLE_CLIENT_SECRET || ""
    : await promptPassword("Google OAuth client secret", {
        validate: (value) => (!value.trim() ? "Google client secret is required." : undefined),
      });

  return {
    enabled: true,
    clientId,
    clientSecret,
  };
};

const buildActionPlan = async ({ yes, skipBuild, skipServiceInstall }) => {
  const canInstallService = process.platform === "darwin" && !skipServiceInstall;
  const installService = canInstallService
    ? yes
      ? true
      : await promptConfirm("Install Nova as a macOS background service?", {
          initialValue: true,
        })
    : false;

  if (installService && skipBuild) {
    throw new Error("--skip-build cannot be used together with service installation.");
  }

  return {
    installService,
    buildApp: installService ? true : !skipBuild,
  };
};

const buildEnvValues = ({ productionConfig, runtimeOverrides, googleConfig }) => ({
  NODE_ENV: "production",
  HOST: productionConfig.serverHost,
  PORT: productionConfig.serverPort,
  NOVA_WEB_HOST: productionConfig.webHost,
  NOVA_WEB_PORT: productionConfig.webPort,
  NEXT_PUBLIC_WEB_ORIGIN: productionConfig.webOrigin,
  NOVA_APP_DATA_DIR: productionConfig.appDataDir,
  NOVA_RUNTIME_MODE: productionConfig.runtimeMode,
  OPENCLAW_PROFILE:
    productionConfig.runtimeMode === "openclaw" ? productionConfig.openClawProfile : null,
  OPENCLAW_BINARY_PATH: runtimeOverrides.openclaw,
  CODEX_BINARY_PATH: runtimeOverrides.codex,
  CLAUDE_BINARY_PATH: runtimeOverrides.claude,
  GOOGLE_CLIENT_ID: googleConfig.enabled ? googleConfig.clientId : null,
  GOOGLE_CLIENT_SECRET: googleConfig.enabled ? googleConfig.clientSecret : null,
});

const buildSummary = ({ targetDir, productionConfig, runtimeOverrides, googleConfig, actions }) =>
  [
    `Project Root: ${targetDir}`,
    `App data: ${productionConfig.appDataDir}`,
    `Web: ${productionConfig.webOrigin}`,
    `Backend: http://${productionConfig.serverHost}:${productionConfig.serverPort}`,
    `Runtime mode: ${productionConfig.runtimeMode}`,
    `OpenClaw profile: ${productionConfig.runtimeMode === "openclaw" ? productionConfig.openClawProfile : "n/a"}`,
    `Runtime binaries:`,
    `  OpenClaw -> ${runtimeOverrides.openclaw}`,
    `  Codex -> ${runtimeOverrides.codex}`,
    `  Claude -> ${runtimeOverrides.claude}`,
    `Google sign-in: ${googleConfig.enabled ? "enabled" : "disabled"}`,
    `macOS service install: ${actions.installService ? "yes" : "no"}`,
    `Production build: ${actions.buildApp ? "yes" : "no"}`,
  ].join("\n");

const printNextSteps = ({ targetDir, installService, buildApp }) => {
  console.log("");
  console.log(color.green("Nova production setup is complete."));
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${targetDir}`);

  if (installService) {
    console.log("  pnpm service:macos:status");
  } else if (buildApp) {
    console.log("  pnpm start");
  } else {
    console.log("  pnpm build");
    console.log("  pnpm start");
  }
};

export const runProductionSetup = async ({ targetDir, options }) => {
  intro("Nova production setup");

  await ensurePrerequisites();
  await cloneRepoIfNeeded(targetDir, options);

  const envPath = resolve(targetDir, ".env.local");
  const defaults = await readEnvFile(envPath);
  const runtimePaths = {
    openclaw: await detectBinary("openclaw"),
    codex: await detectBinary("codex"),
    claude: await detectBinary("claude"),
  };

  note(summarizeRuntimes(runtimePaths), "Detected runtimes");

  const productionConfig = await buildProductionConfig({
    defaults,
    yes: options.yes,
  });
  const runtimeOverrides = await buildRuntimeOverrides({
    defaults,
    runtimePaths,
    yes: options.yes,
    runtimeMode: productionConfig.runtimeMode,
  });
  const googleConfig = await buildGoogleConfig({
    defaults,
    yes: options.yes,
  });
  const actions = await buildActionPlan({
    yes: options.yes,
    skipBuild: options.skipBuild,
    skipServiceInstall: options.skipServiceInstall,
  });

  const envValues = buildEnvValues({
    productionConfig,
    runtimeOverrides,
    googleConfig,
  });

  note(
    buildSummary({
      targetDir,
      productionConfig,
      runtimeOverrides,
      googleConfig,
      actions,
    }),
    "Summary"
  );

  if (!options.yes) {
    const shouldContinue = await promptConfirm("Proceed with production setup?", {
      initialValue: true,
    });

    if (!shouldContinue) {
      throw new Error("Production setup cancelled.");
    }
  }

  const progress = spinner();
  progress.start("Preparing Nova workspace...");

  try {
    if (!options.skipInstall) {
      progress.message("Installing dependencies...");
      await runCommand("pnpm", ["install"], { cwd: targetDir });
    }

    if (!options.skipBootstrap) {
      progress.message("Bootstrapping local Nova config...");
      await runCommand("pnpm", ["run", "setup"], { cwd: targetDir });
    }

    const currentEnv = await readEnvFile(envPath);
    const nextEnv = { ...currentEnv };

    for (const key of managedEnvKeys) {
      delete nextEnv[key];
    }

    Object.assign(nextEnv, envValues);

    progress.message("Writing production environment...");
    await writeEnvFile(envPath, nextEnv);

    if (actions.installService) {
      progress.message("Installing the macOS service...");
      await runCommand("pnpm", ["service:macos:install"], {
        cwd: targetDir,
      });
    } else if (actions.buildApp) {
      progress.message("Building Nova for production...");
      await runCommand("pnpm", ["build"], { cwd: targetDir });
    }

    progress.stop("Production setup complete.");
  } catch (error) {
    progress.stop("Production setup failed.");
    throw error;
  }

  outro("Nova production setup finished.");
  printNextSteps({
    targetDir,
    installService: actions.installService,
    buildApp: actions.buildApp,
  });
};
