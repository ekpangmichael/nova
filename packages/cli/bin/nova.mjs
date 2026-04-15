#!/usr/bin/env node

import { resolve } from "node:path";

import { runProductionSetup } from "../lib/production-setup.mjs";
import {
  color,
  DEFAULT_REPO_URL,
  DEFAULT_TARGET_DIR,
  cloneRepoIfNeeded,
  ensurePrerequisites,
  printDevNextSteps,
  setupWorkspace,
} from "../lib/workspace.mjs";

const printUsage = () => {
  console.log(`Nova CLI

Usage:
  nova setup [directory] [--repo <url>] [--ref <git-ref>] [--skip-install] [--skip-bootstrap]
  nova setup-production [directory] [--repo <url>] [--ref <git-ref>] [--yes] [--skip-install] [--skip-bootstrap] [--skip-build] [--skip-service-install]
  nova --help

Examples:
  npx nova-cli@latest setup
  npx nova-cli@latest setup my-nova
  npx nova-cli@latest setup my-nova --ref main
  npx nova-cli@latest setup-production
  npx nova-cli@latest setup-production my-nova --yes --skip-service-install
`);
};

const parseArgs = (argv) => {
  const positional = [];
  const options = {
    repo: DEFAULT_REPO_URL,
    ref: null,
    skipInstall: false,
    skipBootstrap: false,
    skipBuild: false,
    skipServiceInstall: false,
    yes: false,
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

    if (token === "--skip-build") {
      options.skipBuild = true;
      continue;
    }

    if (token === "--skip-service-install") {
      options.skipServiceInstall = true;
      continue;
    }

    if (token === "--yes") {
      options.yes = true;
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

const main = async () => {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return;
  }

  const command = argv[0];
  const { positional, options } = parseArgs(argv.slice(1));
  const targetDir = resolve(process.cwd(), positional[0] ?? DEFAULT_TARGET_DIR);

  if (command === "setup") {
    await ensurePrerequisites();
    await cloneRepoIfNeeded(targetDir, options);
    await setupWorkspace(targetDir, options);
    printDevNextSteps(targetDir);
    return;
  }

  if (command === "setup-production") {
    await runProductionSetup({
      targetDir,
      options,
    });
    return;
  }

  throw new Error(`Unknown command: ${command}`);
};

main().catch((error) => {
  console.error("");
  console.error(color.red("Nova CLI failed."));
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
