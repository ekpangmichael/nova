import { constants } from "node:fs";
import { access, mkdir, readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { spawn } from "node:child_process";

export const DEFAULT_REPO_URL = "https://github.com/ekpangmichael/nova.git";
export const DEFAULT_TARGET_DIR = "nova";

export const color = {
  bold: (value) => `\x1b[1m${value}\x1b[0m`,
  dim: (value) => `\x1b[2m${value}\x1b[0m`,
  green: (value) => `\x1b[32m${value}\x1b[0m`,
  yellow: (value) => `\x1b[33m${value}\x1b[0m`,
  red: (value) => `\x1b[31m${value}\x1b[0m`,
};

export const runCommand = (command, args, { cwd, stdio = "inherit" } = {}) =>
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

export const runCommandCapture = (command, args, { cwd } = {}) =>
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

export const commandExists = async (command) => {
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

export const resolveLatestReleaseTag = async (repo) => {
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

export const pathExists = async (path) => {
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

export const ensurePrerequisites = async () => {
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

export const cloneRepoIfNeeded = async (targetDir, options) => {
  if (await looksLikeNovaCheckout(targetDir)) {
    console.log(color.dim(`Reusing existing Nova checkout in ${targetDir}`));
    return;
  }

  if (await pathExists(targetDir)) {
    const empty = await directoryIsEmpty(targetDir);

    if (!empty) {
      throw new Error(`Target directory ${targetDir} already exists and is not empty.`);
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

export const setupWorkspace = async (targetDir, options) => {
  if (!options.skipInstall) {
    console.log(color.bold("Installing dependencies"));
    await runCommand("pnpm", ["install"], { cwd: targetDir });
  }

  if (!options.skipBootstrap) {
    console.log(color.bold("Bootstrapping local Nova config"));
    await runCommand("pnpm", ["run", "setup"], { cwd: targetDir });
  }
};

export const printDevNextSteps = (targetDir) => {
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
