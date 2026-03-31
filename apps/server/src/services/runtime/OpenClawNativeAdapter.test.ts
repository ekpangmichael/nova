import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../../env.js";
import { OpenClawNativeAdapter } from "./OpenClawNativeAdapter.js";
import { OpenClawProcessManager } from "./OpenClawProcessManager.js";

const createEnvStub = (): AppEnv =>
  ({
    host: "127.0.0.1",
    port: 4010,
    nodeEnv: "test",
    repoRoot: "/tmp/nova",
    appDataDir: "/tmp/nova/.nova-data",
    dbPath: "/tmp/nova/.nova-data/db/app.db",
    attachmentsDir: "/tmp/nova/.nova-data/attachments",
    logsDir: "/tmp/nova/.nova-data/logs",
    tempDir: "/tmp/nova/.nova-data/temp",
    agentHomesDir: "/tmp/nova/.nova-data/agent-homes",
    runtimeMode: "openclaw",
    openclawProfile: "apm",
    openclawBinaryPath: "openclaw",
    openclawConfigPath: "/tmp/mock-openclaw/openclaw.json",
    openclawStateDir: "/tmp/mock-openclaw",
    openclawGatewayUrl: "ws://127.0.0.1:18789",
    enableOpenClawSmoke: false,
  }) satisfies AppEnv;

describe("OpenClawNativeAdapter.syncAgentWorkspace", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((directory) => rm(directory, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("falls back to the Nova agent name when IDENTITY.md is free-form", async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), "nova-openclaw-workspace-"));
    const runtimeStatePath = await mkdtemp(join(tmpdir(), "nova-openclaw-state-"));
    tempDirs.push(workspacePath, runtimeStatePath);
    const setIdentity = vi.fn().mockResolvedValue(undefined);
    const adapter = new OpenClawNativeAdapter(
      createEnvStub(),
      {
        setIdentity,
      } as unknown as OpenClawProcessManager
    );

    await adapter.syncAgentWorkspace({
      runtimeAgentId: "research-lead",
      workspacePath,
      runtimeStatePath,
      identityDefaults: {
        name: "Research Lead",
      },
      files: [
        {
          relativePath: "IDENTITY.md",
          content: "I am a careful research partner who values rigor over speed.",
        },
        {
          relativePath: "USER.md",
          content: "Use the repo and local docs before making claims.",
        },
      ],
    });

    expect(setIdentity).toHaveBeenCalledWith({
      runtimeAgentId: "research-lead",
      identity: {
        name: "Research Lead",
        theme: undefined,
        emoji: undefined,
        avatar: undefined,
      },
    });
    await expect(readFile(join(workspacePath, "IDENTITY.md"), "utf8")).resolves.toContain(
      "careful research partner"
    );
  });

  it("prefers explicit identity fields from IDENTITY.md when present", async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), "nova-openclaw-workspace-"));
    const runtimeStatePath = await mkdtemp(join(tmpdir(), "nova-openclaw-state-"));
    tempDirs.push(workspacePath, runtimeStatePath);
    const setIdentity = vi.fn().mockResolvedValue(undefined);
    const adapter = new OpenClawNativeAdapter(
      createEnvStub(),
      {
        setIdentity,
      } as unknown as OpenClawProcessManager
    );

    await adapter.syncAgentWorkspace({
      runtimeAgentId: "research-lead",
      workspacePath,
      runtimeStatePath,
      identityDefaults: {
        name: "Research Lead",
      },
      files: [
        {
          relativePath: "IDENTITY.md",
          content: [
            "- Name: Lead Researcher",
            "- Vibe: calm and deliberate",
            "- Emoji: 🔬",
            "- Avatar: avatars/research.png",
          ].join("\n"),
        },
      ],
    });

    expect(setIdentity).toHaveBeenCalledWith({
      runtimeAgentId: "research-lead",
      identity: {
        name: "Lead Researcher",
        theme: "calm and deliberate",
        emoji: "🔬",
        avatar: "avatars/research.png",
      },
    });
  });
});
