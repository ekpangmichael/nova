import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rm, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { AppContext } from "./app.js";
import { createApp } from "./app.js";
import { normalizeAbsolutePath } from "./lib/paths.js";

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const waitFor = async <T>(
  load: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 2000
) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await load();

    if (predicate(value)) {
      return value;
    }

    await wait(25);
  }

  throw new Error("Timed out while waiting for the expected condition.");
};

const buildMultipartBody = (fileName: string, content: Buffer | string) => {
  const boundary = `----nova-${Date.now()}`;
  const fileBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  const chunks = [
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
        "Content-Type: text/plain\r\n\r\n",
      "utf8"
    ),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"),
  ];

  return {
    payload: Buffer.concat(chunks),
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
  };
};

const requestJson = async (
  context: AppContext,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  payload?: unknown
) => {
  const response = await context.app.inject({
    method,
    url,
    headers:
      payload === undefined
        ? undefined
        : {
            "content-type": "application/json",
          },
    payload: payload === undefined ? undefined : JSON.stringify(payload),
  });

  return {
    response,
    body: response.body ? response.json() : null,
  };
};

const readErrorMessage = (response: { body: string }) => {
  const parsed = JSON.parse(response.body) as {
    message?: string;
    error?: string | { message?: string };
  };

  if (parsed.message) {
    return parsed.message;
  }

  if (typeof parsed.error === "string") {
    return parsed.error;
  }

  return parsed.error?.message ?? "";
};

const createTestContext = async (
  overrides: Partial<NodeJS.ProcessEnv> = {}
): Promise<{ context: AppContext; appDataDir: string }> => {
  const appDataDir = await mkdtemp(join(tmpdir(), "nova-server-test-"));
  const context = await createApp({
    logger: false,
    envOverrides: {
      NODE_ENV: "test",
      NOVA_APP_DATA_DIR: appDataDir,
      NOVA_RUNTIME_MODE: "mock",
      ...overrides,
    },
  });

  return {
    context,
    appDataDir,
  };
};

