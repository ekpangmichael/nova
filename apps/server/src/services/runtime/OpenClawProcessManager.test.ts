import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { AppEnv } from "../../env.js";
import { OpenClawProcessManager } from "./OpenClawProcessManager.js";

const tempDirs: string[] = [];

const createMockOpenClawBinary = async (rootDir: string) => {
  const binaryPath = join(rootDir, "mock-openclaw");
  const script = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "agents" && args[1] === "add") {
  process.stdout.write("{}\\n");
  process.exit(0);
}
if (args[0] === "agents" && args[1] === "delete") {
  process.stdout.write("{}\\n");
  process.exit(0);
}
if (args[0] === "gateway" && args[1] === "restart") {
  process.stdout.write("{}\\n");
  process.exit(0);
}
if (args[0] === "--version") {
  process.stdout.write("openclaw 2026.3.24\\n");
  process.exit(0);
}
process.stdout.write("{}\\n");
process.exit(0);
`;

  await writeFile(binaryPath, script, "utf8");
  await chmod(binaryPath, 0o755);
  return binaryPath;
};

const createEnvStub = (input: {
  rootDir: string;
  binaryPath: string;
  stateDir: string;
  configPath: string;
}): AppEnv =>
  ({
    host: "127.0.0.1",
    port: 4010,
    nodeEnv: "test",
    repoRoot: input.rootDir,
    appDataDir: join(input.rootDir, ".nova-data"),
    dbPath: join(input.rootDir, ".nova-data", "db", "app.db"),
    attachmentsDir: join(input.rootDir, ".nova-data", "attachments"),
    logsDir: join(input.rootDir, ".nova-data", "logs"),
    tempDir: join(input.rootDir, ".nova-data", "temp"),
    agentHomesDir: join(input.rootDir, ".nova-data", "agent-homes"),
    runtimeMode: "mock",
    openclawProfile: "apm",
    openclawBinaryPath: input.binaryPath,
    openclawConfigPath: input.configPath,
    openclawStateDir: input.stateDir,
    openclawGatewayUrl: "ws://127.0.0.1:18789",
    openclawGatewayToken: null,
    codexBinaryPath: "codex",
    codexConfigPath: "/tmp/codex/config.toml",
    codexStateDir: "/tmp/codex",
    codexDefaultModel: "gpt-5.4",
    claudeBinaryPath: "claude",
    claudeConfigPath: "/tmp/claude/settings.json",
    claudeStateDir: "/tmp/claude",
    claudeDefaultModel: "claude-sonnet-4-6",
    enableOpenClawSmoke: false,
  }) satisfies AppEnv;

describe("OpenClawProcessManager", () => {
  afterEach(async () => {
    await Promise.all(tempDirs.map((directory) => rm(directory, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("adds provisioned agents to the main allowlist", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "nova-openclaw-process-"));
    const stateDir = join(rootDir, ".openclaw");
    const configPath = join(stateDir, "openclaw.json");
    tempDirs.push(rootDir);
    await mkdir(stateDir, { recursive: true });

    await writeFile(
      configPath,
      JSON.stringify(
        {
          list: [
            {
              id: "main",
              subagents: {
                allowAgents: ["atlas"],
              },
            },
          ],
        },
        null,
        2
      ),
      "utf8"
    );

    const binaryPath = await createMockOpenClawBinary(rootDir);
    const manager = new OpenClawProcessManager(
      createEnvStub({
        rootDir,
        binaryPath,
        stateDir,
        configPath,
      })
    );

    await manager.provisionAgent({
      runtimeAgentId: "research-lead",
      workspacePath: join(stateDir, "workspace-research-lead"),
      runtimeStatePath: join(stateDir, "agents", "research-lead", "agent"),
      defaultModelId: "openai-codex/gpt-5.4",
    });

    const parsed = JSON.parse(await readFile(configPath, "utf8")) as {
      list: Array<{
        id: string;
        subagents?: {
          allowAgents?: string[];
        };
      }>;
    };
    const main = parsed.list.find((entry) => entry.id === "main");
    expect(main?.subagents?.allowAgents).toEqual(["atlas", "research-lead"]);
  });

  it("adds provisioned agents to the nested agents.list allowlist shape", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "nova-openclaw-process-nested-"));
    const stateDir = join(rootDir, ".openclaw");
    const configPath = join(stateDir, "openclaw.json");
    tempDirs.push(rootDir);
    await mkdir(stateDir, { recursive: true });

    await writeFile(
      configPath,
      JSON.stringify(
        {
          agents: {
            list: [
              {
                id: "main",
                subagents: {
                  allowAgents: ["atlas"],
                },
              },
            ],
          },
        },
        null,
        2
      ),
      "utf8"
    );

    const binaryPath = await createMockOpenClawBinary(rootDir);
    const manager = new OpenClawProcessManager(
      createEnvStub({
        rootDir,
        binaryPath,
        stateDir,
        configPath,
      })
    );

    await manager.provisionAgent({
      runtimeAgentId: "nova",
      workspacePath: join(stateDir, "workspace-nova"),
      runtimeStatePath: join(stateDir, "agents", "nova", "agent"),
      defaultModelId: "openai-codex/gpt-5.4",
    });

    const parsed = JSON.parse(await readFile(configPath, "utf8")) as {
      agents?: {
        list?: Array<{
          id: string;
          subagents?: {
            allowAgents?: string[];
          };
        }>;
      };
    };
    const main = parsed.agents?.list?.find((entry) => entry.id === "main");
    expect(main?.subagents?.allowAgents).toEqual(["atlas", "nova"]);
  });

  it("removes deleted agents from the config and local OpenClaw folders", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "nova-openclaw-delete-"));
    const stateDir = join(rootDir, ".openclaw");
    const configPath = join(stateDir, "openclaw.json");
    const workspacePath = join(stateDir, "workspace-research-lead");
    const agentDir = join(stateDir, "agents", "research-lead", "agent");
    tempDirs.push(rootDir);

    await mkdir(workspacePath, { recursive: true });
    await mkdir(agentDir, { recursive: true });
    await writeFile(join(workspacePath, "AGENTS.md"), "# test\n", "utf8");
    await writeFile(join(agentDir, "state.json"), "{}\n", "utf8");
    await writeFile(
      configPath,
      JSON.stringify(
        {
          list: [
            {
              id: "main",
              subagents: {
                allowAgents: ["research-lead", "atlas"],
              },
            },
            {
              id: "research-lead",
              workspace: workspacePath,
              agentDir,
            },
          ],
        },
        null,
        2
      ),
      "utf8"
    );

    const binaryPath = await createMockOpenClawBinary(rootDir);
    const manager = new OpenClawProcessManager(
      createEnvStub({
        rootDir,
        binaryPath,
        stateDir,
        configPath,
      })
    );

    await manager.deleteAgent("research-lead");

    const parsed = JSON.parse(await readFile(configPath, "utf8")) as {
      list: Array<{
        id: string;
        subagents?: {
          allowAgents?: string[];
        };
      }>;
    };
    const main = parsed.list.find((entry) => entry.id === "main");
    expect(parsed.list.some((entry) => entry.id === "research-lead")).toBe(false);
    expect(main?.subagents?.allowAgents).toEqual(["atlas"]);
    await expect(readFile(join(workspacePath, "AGENTS.md"), "utf8")).rejects.toThrow();
    await expect(readFile(join(agentDir, "state.json"), "utf8")).rejects.toThrow();
  });
});
