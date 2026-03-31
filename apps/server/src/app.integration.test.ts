import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { agents, tasks } from "@nova/db";
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
  payload?: unknown,
  headers?: Record<string, string>
) => {
  const response = await context.app.inject({
    method,
    url,
    headers:
      payload === undefined
        ? headers
        : {
            ...(headers ?? {}),
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

const createAuthHeaders = async (
  context: AppContext,
  input: {
    displayName: string;
    email: string;
    password?: string;
  }
) => {
  const session = await context.services.auth.signUp({
    displayName: input.displayName,
    email: input.email,
    password: input.password ?? "supersecret123",
  });

  return {
    "x-nova-session-token": session.sessionToken,
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

  it("supports email/password signup, session lookup, signout, and sign in", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const { response: signUpResponse, body: signUpBody } = await requestJson(
      currentContext,
      "POST",
      "/api/auth/signup",
      {
        displayName: "Nova Operator",
        email: "operator@example.com",
        password: "supersecret123",
      }
    );

    expect(signUpResponse.statusCode).toBe(200);
    expect(signUpBody.user.email).toBe("operator@example.com");
    expect(signUpBody.sessionToken).toBeTypeOf("string");

    const sessionToken = signUpBody.sessionToken as string;

    const sessionResponse = await currentContext.app.inject({
      method: "GET",
      url: "/api/auth/session",
      headers: {
        "x-nova-session-token": sessionToken,
      },
    });

    expect(sessionResponse.statusCode).toBe(200);
    expect(sessionResponse.json().user.displayName).toBe("Nova Operator");

    const duplicateResponse = await currentContext.app.inject({
      method: "POST",
      url: "/api/auth/signup",
      headers: {
        "content-type": "application/json",
      },
      payload: JSON.stringify({
        displayName: "Nova Operator",
        email: "operator@example.com",
        password: "supersecret123",
      }),
    });

    expect(duplicateResponse.statusCode).toBe(409);

    const signOutResponse = await currentContext.app.inject({
      method: "POST",
      url: "/api/auth/signout",
      headers: {
        "x-nova-session-token": sessionToken,
      },
    });

    expect(signOutResponse.statusCode).toBe(204);

    const expiredSessionResponse = await currentContext.app.inject({
      method: "GET",
      url: "/api/auth/session",
      headers: {
        "x-nova-session-token": sessionToken,
      },
    });

    expect(expiredSessionResponse.statusCode).toBe(401);

    const { response: signInResponse, body: signInBody } = await requestJson(
      currentContext,
      "POST",
      "/api/auth/signin",
      {
        email: "operator@example.com",
        password: "supersecret123",
      }
    );

    expect(signInResponse.statusCode).toBe(200);
    expect(signInBody.user.displayName).toBe("Nova Operator");
    expect(signInBody.sessionToken).toBeTypeOf("string");
  });

  it("supports Google-backed session creation and linking to an existing email account", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const { response: googleCreateResponse, body: googleCreateBody } = await requestJson(
      currentContext,
      "POST",
      "/api/auth/google",
      {
        email: "google-user@example.com",
        displayName: "Google User",
        googleSub: "google-sub-1",
        emailVerified: true,
      }
    );

    expect(googleCreateResponse.statusCode).toBe(200);
    expect(googleCreateBody.user.email).toBe("google-user@example.com");
    expect(googleCreateBody.sessionToken).toBeTypeOf("string");

    const linkedEmail = "linked@example.com";
    await requestJson(currentContext, "POST", "/api/auth/signup", {
      displayName: "Linked User",
      email: linkedEmail,
      password: "supersecret123",
    });

    const { response: googleLinkResponse, body: googleLinkBody } = await requestJson(
      currentContext,
      "POST",
      "/api/auth/google",
      {
        email: linkedEmail,
        displayName: "Linked via Google",
        googleSub: "google-sub-2",
        emailVerified: true,
      }
    );

    expect(googleLinkResponse.statusCode).toBe(200);
    expect(googleLinkBody.user.email).toBe(linkedEmail);
    expect(googleLinkBody.user.displayName).toBe("Linked via Google");
  });

  it("protects application routes in non-test mode and records the signed-in operator name on tasks and comments", async () => {
    const appDataDir = await mkdtemp(join(tmpdir(), "nova-auth-enforced-"));
    currentAppDataDir = appDataDir;
    currentContext = await createApp({
      logger: false,
      envOverrides: {
        NODE_ENV: "development",
        NOVA_APP_DATA_DIR: appDataDir,
        NOVA_RUNTIME_MODE: "mock",
      },
    });

    const unauthenticatedProjectsResponse = await currentContext.app.inject({
      method: "GET",
      url: "/api/projects",
    });

    expect(unauthenticatedProjectsResponse.statusCode).toBe(401);

    const authHeaders = await createAuthHeaders(currentContext, {
      displayName: "Signed In Operator",
      email: "signed-in-operator@example.com",
    });

    const { body: project } = await requestJson(
      currentContext,
      "POST",
      "/api/projects",
      {
        name: "Protected Project",
        description: "Checks authenticated task authorship.",
        projectRoot: "projects/protected",
        seedType: "none",
      },
      authHeaders
    );

    const { body: agent } = await requestJson(
      currentContext,
      "POST",
      "/api/agents",
      {
        name: "Protected Agent",
        role: "Implementation",
        systemInstructions: "Stay on task.",
      },
      authHeaders
    );

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`,
      undefined,
      authHeaders
    );

    const { body: task } = await requestJson(
      currentContext,
      "POST",
      "/api/tasks",
      {
        projectId: project.id,
        title: "Protected task",
        assignedAgentId: agent.id,
      },
      authHeaders
    );

    expect(task.createdBy).toBe("Signed In Operator");

    const { body: comment } = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/comments`,
      {
        body: "Please handle this as the signed-in operator.",
      },
      authHeaders
    );

    expect(comment.authorType).toBe("user");
    expect(comment.authorId).toBe("Signed In Operator");
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

    const { response: projectTasksResponse, body: projectTasks } = await requestJson(
      currentContext,
      "GET",
      `/api/projects/${project.id}/tasks`
    );
    expect(projectTasksResponse.statusCode).toBe(200);
    expect(projectTasks).toHaveLength(1);
    expect(projectTasks[0].id).toBe(task.id);
    expect(projectTasks[0].assignedAgent.id).toBe(agent.id);
    expect(projectTasks[0].commentCount).toBe(0);
    expect(projectTasks[0].attachmentCount).toBe(0);

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
    const runtimeConfig = JSON.parse(
      await readFile(join(agent.agentHomePath, ".apm", "runs", run.id, "NOVA_RUNTIME.json"), "utf8")
    ) as {
      baseUrl: string;
      taskId: string;
      runId: string;
      agentId: string;
      token: string;
    };
    expect(runtimeConfig.taskId).toBe(task.id);
    expect(runtimeConfig.runId).toBe(run.id);
    expect(runtimeConfig.agentId).toBe(agent.id);
    expect(runtimeConfig.baseUrl).toContain("127.0.0.1");
    expect(runtimeConfig.token).toMatch(/^[a-f0-9]{48}$/);

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
    expect(pausedTask.comments).toHaveLength(2);
    expect(
      pausedTask.comments.some(
        (comment: { source: string; body: string }) =>
          comment.source === "system" && comment.body.includes("Run stopped")
      )
    ).toBe(true);

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

  it("forwards active task comments into the runtime session and accepts agent bridge updates", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Bridge Project",
      description: "Bridge test",
      projectRoot: "projects/bridge",
      seedType: "none",
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Bridge Agent",
      role: "Execution",
      systemInstructions: "Follow TASK.md and report progress.",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Bridge ticket",
      description: "Exercise the Nova runtime bridge.",
      assignedAgentId: agent.id,
      executionTargetOverride: "projects/bridge/runtime",
    });

    const { body: run } = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/start`
    );
    const runtimeConfig = JSON.parse(
      await readFile(
        join(agent.agentHomePath, ".apm", "runs", run.id, "NOVA_RUNTIME.json"),
        "utf8"
      )
    ) as {
      token: string;
    };

    const { response: commentResponse } = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/comments`,
      {
        body: "Please post a checkpoint after you inspect the target.",
      }
    );
    expect(commentResponse.statusCode).toBe(200);

    const mirroredTask = await waitFor(
      async () => {
        const result = await requestJson(
          currentContext,
          "GET",
          `/api/tasks/${task.id}`
        );
        return result.body;
      },
      (value) =>
        value.comments.some(
          (comment: { source: string; body: string }) =>
            comment.source === "agent_mirror" &&
            comment.body.includes("Please post a checkpoint")
        )
    );
    expect(
      mirroredTask.comments.some(
        (comment: { source: string; body: string }) =>
          comment.source === "ticket_user" &&
          comment.body.includes("Please post a checkpoint")
      )
    ).toBe(true);

    const bridgeHeaders = {
      authorization: `Bearer ${runtimeConfig.token}`,
    };

    const { response: agentCommentResponse } = await requestJson(
      currentContext,
      "POST",
      `/api/agent-runtime/tasks/${task.id}/comments`,
      {
        body: "Investigation complete. Applying the patch next.",
      },
      bridgeHeaders
    );
    expect(agentCommentResponse.statusCode).toBe(200);

    await waitFor(
      async () => {
        const result = await requestJson(
          currentContext,
          "GET",
          `/api/tasks/${task.id}`
        );
        return result.body;
      },
      (value) => value.status === "in_review"
    );

    const { response: postCompletionCommentResponse } = await requestJson(
      currentContext,
      "POST",
      `/api/agent-runtime/tasks/${task.id}/comments`,
      {
        body: "Awaiting operator confirmation before changing the color.",
      },
      bridgeHeaders
    );
    expect(postCompletionCommentResponse.statusCode).toBe(200);

    const { response: checkpointResponse } = await requestJson(
      currentContext,
      "POST",
      `/api/agent-runtime/tasks/${task.id}/checkpoints`,
      {
        state: "working",
        summary: "Patch in progress",
        details: "Route and runtime wiring are being updated.",
      },
      bridgeHeaders
    );
    expect(checkpointResponse.statusCode).toBe(200);

    const artifactPath = join(
      agent.agentHomePath,
      ".apm",
      "runs",
      run.id,
      "outputs",
      "bridge-report.md"
    );
    await writeFile(artifactPath, "# Bridge Report\n\nRuntime bridge verified.\n", "utf8");

    const { response: artifactResponse } = await requestJson(
      currentContext,
      "POST",
      `/api/agent-runtime/tasks/${task.id}/artifacts`,
      {
        kind: "output",
        path: artifactPath,
        label: "Bridge report",
        summary: "Smoke output from the Nova bridge test.",
      },
      bridgeHeaders
    );
    expect(artifactResponse.statusCode).toBe(200);

    const { body: runEvents } = await requestJson(
      currentContext,
      "GET",
      `/api/runs/${run.id}/events`
    );
    expect(runEvents.map((event: { eventType: string }) => event.eventType)).toEqual(
      expect.arrayContaining(["warning", "artifact.created"])
    );

    const { body: artifacts } = await requestJson(
      currentContext,
      "GET",
      `/api/runs/${run.id}/artifacts`
    );
    expect(
      artifacts.some(
        (artifact: { label: string | null; summary: string | null }) =>
          artifact.label === "Bridge report" &&
          artifact.summary === "Smoke output from the Nova bridge test."
      )
    ).toBe(true);
  });

  it("treats needs_input as waiting for operator input and auto-resumes on a new operator comment", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Needs Input Project",
      description: "Waiting state test",
      projectRoot: "projects/needs-input",
      seedType: "none",
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Needs Input Agent",
      role: "Execution",
      systemInstructions: "Ask for confirmation when the operator leaves a decision open.",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Needs input ticket",
      description: "Ask for a color before making the change.",
      assignedAgentId: agent.id,
      executionTargetOverride: "projects/needs-input/runtime",
    });

    const { body: run } = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/start`
    );
    const runtimeConfig = JSON.parse(
      await readFile(
        join(agent.agentHomePath, ".apm", "runs", run.id, "NOVA_RUNTIME.json"),
        "utf8"
      )
    ) as {
      token: string;
    };

    const bridgeHeaders = {
      authorization: `Bearer ${runtimeConfig.token}`,
    };

    const { response: checkpointResponse } = await requestJson(
      currentContext,
      "POST",
      `/api/agent-runtime/tasks/${task.id}/checkpoints`,
      {
        state: "needs_input",
        summary: "Waiting for operator confirmation",
        details: "Need the exact title color before making the change.",
      },
      bridgeHeaders
    );
    expect(checkpointResponse.statusCode).toBe(200);

    const { response: questionResponse } = await requestJson(
      currentContext,
      "POST",
      `/api/agent-runtime/tasks/${task.id}/comments`,
      {
        body: "Which color should I use for the title?",
      },
      bridgeHeaders
    );
    expect(questionResponse.statusCode).toBe(200);

    const waitingTask = await waitFor(
      async () => {
        const result = await requestJson(
          currentContext,
          "GET",
          `/api/tasks/${task.id}`
        );
        return result.body;
      },
      (value) => value.status === "blocked" && value.currentRun === null
    );
    expect(waitingTask.recentRuns[0].finalSummary).toBe("Awaiting operator input.");
    expect(
      waitingTask.comments.some(
        (comment: { source: string; body: string }) =>
          comment.source === "agent_api" &&
          comment.body.includes("Which color should I use for the title?")
      )
    ).toBe(true);
    expect(
      waitingTask.comments.some(
        (comment: { source: string; body: string }) =>
          comment.source === "agent_mirror" &&
          comment.body.includes("Mock runtime completed the requested work.")
      )
    ).toBe(false);

    const { response: operatorCommentResponse } = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/comments`,
      {
        body: "Use #4F46E5 for the title color.",
      }
    );
    expect(operatorCommentResponse.statusCode).toBe(200);

    const resumedTask = await waitFor(
      async () => {
        const result = await requestJson(
          currentContext,
          "GET",
          `/api/tasks/${task.id}`
        );
        return result.body;
      },
      (value) => value.status === "in_review" && value.recentRuns.length >= 2
    );
    expect(resumedTask.comments.some((comment: { body: string }) => comment.body.includes("#4F46E5"))).toBe(true);
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

  it("deletes a project, unlinks assigned agents, terminates active runs, and removes project tasks", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Disposable Project",
      description: "Delete me",
      projectRoot: "projects/disposable",
      seedType: "none",
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Disposable Agent",
      role: "Execution",
      systemInstructions: "Stay within the execution target.",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Disposable Task",
      description: "Should disappear with the project.",
      assignedAgentId: agent.id,
      executionTargetOverride: "projects/disposable/runtime",
    });

    const uploadRequest = buildMultipartBody("delete-me.txt", "temporary content");
    const uploadResponse = await currentContext.app.inject({
      method: "POST",
      url: `/api/tasks/${task.id}/attachments`,
      payload: uploadRequest.payload,
      headers: uploadRequest.headers,
    });
    expect(uploadResponse.statusCode).toBe(200);

    const { body: run } = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/start`
    );
    const runDir = join(agent.agentHomePath, ".apm", "runs", run.id);
    await expect(access(runDir)).resolves.toBeUndefined();

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

    const deleteResponse = await currentContext.app.inject({
      method: "DELETE",
      url: `/api/projects/${project.id}`,
    });
    expect(deleteResponse.statusCode).toBe(204);

    const deletedProjectResponse = await currentContext.app.inject({
      method: "GET",
      url: `/api/projects/${project.id}`,
    });
    expect(deletedProjectResponse.statusCode).toBe(404);

    const deletedTaskResponse = await currentContext.app.inject({
      method: "GET",
      url: `/api/tasks/${task.id}`,
    });
    expect(deletedTaskResponse.statusCode).toBe(404);

    const { body: updatedAgent } = await requestJson(
      currentContext,
      "GET",
      `/api/agents/${agent.id}`
    );
    expect(updatedAgent.projectIds).not.toContain(project.id);
    expect(updatedAgent.currentTaskId).toBeNull();
    expect(updatedAgent.status).toBe("idle");

    await expect(access(runDir)).rejects.toThrow();

    const remainingActiveRuns = await requestJson(
      currentContext,
      "GET",
      "/api/monitor/active-runs"
    );
    expect(remainingActiveRuns.body).toHaveLength(0);
  });

  it("deletes an agent and unlinks it from assigned projects when it owns no tasks", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Agent Delete Project",
      projectRoot: "projects/agent-delete",
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Disposable Worker",
      role: "Execution",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );

    const deleteResponse = await currentContext.app.inject({
      method: "DELETE",
      url: `/api/agents/${agent.id}`,
    });
    expect(deleteResponse.statusCode).toBe(204);

    const deletedAgentResponse = await currentContext.app.inject({
      method: "GET",
      url: `/api/agents/${agent.id}`,
    });
    expect(deletedAgentResponse.statusCode).toBe(404);

    const { body: updatedProject } = await requestJson(
      currentContext,
      "GET",
      `/api/projects/${project.id}`
    );
    expect(updatedProject.assignedAgentIds).not.toContain(agent.id);
  });

  it("deletes a task, terminates its active run, and removes task artifacts", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Task Delete Project",
      projectRoot: "projects/task-delete",
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Task Delete Agent",
      role: "Execution",
      systemInstructions: "Delete smoke test agent.",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Delete This Task",
      description: "Should disappear cleanly.",
      assignedAgentId: agent.id,
      executionTargetOverride: "projects/task-delete/runtime",
    });

    const uploadRequest = buildMultipartBody("delete-task.txt", "task attachment");
    const uploadResponse = await currentContext.app.inject({
      method: "POST",
      url: `/api/tasks/${task.id}/attachments`,
      payload: uploadRequest.payload,
      headers: uploadRequest.headers,
    });
    expect(uploadResponse.statusCode).toBe(200);

    const { body: run } = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/start`
    );
    const runDir = join(agent.agentHomePath, ".apm", "runs", run.id);

    const activeRuns = await waitFor(
      async () => {
        const result = await requestJson(currentContext, "GET", "/api/monitor/active-runs");
        return result.body;
      },
      (runs) => Array.isArray(runs) && runs.length === 1
    );
    expect(activeRuns[0].taskId).toBe(task.id);

    const deleteResponse = await currentContext.app.inject({
      method: "DELETE",
      url: `/api/tasks/${task.id}`,
    });
    expect(deleteResponse.statusCode).toBe(204);

    const deletedTaskResponse = await currentContext.app.inject({
      method: "GET",
      url: `/api/tasks/${task.id}`,
    });
    expect(deletedTaskResponse.statusCode).toBe(404);

    const remainingActiveRuns = await requestJson(
      currentContext,
      "GET",
      "/api/monitor/active-runs"
    );
    expect(remainingActiveRuns.body).toHaveLength(0);

    const { body: updatedAgent } = await requestJson(
      currentContext,
      "GET",
      `/api/agents/${agent.id}`
    );
    expect(updatedAgent.currentTaskId).toBeNull();
    expect(updatedAgent.status).toBe("idle");

    await expect(access(runDir)).rejects.toThrow();
    await expect(access(join(currentContext.env.attachmentsDir, task.id))).rejects.toThrow();
  });

  it("rejects deleting an agent that still owns tasks", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Agent Task Ownership Project",
      projectRoot: "projects/agent-ownership",
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Owned Task Agent",
      role: "Execution",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );

    await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Pinned Task",
      assignedAgentId: agent.id,
    });

    const deleteResponse = await currentContext.app.inject({
      method: "DELETE",
      url: `/api/agents/${agent.id}`,
    });
    expect(deleteResponse.statusCode).toBe(409);
    expect(readErrorMessage(deleteResponse)).toMatch(/still owns 1 task/i);

    const remainingAgentResponse = await currentContext.app.inject({
      method: "GET",
      url: `/api/agents/${agent.id}`,
    });
    expect(remainingAgentResponse.statusCode).toBe(200);
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
      (value) => value.status === "in_review"
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
    expect(monitorSummary.totalProjectCount).toBeGreaterThanOrEqual(1);
    expect(monitorSummary.activeProjectCount).toBeGreaterThanOrEqual(1);
    expect(monitorSummary.totalAgentCount).toBeGreaterThanOrEqual(1);
    expect(monitorSummary.activeAgentCount).toBeGreaterThanOrEqual(1);
    expect(monitorSummary.activeRunCount).toBe(0);
    expect(monitorSummary.agentCounts.working).toBe(0);
    expect(monitorSummary.openTaskCount).toBeGreaterThanOrEqual(1);
    expect(monitorSummary.completedThisWeekCount).toBe(1);

    const { body: dashboardStats } = await requestJson(
      currentContext,
      "GET",
      "/api/dashboard/stats"
    );
    expect(dashboardStats.totalProjectCount).toBeGreaterThanOrEqual(1);
    expect(dashboardStats.activeProjectCount).toBeGreaterThanOrEqual(1);
    expect(dashboardStats.totalAgentCount).toBeGreaterThanOrEqual(1);
    expect(dashboardStats.activeAgentCount).toBeGreaterThanOrEqual(1);
    expect(dashboardStats.openTaskCount).toBeGreaterThanOrEqual(1);
    expect(dashboardStats.completedThisWeekCount).toBe(1);

    const { body: workingRuns } = await requestJson(
      currentContext,
      "GET",
      "/api/dashboard/working"
    );
    expect(Array.isArray(workingRuns)).toBe(true);
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
    const agentId = randomUUID();
    const now = new Date().toISOString();
    const workspacePath = join(setup.appDataDir, "seeded-openclaw-workspace");
    const runtimeStatePath = join(setup.appDataDir, "seeded-openclaw-agent-state");

    await currentContext.services.db.insert(agents).values({
      id: agentId,
      slug: "openclaw-seeded",
      name: "OpenClaw",
      avatar: "smart_toy",
      role: "Execution",
      systemInstructions: "",
      personaText: null,
      userContextText: null,
      identityText: null,
      toolsText: null,
      heartbeatText: null,
      memoryText: null,
      runtimeKind: "openclaw-native",
      runtimeAgentId: "openclaw-seeded",
      agentHomePath: workspacePath,
      runtimeStatePath,
      modelProvider: "openai-codex",
      modelName: "gpt-5.4",
      modelOverrideAllowed: true,
      sandboxMode: "off",
      defaultThinkingLevel: "medium",
      status: "idle",
      currentTaskId: null,
      lastSeenAt: null,
      createdAt: now,
      updatedAt: now,
    }).run();

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agentId}`
    );

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "OpenClaw health gate",
      assignedAgentId: agentId,
    });

    const startResponse = await currentContext.app.inject({
      method: "POST",
      url: `/api/tasks/${task.id}/start`,
    });
    expect(startResponse.statusCode).toBe(503);
    expect(readErrorMessage(startResponse)).toMatch(/runtime health/i);
  });

  it("stages operator follow-up comments into the next run task file", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Follow Up Project",
      projectRoot: "projects/follow-up",
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Follow Up Agent",
      role: "Execution",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Refine the hero",
      description: "Build the first pass.",
      assignedAgentId: agent.id,
    });

    await requestJson(currentContext, "POST", `/api/tasks/${task.id}/start`);

    await waitFor(
      async () => {
        const result = await requestJson(currentContext, "GET", `/api/tasks/${task.id}`);
        return result.body;
      },
      (value) => value.status === "in_review"
    );

    await requestJson(currentContext, "POST", `/api/tasks/${task.id}/comments`, {
      body: "Reduce the hero font size and tighten the spacing.",
    });

    const resumedTask = await waitFor(
      async () => {
        const result = await requestJson(currentContext, "GET", `/api/tasks/${task.id}`);
        return result.body;
      },
      (value) => value.recentRuns.length >= 2
    );
    const secondRun = resumedTask.recentRuns[0];

    const stagedTaskFile = await readFile(
      join(agent.agentHomePath, ".apm", "runs", secondRun.id, "TASK.md"),
      "utf8"
    );

    expect(stagedTaskFile).toContain("Recent operator follow-up comments:");
    expect(stagedTaskFile).toContain("Reduce the hero font size and tighten the spacing.");
    expect(stagedTaskFile).toContain(
      "Treat the newest operator comment as the current revision request."
    );
  });

  it("returns a real cross-project dashboard activity feed", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Dashboard Activity",
      projectRoot: "projects/dashboard-activity",
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Activity Agent",
      role: "Execution",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Wire dashboard feed",
      assignedAgentId: agent.id,
    });

    await requestJson(currentContext, "POST", `/api/tasks/${task.id}/comments`, {
      body: "Show this update in the dashboard feed.",
    });
    await requestJson(currentContext, "POST", `/api/tasks/${task.id}/start`);

    const { response, body } = await requestJson(
      currentContext,
      "GET",
      "/api/dashboard/activity"
    );

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(
      body.some(
        (item: {
          type: string;
          actorLabel: string;
          message: string;
          href: string | null;
        }) =>
          item.type === "comment" &&
          item.actorLabel === "Operator" &&
          item.message.includes("Show this update") &&
          item.href === `/projects/${project.id}/board/${task.id}`
      )
    ).toBe(true);
  });

  it("returns actionable dashboard attention items", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Dashboard Attention",
      projectRoot: "projects/dashboard-attention",
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Attention Agent",
      role: "Execution",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Confirm operator input",
      assignedAgentId: agent.id,
    });

    const now = new Date().toISOString();

    await currentContext.services.db
      .update(tasks)
      .set({
        status: "blocked",
        updatedAt: now,
      })
      .where(eq(tasks.id, task.id))
      .run();

    await currentContext.services.db
      .update(agents)
      .set({
        status: "error",
        updatedAt: now,
      })
      .where(eq(agents.id, agent.id))
      .run();

    const { response, body } = await requestJson(
      currentContext,
      "GET",
      "/api/dashboard/attention"
    );

    expect(response.statusCode).toBe(200);
    expect(
      body.some(
        (item: {
          kind: string;
          href: string | null;
          actionLabel: string;
        }) =>
          item.kind === "blocked_task" &&
          item.href === `/projects/${project.id}/board/${task.id}` &&
          item.actionLabel === "Open Task"
      )
    ).toBe(true);
    expect(
      body.some(
        (item: {
          kind: string;
          href: string | null;
          actionLabel: string;
        }) =>
          item.kind === "agent_error" &&
          item.href === `/agents/${agent.id}` &&
          item.actionLabel === "Open Agent"
      )
    ).toBe(true);
  });
});