describe("server integration", () => {
  let currentContext: AppContext | null = null;
  let currentAppDataDir: string | null = null;

  afterEach(async () => {
    if (currentContext) {
      await currentContext.app.close();
      currentContext = null;
    }

    if (currentAppDataDir) {
      await rm(currentAppDataDir, { recursive: true, force: true });
      currentAppDataDir = null;
    }
  });

  it("supports sync, comments, attachments, and the start-stop run lifecycle", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Nova",
      description: "Backend slice",
      projectRoot: "projects/nova",
      seedType: "git",
      seedUrl: "https://example.com/nova.git",
      tags: ["backend"],
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Builder",
      role: "Implementation",
      systemInstructions: "Stay within the execution target.",
      toolsText: "Use repo tools conservatively.",
    });

    expect(project.id).toBeTypeOf("string");
    expect(agent.id).toBeTypeOf("string");

    const { response: assignResponse } = await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );
    expect(assignResponse.statusCode).toBe(200);

    const projectRootGitPath = join(agent.agentHomePath, project.projectRoot, ".git");
    await expect(access(projectRootGitPath)).resolves.toBeUndefined();

    const { response: syncResponse, body: syncBody } = await requestJson(
      currentContext,
      "POST",
      `/api/agents/${agent.id}/sync-home`
    );
    expect(syncResponse.statusCode).toBe(200);
    expect(syncBody.files).toEqual(
      expect.arrayContaining(["AGENTS.md", "SOUL.md", "IDENTITY.md", "USER.md", "TOOLS.md"])
    );
    await expect(access(join(agent.agentHomePath, "AGENTS.md"))).resolves.toBeUndefined();
    await expect(
      access(join(agent.agentHomePath, ".apm", "runs"))
    ).resolves.toBeUndefined();

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Implement the monitor endpoints",
      description: "Add summary and recent failure monitoring.",
      assignedAgentId: agent.id,
      executionTargetOverride: "projects/nova/server",
      labels: ["monitoring"],
    });
    expect(task.taskNumber).toBe(1);
    expect(task.resolvedExecutionTarget).toBe("projects/nova/server");

    const { response: commentResponse, body: comment } = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/comments`,
      {
        body: "Start with the monitor summary query.",
      }
    );
    expect(commentResponse.statusCode).toBe(200);
    expect(comment.body).toContain("monitor summary");

    const attachmentContent = "Monitor summary fields and acceptance criteria.";
    const uploadRequest = buildMultipartBody("brief.txt", attachmentContent);
    const uploadResponse = await currentContext.app.inject({
      method: "POST",
      url: `/api/tasks/${task.id}/attachments`,
      headers: uploadRequest.headers,
      payload: uploadRequest.payload,
    });
    expect(uploadResponse.statusCode).toBe(200);
    const attachment = uploadResponse.json();
    expect(attachment.fileName).toBe("brief.txt");
    expect(attachment.sizeBytes).toBe(Buffer.byteLength(attachmentContent));
    expect(attachment.sha256).toBe(
      createHash("sha256").update(attachmentContent).digest("hex")
    );
    await expect(
      access(join(currentContext.env.attachmentsDir, attachment.relativeStoragePath))
    ).resolves.toBeUndefined();

    const { response: startResponse, body: run } = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/start`
    );
    expect(startResponse.statusCode).toBe(200);
    expect(run.taskId).toBe(task.id);

    const taskFilePath = join(
      agent.agentHomePath,
      ".apm",
      "runs",
      run.id,
      "TASK.md"
    );
    const taskFile = await readFile(taskFilePath, "utf8");
    expect(taskFile).toContain("Implement the monitor endpoints");
    expect(taskFile).toContain("projects/nova/server");
    expect(taskFile).toContain("- brief.txt");

    const activeRuns = await waitFor(
      async () => {
        const result = await requestJson(
          currentContext,
          "GET",
          "/api/monitor/active-runs"
        );
        return result.body;
      },
      (runs) => Array.isArray(runs) && runs.length === 1
    );
    expect(activeRuns[0].taskId).toBe(task.id);

    const { response: stopResponse, body: stoppedRun } = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/stop`
    );
    expect(stopResponse.statusCode).toBe(200);
    expect(stoppedRun.status).toBe("aborted");

    const pausedTask = await waitFor(
      async () => {
        const result = await requestJson(
          currentContext,
          "GET",
          `/api/tasks/${task.id}`
        );
        return result.body;
      },
      (value) => value.status === "paused" && value.currentRun === null
    );
    expect(pausedTask.attachments).toHaveLength(1);
    expect(pausedTask.comments).toHaveLength(1);

    const idleAgent = await waitFor(
      async () => {
        const result = await requestJson(
          currentContext,
          "GET",
          `/api/agents/${agent.id}`
        );
        return result.body;
      },
      (value) => value.status === "idle" && value.currentTaskId === null
    );
    expect(idleAgent.status).toBe("idle");

    const { body: runEvents } = await requestJson(
      currentContext,
      "GET",
      `/api/runs/${run.id}/events`
    );
    expect(runEvents.map((event: { eventType: string }) => event.eventType)).toEqual(
      expect.arrayContaining(["run.accepted", "run.aborted"])
    );
    expect(runEvents.map((event: { seq: number }) => event.seq)).toEqual(
      [...runEvents]
        .map((event: { seq: number }) => event.seq)
        .sort((left, right) => left - right)
    );
  });

  it("supports absolute project roots selected from the host filesystem", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const externalProjectRoot = join(setup.appDataDir, "picked-project-root");
    await mkdir(externalProjectRoot, { recursive: true });

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Absolute Root",
      description: "Selected from the host filesystem.",
      projectRoot: externalProjectRoot,
      seedType: "git",
      seedUrl: "https://example.com/absolute-root.git",
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Absolute Builder",
      role: "Implementation",
      systemInstructions: "Stay in the selected project root.",
    });

    expect(project.projectRoot).toBe(normalizeAbsolutePath(externalProjectRoot));

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );

    await expect(access(join(externalProjectRoot, ".git"))).resolves.toBeUndefined();

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Wire the host-root execution path",
      assignedAgentId: agent.id,
      executionTargetOverride: "server",
    });

    expect(task.resolvedExecutionTarget).toBe(
      normalizeAbsolutePath(join(externalProjectRoot, "server"))
    );

    const { body: run } = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/start`
    );
    const taskFile = await readFile(
      join(agent.agentHomePath, ".apm", "runs", run.id, "TASK.md"),
      "utf8"
    );

    expect(taskFile).toContain(normalizeAbsolutePath(join(externalProjectRoot, "server")));
  });

  it("rejects concurrent starts for the same agent and persists completed run history", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Nova 2",
      projectRoot: "projects/nova-two",
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Runner",
      role: "Execution",
      systemInstructions: "Finish the task and report the result.",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );

    const { body: firstTask } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "First task",
      assignedAgentId: agent.id,
    });
    const { body: secondTask } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Second task",
      assignedAgentId: agent.id,
    });

    const { body: run } = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${firstTask.id}/start`
    );
    expect(run.taskId).toBe(firstTask.id);

    const conflictingStart = await currentContext.app.inject({
      method: "POST",
      url: `/api/tasks/${secondTask.id}/start`,
    });
    expect(conflictingStart.statusCode).toBe(409);
    expect(readErrorMessage(conflictingStart)).toMatch(/not idle/i);

    const completedTask = await waitFor(
      async () => {
        const result = await requestJson(
          currentContext,
          "GET",
          `/api/tasks/${firstTask.id}`
        );
        return result.body;
      },
      (value) => value.status === "done"
    );
    expect(completedTask.currentRun).toBeNull();

    const { body: artifacts } = await requestJson(
      currentContext,
      "GET",
      `/api/runs/${run.id}/artifacts`
    );
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].kind).toBe("modified");

    const { body: monitorSummary } = await requestJson(
      currentContext,
      "GET",
      "/api/monitor/summary"
    );
    expect(monitorSummary.activeRunCount).toBe(0);
    expect(monitorSummary.agentCounts.working).toBe(0);
    expect(monitorSummary.openTaskCount).toBeGreaterThanOrEqual(1);
  });

  it("returns project backlog counts from the backend", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Backlog Count Project",
      projectRoot: "projects/backlog-count",
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Backlog Counter",
      role: "Execution",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );

    await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Backlog task",
      status: "backlog",
      assignedAgentId: agent.id,
    });
    await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Todo task",
      status: "todo",
      assignedAgentId: agent.id,
    });

    const { body: detail } = await requestJson(
      currentContext,
      "GET",
      `/api/projects/${project.id}`
    );
    const { body: projects } = await requestJson(currentContext, "GET", "/api/projects");
    const summary = projects.find((candidate: { id: string }) => candidate.id === project.id);

    expect(detail.backlogTaskCount).toBe(1);
    expect(detail.openTaskCount).toBe(2);
    expect(summary.backlogTaskCount).toBe(1);
    expect(summary.openTaskCount).toBe(2);
  });

  it("rejects starts when an attachment is missing on disk", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Nova 3",
      projectRoot: "projects/nova-three",
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Attachment Guard",
      role: "Execution",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Attachment validation",
      assignedAgentId: agent.id,
    });

    const uploadRequest = buildMultipartBody("notes.txt", "Important notes");
    const uploadResponse = await currentContext.app.inject({
      method: "POST",
      url: `/api/tasks/${task.id}/attachments`,
      headers: uploadRequest.headers,
      payload: uploadRequest.payload,
    });
    expect(uploadResponse.statusCode).toBe(200);
    const attachment = uploadResponse.json();

    await unlink(join(currentContext.env.attachmentsDir, attachment.relativeStoragePath));

    const startResponse = await currentContext.app.inject({
      method: "POST",
      url: `/api/tasks/${task.id}/start`,
    });
    expect(startResponse.statusCode).toBe(409);
    expect(readErrorMessage(startResponse)).toMatch(/missing on disk/i);
  });

  it("returns 503 when runtime health is degraded", async () => {
    const setup = await createTestContext({
      NOVA_RUNTIME_MODE: "openclaw",
      OPENCLAW_BINARY_PATH: "definitely-missing-openclaw",
    });
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Nova 4",
      projectRoot: "projects/nova-four",
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "OpenClaw",
      role: "Execution",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "OpenClaw health gate",
      assignedAgentId: agent.id,
    });

    const startResponse = await currentContext.app.inject({
      method: "POST",
      url: `/api/tasks/${task.id}/start`,
    });
    expect(startResponse.statusCode).toBe(503);
    expect(readErrorMessage(startResponse)).toMatch(/runtime health/i);
  });
});
