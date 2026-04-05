#!/usr/bin/env node

import { access, mkdir, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, resolve } from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_REPO_URL = "https://github.com/ekpangmichael/nova.git";
const DEFAULT_TARGET_DIR = "nova";

const color = {
  bold: (value) => `\x1b[1m${value}\x1b[0m`,
  dim: (value) => `\x1b[2m${value}\x1b[0m`,
  green: (value) => `\x1b[32m${value}\x1b[0m`,
  yellow: (value) => `\x1b[33m${value}\x1b[0m`,
  red: (value) => `\x1b[31m${value}\x1b[0m`,
};

const printUsage = () => {
  console.log(`Nova CLI

Usage:
  nova setup [directory] [--repo <url>] [--ref <git-ref>] [--skip-install] [--skip-bootstrap]
  nova --help

Examples:
  npx nova-cli@latest setup
  npx nova-cli@latest setup my-nova
  npx nova-cli@latest setup my-nova --ref main
`);
};

const parseArgs = (argv) => {
  const positional = [];
  const options = {
    repo: DEFAULT_REPO_URL,
    ref: null,
    skipInstall: false,
    skipBootstrap: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    if (token === "--skip-install") {
      options.skipInstall = true;
      continue;
    }

    if (token === "--skip-bootstrap") {
      options.skipBootstrap = true;
      continue;
    }

    if (token === "--repo" || token === "--ref") {
      const next = argv[index + 1];

      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for ${token}`);
      }

      if (token === "--repo") {
        options.repo = next;
      } else {
        options.ref = next;
      }

      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${token}`);
  }

  return { positional, options };
};

const runCommand = (command, args, { cwd, stdio = "inherit" } = {}) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio,
      shell: false,
    });

    child.on("error", (error) => {
      rejectPromise(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });

const runCommandCapture = (command, args, { cwd } = {}) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      rejectPromise(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      rejectPromise(
        new Error(`${command} ${args.join(" ")} exited with code ${code}\n${stderr}`.trim())
      );
    });
  });

const commandExists = async (command) => {
  try {
    await runCommand("sh", ["-lc", `command -v ${command}`], {
      cwd: process.cwd(),
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
};

const compareSemverDesc = (left, right) => {
  const normalize = (value) =>
    value
      .replace(/^v/i, "")
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);

  const leftParts = normalize(left);
  const rightParts = normalize(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const delta = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);

    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
};

const resolveLatestReleaseTag = async (repo) => {
  try {
    const { stdout } = await runCommandCapture("git", ["ls-remote", "--tags", repo]);
    const tags = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split("\t")[1] ?? "")
      .filter((ref) => ref.startsWith("refs/tags/"))
      .map((ref) => ref.replace("refs/tags/", ""))
      .filter((tag) => !tag.endsWith("^{}"))
      .filter((tag) => /^v?\d+\.\d+\.\d+$/.test(tag))
      .sort(compareSemverDesc);

    return tags[0] ?? null;
  } catch {
    return null;
  }
};

const pathExists = async (path) => {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const directoryIsEmpty = async (directory) => {
  const entries = await readdir(directory);
  return entries.length === 0;
};

const looksLikeNovaCheckout = async (directory) => {
  return (
    (await pathExists(resolve(directory, "package.json"))) &&
    (await pathExists(resolve(directory, "scripts/setup.mjs")))
  );
};

const ensurePrerequisites = async () => {
  const requirements = ["git", "pnpm"];
  const missing = [];

  for (const requirement of requirements) {
    if (!(await commandExists(requirement))) {
      missing.push(requirement);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required tools: ${missing.join(", ")}. Install them before running nova setup.`
    );
  }
};

const cloneRepoIfNeeded = async (targetDir, options) => {
  if (await looksLikeNovaCheckout(targetDir)) {
    console.log(color.dim(`Reusing existing Nova checkout in ${targetDir}`));
    return;
  }

  if (await pathExists(targetDir)) {
    const empty = await directoryIsEmpty(targetDir);

    if (!empty) {
      throw new Error(
        `Target directory ${targetDir} already exists and is not empty.`
      );
    }
  } else {
    await mkdir(targetDir, { recursive: true });
  }

  const desiredRef = options.ref ?? (await resolveLatestReleaseTag(options.repo));
  const cloneArgs = ["clone"];

  if (desiredRef) {
    cloneArgs.push("--branch", desiredRef, "--depth", "1");
  }

  cloneArgs.push(options.repo, targetDir);

  console.log(color.bold(`Cloning Nova into ${targetDir}`));
  if (desiredRef && !options.ref) {
    console.log(color.dim(`Using latest tagged release ${desiredRef}`));
  } else if (desiredRef) {
    console.log(color.dim(`Using requested ref ${desiredRef}`));
  } else {
    console.log(color.dim("No release tags found. Falling back to the repository default branch."));
  }

  await runCommand("git", cloneArgs, { cwd: process.cwd() });
};

const setupWorkspace = async (targetDir, options) => {
  if (!options.skipInstall) {
    console.log(color.bold("Installing dependencies"));
    await runCommand("pnpm", ["install"], { cwd: targetDir });
  }

  if (!options.skipBootstrap) {
    console.log(color.bold("Bootstrapping local Nova config"));
    await runCommand("pnpm", ["setup"], { cwd: targetDir });
  }
};

const printNextSteps = (targetDir) => {
  const relativeTarget =
    resolve(targetDir) === resolve(process.cwd()) ? "." : basename(resolve(targetDir));

  console.log("");
  console.log(color.green("Nova is ready to start."));
  console.log("");
  console.log("Next steps:");
  if (relativeTarget !== ".") {
    console.log(`  cd ${relativeTarget}`);
  }
  console.log("  pnpm dev");
};

const main = async () => {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return;
  }

  const command = argv[0];
  const { positional, options } = parseArgs(argv.slice(1));

  if (command !== "setup") {
    throw new Error(`Unknown command: ${command}`);
  }

  const targetDir = resolve(process.cwd(), positional[0] ?? DEFAULT_TARGET_DIR);

  await ensurePrerequisites();
  await cloneRepoIfNeeded(targetDir, options);
  await setupWorkspace(targetDir, options);
  printNextSteps(targetDir);
};

main().catch((error) => {
  console.error("");
  console.error(color.red("Nova CLI failed."));
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
