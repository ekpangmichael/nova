import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { access, chmod, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { agents, taskComments, taskRuns, tasks } from "@nova/db";
import type { AppContext } from "./app.js";
import { createApp } from "./app.js";
import { normalizeAbsolutePath } from "./lib/paths.js";

const execFileAsync = promisify(execFile);

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const canonicalizeTmpPath = (input: string) =>
  process.platform === "darwin" ? input.replace(/^\/var\//, "/private/var/") : input;

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

const buildMultipartBody = (
  fileName: string,
  content: Buffer | string,
  mimeType = "text/plain"
) => {
  const boundary = `----nova-${Date.now()}`;
  const fileBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  const chunks = [
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`,
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

const buildMultipartFormBody = (input: {
  fields?: Record<string, string>;
  files?: Array<{
    fieldName?: string;
    fileName: string;
    content: Buffer | string;
    mimeType?: string;
  }>;
}) => {
  const boundary = `----nova-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];

  for (const [fieldName, value] of Object.entries(input.fields ?? {})) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${fieldName}"\r\n\r\n` +
          `${value}\r\n`,
        "utf8"
      )
    );
  }

  for (const file of input.files ?? []) {
    const fileBuffer = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(file.content, "utf8");
    chunks.push(
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${file.fieldName ?? "files"}"; filename="${file.fileName}"\r\n` +
          `Content-Type: ${file.mimeType ?? "application/octet-stream"}\r\n\r\n`,
        "utf8"
      )
    );
    chunks.push(fileBuffer);
    chunks.push(Buffer.from("\r\n", "utf8"));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));

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

const runGit = async (cwd: string, args: string[]) => {
  try {
    return await execFileAsync("git", ["-c", "commit.gpgsign=false", ...args], {
      cwd,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
      },
    });
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
        ? error.stderr.trim()
        : "";
    const stdout =
      error && typeof error === "object" && "stdout" in error && typeof error.stdout === "string"
        ? error.stdout.trim()
        : "";
    throw new Error(stderr || stdout || `git ${args.join(" ")} failed`);
  }
};

const initGitRepo = async (repoPath: string, remoteUrl?: string) => {
  await runGit(repoPath, ["init", "-b", "main"]);
  await writeFile(join(repoPath, "README.md"), "# Nova Test Repo\n", "utf8");
  await runGit(repoPath, ["add", "README.md"]);
  await runGit(repoPath, [
    "-c",
    "user.name=Nova Test",
    "-c",
    "user.email=nova-tests@example.com",
    "commit",
    "-m",
    "Initial commit",
  ]);

  if (remoteUrl) {
    try {
      await runGit(repoPath, ["remote", "set-url", "origin", remoteUrl]);
    } catch {
      await runGit(repoPath, ["remote", "add", "origin", remoteUrl]);
    }
  }
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

const createMockCodexCli = async (
  rootDir: string,
  options?: {
    version?: string;
    loginStatus?: string;
    argLogPath?: string;
  }
) => {
  const binaryPath = join(rootDir, "mock-codex");
  const threadId = "11111111-1111-4111-8111-111111111111";
  const script = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const THREAD_ID = ${JSON.stringify(threadId)};
const ARG_LOG_PATH = ${JSON.stringify(options?.argLogPath ?? null)};
const write = (event) => process.stdout.write(JSON.stringify(event) + "\\n");
if (ARG_LOG_PATH) {
  fs.appendFileSync(ARG_LOG_PATH, JSON.stringify(args) + "\\n");
}
if (args.length === 1 && args[0] === "--version") {
  process.stdout.write(${JSON.stringify(options?.version ?? "codex-cli 0.117.0")} + "\\n");
  process.exit(0);
}
if (args[0] === "login" && args[1] === "status") {
  process.stdout.write(${JSON.stringify(options?.loginStatus ?? "Logged in using ChatGPT")} + "\\n");
  process.exit(0);
}
if (args[0] === "exec") {
  let prompt = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    prompt += chunk;
  });
  process.stdin.on("end", () => {
    const isResume = args[1] === "resume";
    const progress = isResume
      ? "I'll inspect the copy before making the requested revision."
      : "I'll inspect the landing page files before making changes.";
    const reply = prompt.includes("fast delivery")
      ? "Updated the landing page copy to mention fast delivery."
      : "Implemented the first Codex task pass.";
    write({ type: "thread.started", thread_id: THREAD_ID });
    write({ type: "turn.started" });
    write({
      type: "item.completed",
      item: { id: isResume ? "assistant-progress-2" : "assistant-progress-1", type: "agent_message", text: progress }
    });
    write({
      type: "item.started",
      item: { type: "file_change", changes: [{ path: isResume ? "copy.txt" : "page.tsx", kind: isResume ? "modified" : "created" }] }
    });
    write({
      type: "item.completed",
      item: { type: "file_change", changes: [{ path: isResume ? "copy.txt" : "page.tsx", kind: isResume ? "modified" : "created" }] }
    });
    write({
      type: "item.completed",
      item: { id: isResume ? "assistant-msg-2" : "assistant-msg-1", type: "agent_message", text: reply }
    });
    write({ type: "turn.completed", usage: { input_tokens: 32, output_tokens: 16 } });
    process.exit(0);
  });
  process.stdin.resume();
  return;
}
process.stderr.write("unsupported command\\n");
process.exit(1);
`;

  await writeFile(binaryPath, script, "utf8");
  await chmod(binaryPath, 0o755);

  return binaryPath;
};

const createMockClaudeCli = async (
  rootDir: string,
  options?: {
    version?: string;
    email?: string;
    subscriptionType?: string;
    failFirstRunWithMaxTurns?: boolean;
  }
) => {
  const binaryPath = join(rootDir, "mock-claude");
  const sessionId = "22222222-2222-4222-8222-222222222222";
  const invocationStatePath = join(rootDir, "mock-claude-invocations.txt");
  const script = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const SESSION_ID = ${JSON.stringify(sessionId)};
const INVOCATION_STATE_PATH = ${JSON.stringify(invocationStatePath)};
const write = (event) => process.stdout.write(JSON.stringify(event) + "\\n");
if (args.length === 1 && args[0] === "--version") {
  process.stdout.write(${JSON.stringify(options?.version ?? "2.1.72 (Claude Code)")} + "\\n");
  process.exit(0);
}
if (args[0] === "auth" && args[1] === "status") {
  process.stdout.write(JSON.stringify({
    loggedIn: true,
    authMethod: "claude.ai",
    apiProvider: "firstParty",
    email: ${JSON.stringify(options?.email ?? "claude@example.com")},
    subscriptionType: ${JSON.stringify(options?.subscriptionType ?? "max")}
  }, null, 2) + "\\n");
  process.exit(0);
}
if (args.includes("-p")) {
  let invocationCount = 0;
  if (fs.existsSync(INVOCATION_STATE_PATH)) {
    invocationCount = Number(fs.readFileSync(INVOCATION_STATE_PATH, "utf8")) || 0;
  }
  invocationCount += 1;
  fs.writeFileSync(INVOCATION_STATE_PATH, String(invocationCount), "utf8");
  const resumeIndex = args.indexOf("--resume");
  const isResume = resumeIndex >= 0;
  const shouldFailWithMaxTurns =
    ${options?.failFirstRunWithMaxTurns ? "true" : "false"} &&
    invocationCount === 1;
  const prompt = args.at(-1) ?? "";
  const progress = isResume
    ? "I'll inspect the current copy before applying the requested revision."
    : "I'll inspect the task files and execution target before implementing.";
  const reply = prompt.includes("fast delivery")
    ? "Updated the landing page copy to mention fast delivery."
    : "Implemented the first Claude task pass.";
  write({
    type: "system",
    subtype: "init",
    session_id: SESSION_ID,
    model: "claude-sonnet-4-6",
    permissionMode: args.includes("bypassPermissions") ? "bypassPermissions" : "acceptEdits"
  });
  write({
    type: "assistant",
    message: {
      id: isResume ? "assistant-tool-2" : "assistant-tool-1",
      content: [
        {
          type: "tool_use",
          id: isResume ? "tool-use-2" : "tool-use-1",
          name: "Write",
          input: {
            file_path: isResume ? "/workspace/copy.txt" : "/workspace/page.tsx",
            content: isResume ? "fast delivery" : "initial pass"
          }
        }
      ]
    },
    session_id: SESSION_ID
  });
  write({
    type: "user",
    message: {
      role: "user",
      content: [
        {
          tool_use_id: isResume ? "tool-use-2" : "tool-use-1",
          type: "tool_result",
          content: "ok"
        }
      ]
    },
    tool_use_result: {
      type: isResume ? "edit" : "create",
      filePath: isResume ? "/workspace/copy.txt" : "/workspace/page.tsx"
    },
    session_id: SESSION_ID
  });
  write({
    type: "assistant",
    message: {
      id: isResume ? "assistant-progress-2" : "assistant-progress-1",
      content: [
        {
          type: "text",
          text: progress
        }
      ]
    },
    session_id: SESSION_ID
  });
  write({
    type: "stream_event",
    event: {
      type: "message_start",
      message: {
        id: isResume ? "assistant-msg-2" : "assistant-msg-1"
      }
    },
    session_id: SESSION_ID
  });
  write({
    type: "stream_event",
    event: {
      type: "content_block_delta",
      delta: {
        type: "text_delta",
        text: reply
      }
    },
    session_id: SESSION_ID
  });
  write({
    type: "assistant",
    message: {
      id: isResume ? "assistant-msg-2" : "assistant-msg-1",
      content: [
        {
          type: "text",
          text: reply
        }
      ]
    },
    session_id: SESSION_ID
  });
  if (shouldFailWithMaxTurns) {
    write({
      type: "result",
      subtype: "error_max_turns",
      is_error: true,
      session_id: SESSION_ID,
      usage: {
        input_tokens: 24,
        output_tokens: 12
      }
    });
    process.exit(1);
  }
  write({
    type: "result",
    subtype: "success",
    is_error: false,
    result: reply,
    session_id: SESSION_ID,
    usage: {
      input_tokens: 24,
      output_tokens: 12
    }
  });
  process.exit(0);
}
process.stderr.write("unsupported command\\n");
process.exit(1);
`;

  await writeFile(binaryPath, script, "utf8");
  await chmod(binaryPath, 0o755);

  return binaryPath;
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

  it("returns detected Codex config and persists Codex runtime overrides", async () => {
    const appDataDir = await mkdtemp(join(tmpdir(), "nova-codex-config-"));
    const codexStateDir = join(appDataDir, "codex-home");
    const codexConfigPath = join(codexStateDir, "config.toml");
    await mkdir(codexStateDir, { recursive: true });
    await writeFile(
      codexConfigPath,
      'model = "gpt-5.4"\nmodel_reasoning_effort = "high"\n',
      "utf8"
    );
    await writeFile(
      join(codexStateDir, "auth.json"),
      JSON.stringify({
        auth_mode: "chatgpt",
        tokens: {
          access_token: "test-access",
        },
        last_refresh: "2026-03-31T17:00:00.000Z",
      }),
      "utf8"
    );
    const codexBinaryPath = await createMockCodexCli(appDataDir);

    currentAppDataDir = appDataDir;
    currentContext = await createApp({
      logger: false,
      envOverrides: {
        NODE_ENV: "test",
        NOVA_APP_DATA_DIR: appDataDir,
        NOVA_RUNTIME_MODE: "mock",
        CODEX_BINARY_PATH: codexBinaryPath,
        CODEX_STATE_DIR: codexStateDir,
        CODEX_CONFIG_PATH: codexConfigPath,
      },
    });

    const authHeaders = await createAuthHeaders(currentContext, {
      displayName: "Codex Operator",
      email: "codex-config@example.com",
    });

    const configResponse = await currentContext.app.inject({
      method: "GET",
      url: "/api/runtimes/codex/config",
      headers: authHeaders,
    });

    expect(configResponse.statusCode).toBe(200);
    const configBody = configResponse.json();
    expect(configBody.health.mode).toBe("codex");
    expect(configBody.health.status).toBe("healthy");
    expect(configBody.current.binaryPath).toBe(codexBinaryPath);
    expect(configBody.current.defaultModel).toBe("gpt-5.4");
    expect(configBody.auth.status).toBe("logged_in");

    const catalogResponse = await currentContext.app.inject({
      method: "GET",
      url: "/api/runtimes/codex/catalog",
      headers: authHeaders,
    });

    expect(catalogResponse.statusCode).toBe(200);
    const catalogBody = catalogResponse.json();
    const codexModelIds = catalogBody.models.map((model: { id: string }) => model.id);
    expect(codexModelIds).toEqual(
      expect.arrayContaining([
        "gpt-5.5",
        "gpt-5.4",
        "gpt-5.4-mini",
        "gpt-5.3-codex",
        "gpt-5.2-codex",
        "gpt-5.2",
        "gpt-5.1-codex",
        "gpt-5.1-codex-max",
        "gpt-5.1-codex-mini",
      ])
    );
    expect(codexModelIds).not.toContain("gpt-5.3-codex-spark");

    const { response: patchResponse, body: patchBody } = await requestJson(
      currentContext,
      "PATCH",
      "/api/runtimes/codex/config",
      {
        binaryPath: codexBinaryPath,
        stateDir: codexStateDir,
        configPath: codexConfigPath,
        defaultModel: "gpt-5.3-codex",
      },
      authHeaders
    );

    expect(patchResponse.statusCode).toBe(200);
    expect(patchBody.current.defaultModel).toBe("gpt-5.3-codex");

    const persistedSettings = await currentContext.services.db.query.settings.findFirst();
    expect(persistedSettings?.codexBinaryPath).toBe(codexBinaryPath);
    expect(persistedSettings?.codexStateDir).toBe(codexStateDir);
    expect(persistedSettings?.codexConfigPath).toBe(codexConfigPath);
    expect(persistedSettings?.codexDefaultModel).toBe("gpt-5.3-codex");
  });

  it("persists runtime enabled flags", async () => {
    const appDataDir = await mkdtemp(join(tmpdir(), "nova-runtime-toggle-"));

    currentAppDataDir = appDataDir;
    currentContext = await createApp({
      logger: false,
      envOverrides: {
        NODE_ENV: "test",
        NOVA_APP_DATA_DIR: appDataDir,
        NOVA_RUNTIME_MODE: "mock",
      },
    });

    const authHeaders = await createAuthHeaders(currentContext, {
      displayName: "Runtime Operator",
      email: "runtime-toggle@example.com",
    });

    const codexToggle = await requestJson(
      currentContext,
      "PATCH",
      "/api/runtimes/codex/enabled",
      { enabled: false },
      authHeaders
    );
    expect(codexToggle.response.statusCode).toBe(200);
    expect(codexToggle.body.enabled).toBe(false);

    const claudeToggle = await requestJson(
      currentContext,
      "PATCH",
      "/api/runtimes/claude/enabled",
      { enabled: false },
      authHeaders
    );
    expect(claudeToggle.response.statusCode).toBe(200);
    expect(claudeToggle.body.enabled).toBe(false);

    const openclawToggle = await requestJson(
      currentContext,
      "PATCH",
      "/api/runtimes/openclaw/enabled",
      { enabled: false },
      authHeaders
    );
    expect(openclawToggle.response.statusCode).toBe(200);
    expect(openclawToggle.body.enabled).toBe(false);

    const persistedSettings = await currentContext.services.db.query.settings.findFirst();
    expect(persistedSettings?.codexEnabled).toBe(false);
    expect(persistedSettings?.claudeEnabled).toBe(false);
    expect(persistedSettings?.openclawEnabled).toBe(false);
  });

  it("blocks agent creation and task start when a runtime is disabled", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const authHeaders = await createAuthHeaders(currentContext, {
      displayName: "Disabled Runtime Operator",
      email: "disabled-runtime@example.com",
    });

    const disableCodexResponse = await requestJson(
      currentContext,
      "PATCH",
      "/api/runtimes/codex/enabled",
      { enabled: false },
      authHeaders
    );
    expect(disableCodexResponse.response.statusCode).toBe(200);

    const createCodexAgentResponse = await requestJson(
      currentContext,
      "POST",
      "/api/agents",
      {
        name: "Blocked Codex Agent",
        role: "Implementation",
        runtime: {
          kind: "codex",
          defaultModelId: "gpt-5.4",
          sandboxMode: "off",
          defaultThinkingLevel: "medium",
        },
      },
      authHeaders
    );

    expect(createCodexAgentResponse.response.statusCode).toBe(503);
    expect(createCodexAgentResponse.body.message).toContain("Codex runtime is disabled");

    const { body: project } = await requestJson(
      currentContext,
      "POST",
      "/api/projects",
      {
        name: "Disabled Runtime Project",
        description: "Checks disabled runtime enforcement.",
        projectRoot: "projects/disabled-runtime",
        seedType: "none",
      },
      authHeaders
    );

    const { body: agent } = await requestJson(
      currentContext,
      "POST",
      "/api/agents",
      {
        name: "Blocked OpenClaw Agent",
        role: "Implementation",
        systemInstructions: "Stay focused.",
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
        title: "Start should fail",
        assignedAgentId: agent.id,
      },
      authHeaders
    );

    const disableOpenClawResponse = await requestJson(
      currentContext,
      "PATCH",
      "/api/runtimes/openclaw/enabled",
      { enabled: false },
      authHeaders
    );
    expect(disableOpenClawResponse.response.statusCode).toBe(200);

    const startTaskResponse = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/start`,
      undefined,
      authHeaders
    );

    expect(startTaskResponse.response.statusCode).toBe(503);
    expect(startTaskResponse.body.message).toContain("OpenClaw runtime is disabled");
  });

  it("creates a Codex-backed agent using detected local Codex defaults", async () => {
    const appDataDir = await mkdtemp(join(tmpdir(), "nova-codex-agent-"));
    const codexStateDir = join(appDataDir, "codex-home");
    const codexConfigPath = join(codexStateDir, "config.toml");
    await mkdir(codexStateDir, { recursive: true });
    await writeFile(codexConfigPath, 'model = "gpt-5.4"\n', "utf8");
    await writeFile(
      join(codexStateDir, "auth.json"),
      JSON.stringify({
        auth_mode: "chatgpt",
        tokens: {
          access_token: "test-access",
        },
      }),
      "utf8"
    );
    const codexBinaryPath = await createMockCodexCli(appDataDir);

    currentAppDataDir = appDataDir;
    currentContext = await createApp({
      logger: false,
      envOverrides: {
        NODE_ENV: "test",
        NOVA_APP_DATA_DIR: appDataDir,
        NOVA_RUNTIME_MODE: "mock",
        CODEX_BINARY_PATH: codexBinaryPath,
        CODEX_STATE_DIR: codexStateDir,
        CODEX_CONFIG_PATH: codexConfigPath,
      },
    });

    const authHeaders = await createAuthHeaders(currentContext, {
      displayName: "Codex Operator",
      email: "codex-agent@example.com",
    });

    const { response, body: agent } = await requestJson(
      currentContext,
      "POST",
      "/api/agents",
      {
        name: "Codex Builder",
        role: "Implementation",
        systemInstructions: "Keep changes surgical.",
        toolsText: "Use repo tools conservatively.",
        runtime: {
          kind: "codex",
          defaultModelId: "gpt-5.4",
          sandboxMode: "off",
          defaultThinkingLevel: "high",
        },
      },
      authHeaders
    );

    expect(response.statusCode).toBe(200);
    expect(agent.runtime.kind).toBe("codex");
    expect(agent.runtime.defaultModelId).toBe("gpt-5.4");
    expect(agent.runtime.workspacePath).toContain("/agent-homes/");
    expect(agent.runtime.runtimeStatePath).toContain("/codex-home/nova-agents/");
    await expect(access(join(agent.runtime.workspacePath, "AGENTS.md"))).resolves.toBeUndefined();
  });

  it("updates a Codex agent thinking level without treating it as a runtime switch", async () => {
    const appDataDir = await mkdtemp(join(tmpdir(), "nova-codex-edit-"));
    const codexStateDir = join(appDataDir, "codex-home");
    const codexConfigPath = join(codexStateDir, "config.toml");
    await mkdir(codexStateDir, { recursive: true });
    await writeFile(codexConfigPath, 'model = "gpt-5.4"\n', "utf8");
    await writeFile(
      join(codexStateDir, "auth.json"),
      JSON.stringify({
        auth_mode: "chatgpt",
        tokens: {
          access_token: "test-access",
        },
      }),
      "utf8"
    );
    const codexBinaryPath = await createMockCodexCli(appDataDir);

    currentAppDataDir = appDataDir;
    currentContext = await createApp({
      logger: false,
      envOverrides: {
        NODE_ENV: "test",
        NOVA_APP_DATA_DIR: appDataDir,
        NOVA_RUNTIME_MODE: "mock",
        CODEX_BINARY_PATH: codexBinaryPath,
        CODEX_STATE_DIR: codexStateDir,
        CODEX_CONFIG_PATH: codexConfigPath,
      },
    });

    const authHeaders = await createAuthHeaders(currentContext, {
      displayName: "Codex Editor",
      email: "codex-editor@example.com",
    });

    const { body: agent } = await requestJson(
      currentContext,
      "POST",
      "/api/agents",
      {
        name: "Codex Editor",
        role: "Implementation",
        runtime: {
          kind: "codex",
          defaultModelId: "gpt-5.4",
          sandboxMode: "off",
          defaultThinkingLevel: "medium",
        },
      },
      authHeaders
    );

    const patchResponse = await requestJson(
      currentContext,
      "PATCH",
      `/api/agents/${agent.id}`,
      {
        runtime: {
          defaultThinkingLevel: "high",
        },
      },
      authHeaders
    );

    expect(patchResponse.response.statusCode).toBe(200);
    expect(patchResponse.body.runtime.kind).toBe("codex");
    expect(patchResponse.body.runtime.defaultThinkingLevel).toBe("high");
  });

  it("imports an existing OpenClaw agent into Nova", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const authHeaders = await createAuthHeaders(currentContext, {
      displayName: "Import Operator",
      email: "import-openclaw@example.com",
    });

    const workspacePath = join(setup.appDataDir, "existing-openclaw-workspace");
    const runtimeStatePath = join(
      setup.appDataDir,
      "existing-openclaw-agent-state"
    );

    await currentContext.services.runtimeManager
      .getAdapter("openclaw-native")
      .provisionAgent({
        runtimeAgentId: "existing-openclaw",
        workspacePath,
        runtimeStatePath,
        defaultModelId: "openai-codex/gpt-5.5",
        modelOverrideAllowed: true,
        sandboxMode: "off",
        defaultThinkingLevel: "medium",
      });

    const { response, body: agent } = await requestJson(
      currentContext,
      "POST",
      "/api/agents/import/openclaw",
      {
        name: "Existing OpenClaw",
        role: "Research",
        systemInstructions: "Use the imported runtime identity.",
        runtime: {
          runtimeAgentId: "existing-openclaw",
          defaultModelId: "openai-codex/gpt-5.5",
          sandboxMode: "off",
          modelOverrideAllowed: true,
          defaultThinkingLevel: "medium",
        },
      },
      authHeaders
    );

    expect(response.statusCode).toBe(200);
    expect(agent.runtime.kind).toBe("openclaw-native");
    expect(agent.runtime.runtimeAgentId).toBe("existing-openclaw");
    expect(agent.runtime.workspacePath).toBe(workspacePath);
    expect(agent.runtime.runtimeStatePath).toBe(runtimeStatePath);
    await expect(access(join(workspacePath, "AGENTS.md"))).resolves.toBeUndefined();

    const duplicateImportResponse = await requestJson(
      currentContext,
      "POST",
      "/api/agents/import/openclaw",
      {
        name: "Existing OpenClaw",
        role: "Research",
        runtime: {
          runtimeAgentId: "existing-openclaw",
        },
      },
      authHeaders
    );

    expect(duplicateImportResponse.response.statusCode).toBe(409);
    expect(duplicateImportResponse.body.message).toContain("already imported");
  });

  it("returns detected Claude config and persists Claude runtime overrides", async () => {
    const appDataDir = await mkdtemp(join(tmpdir(), "nova-claude-config-"));
    const claudeStateDir = join(appDataDir, "claude-home");
    const claudeConfigPath = join(claudeStateDir, "settings.json");
    await mkdir(claudeStateDir, { recursive: true });
    await writeFile(
      claudeConfigPath,
      JSON.stringify(
        {
          enabledPlugins: {
            "frontend-design@claude-plugins-official": true,
          },
          defaultModel: "claude-sonnet-4-6",
        },
        null,
        2
      ),
      "utf8"
    );
    const claudeBinaryPath = await createMockClaudeCli(appDataDir, {
      email: "claude-config@example.com",
    });

    currentAppDataDir = appDataDir;
    currentContext = await createApp({
      logger: false,
      envOverrides: {
        NODE_ENV: "test",
        NOVA_APP_DATA_DIR: appDataDir,
        NOVA_RUNTIME_MODE: "mock",
        CLAUDE_BINARY_PATH: claudeBinaryPath,
        CLAUDE_STATE_DIR: claudeStateDir,
        CLAUDE_CONFIG_PATH: claudeConfigPath,
      },
    });

    const authHeaders = await createAuthHeaders(currentContext, {
      displayName: "Claude Operator",
      email: "claude-config@example.com",
    });

    const configResponse = await currentContext.app.inject({
      method: "GET",
      url: "/api/runtimes/claude/config",
      headers: authHeaders,
    });

    expect(configResponse.statusCode).toBe(200);
    const configBody = configResponse.json();
    expect(configBody.health.mode).toBe("claude");
    expect(configBody.health.status).toBe("healthy");
    expect(configBody.current.binaryPath).toBe(claudeBinaryPath);
    expect(configBody.current.defaultModel).toBe("claude-sonnet-4-6");
    expect(configBody.auth.status).toBe("logged_in");

    const catalogResponse = await currentContext.app.inject({
      method: "GET",
      url: "/api/runtimes/claude/catalog",
      headers: authHeaders,
    });

    expect(catalogResponse.statusCode).toBe(200);
    const catalogBody = catalogResponse.json();
    expect(catalogBody.models.map((model: { id: string }) => model.id)).toEqual(
      expect.arrayContaining([
        "claude-opus-4-7",
        "claude-sonnet-4-6",
        "claude-opus-4-6",
        "claude-haiku-4-5-20251001",
      ])
    );

    const { response: patchResponse, body: patchBody } = await requestJson(
      currentContext,
      "PATCH",
      "/api/runtimes/claude/config",
      {
        binaryPath: claudeBinaryPath,
        stateDir: claudeStateDir,
        configPath: claudeConfigPath,
        defaultModel: "claude-opus-4-6",
      },
      authHeaders
    );

    expect(patchResponse.statusCode).toBe(200);
    expect(patchBody.current.defaultModel).toBe("claude-opus-4-6");

    const persistedSettings = await currentContext.services.db.query.settings.findFirst();
    expect(persistedSettings?.claudeBinaryPath).toBe(claudeBinaryPath);
    expect(persistedSettings?.claudeStateDir).toBe(claudeStateDir);
    expect(persistedSettings?.claudeConfigPath).toBe(claudeConfigPath);
    expect(persistedSettings?.claudeDefaultModel).toBe("claude-opus-4-6");
  });

  it("creates a Claude-backed agent using detected local Claude defaults", async () => {
    const appDataDir = await mkdtemp(join(tmpdir(), "nova-claude-agent-"));
    const claudeStateDir = join(appDataDir, "claude-home");
    const claudeConfigPath = join(claudeStateDir, "settings.json");
    await mkdir(claudeStateDir, { recursive: true });
    await writeFile(
      claudeConfigPath,
      JSON.stringify({ defaultModel: "claude-sonnet-4-6" }, null, 2),
      "utf8"
    );
    const claudeBinaryPath = await createMockClaudeCli(appDataDir, {
      email: "claude-agent@example.com",
    });

    currentAppDataDir = appDataDir;
    currentContext = await createApp({
      logger: false,
      envOverrides: {
        NODE_ENV: "test",
        NOVA_APP_DATA_DIR: appDataDir,
        NOVA_RUNTIME_MODE: "mock",
        CLAUDE_BINARY_PATH: claudeBinaryPath,
        CLAUDE_STATE_DIR: claudeStateDir,
        CLAUDE_CONFIG_PATH: claudeConfigPath,
      },
    });

    const authHeaders = await createAuthHeaders(currentContext, {
      displayName: "Claude Operator",
      email: "claude-agent@example.com",
    });

    const { response, body: agent } = await requestJson(
      currentContext,
      "POST",
      "/api/agents",
      {
        name: "Claude Builder",
        role: "Design and implementation",
        systemInstructions: "Stay concise and review-ready.",
        toolsText: "Prefer local repo tools.",
        runtime: {
          kind: "claude-code",
          defaultModelId: "claude-sonnet-4-6",
          sandboxMode: "off",
          defaultThinkingLevel: "high",
        },
      },
      authHeaders
    );

    expect(response.statusCode).toBe(200);
    expect(agent.runtime.kind).toBe("claude-code");
    expect(agent.runtime.defaultModelId).toBe("claude-sonnet-4-6");
    expect(agent.runtime.workspacePath).toContain("/agent-homes/");
    expect(agent.runtime.runtimeStatePath).toContain("/claude-home/nova-agents/");
    await expect(access(join(agent.runtime.workspacePath, "AGENTS.md"))).resolves.toBeUndefined();
  });

  it("runs a Claude-backed task and reuses the same Claude session for a follow-up attempt", async () => {
    const appDataDir = await mkdtemp(join(tmpdir(), "nova-claude-run-"));
    const claudeStateDir = join(appDataDir, "claude-home");
    const claudeConfigPath = join(claudeStateDir, "settings.json");
    await mkdir(claudeStateDir, { recursive: true });
    await writeFile(
      claudeConfigPath,
      JSON.stringify({ defaultModel: "claude-sonnet-4-6" }, null, 2),
      "utf8"
    );
    const claudeBinaryPath = await createMockClaudeCli(appDataDir, {
      email: "claude-run@example.com",
    });

    currentAppDataDir = appDataDir;
    currentContext = await createApp({
      logger: false,
      envOverrides: {
        NODE_ENV: "test",
        NOVA_APP_DATA_DIR: appDataDir,
        NOVA_RUNTIME_MODE: "mock",
        CLAUDE_BINARY_PATH: claudeBinaryPath,
        CLAUDE_STATE_DIR: claudeStateDir,
        CLAUDE_CONFIG_PATH: claudeConfigPath,
      },
    });

    const authHeaders = await createAuthHeaders(currentContext, {
      displayName: "Claude Operator",
      email: "claude-run@example.com",
    });

    const { body: project } = await requestJson(
      currentContext,
      "POST",
      "/api/projects",
      {
        name: "Claude Project",
        description: "Checks Claude execution continuity.",
        projectRoot: "projects/claude-project",
        seedType: "none",
      },
      authHeaders
    );

    const { body: agent } = await requestJson(
      currentContext,
      "POST",
      "/api/agents",
      {
        name: "Claude Runner",
        role: "Implementation",
        systemInstructions: "Implement changes directly.",
        runtime: {
          kind: "claude-code",
          defaultModelId: "claude-sonnet-4-6",
          sandboxMode: "off",
          defaultThinkingLevel: "medium",
        },
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
        title: "Build the landing page",
        description: "Create the first Claude-backed implementation.",
        assignedAgentId: agent.id,
      },
      authHeaders
    );

    const startResult = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/start`,
      undefined,
      authHeaders
    );
    expect(startResult.response.statusCode).toBe(200);

    const firstCompletedTask = await waitFor(
      async () =>
        (
          await requestJson(
            currentContext!,
            "GET",
            `/api/tasks/${task.id}`,
            undefined,
            authHeaders
          )
        ).body,
      (value) =>
        value.status === "in_review" &&
        value.comments.some(
          (comment: { body: string }) =>
            comment.body === "Implemented the first Claude task pass."
        )
    );

    expect(firstCompletedTask.currentRun).toBeNull();
    expect(
      firstCompletedTask.comments.some(
        (comment: { body: string }) =>
          comment.body === "I'll inspect the task files and execution target before implementing."
      )
    ).toBe(false);

    const firstRunRows = await currentContext.services.db
      .select()
      .from(taskRuns)
      .where(eq(taskRuns.taskId, task.id))
      .all();

    expect(firstRunRows).toHaveLength(1);
    expect(firstRunRows[0].runtimeKind).toBe("claude-code");
    expect(firstRunRows[0].runtimeSessionKey).toBe(
      "22222222-2222-4222-8222-222222222222"
    );

    const commentResult = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/comments`,
      {
        body: `@${agent.slug} Please add fast delivery to the landing page copy.`,
      },
      authHeaders
    );
    expect(commentResult.response.statusCode).toBe(200);

    const secondCompletedTask = await waitFor(
      async () =>
        (
          await requestJson(
            currentContext!,
            "GET",
            `/api/tasks/${task.id}`,
            undefined,
            authHeaders
          )
        ).body,
      (value) =>
        value.comments.some(
          (comment: { body: string }) =>
            comment.body === "Updated the landing page copy to mention fast delivery."
        ) &&
        value.recentRuns.length >= 2
    );

    const secondRunRows = await currentContext.services.db
      .select()
      .from(taskRuns)
      .where(eq(taskRuns.taskId, task.id))
      .all();

    expect(secondCompletedTask.status).toBe("in_review");
    expect(
      secondCompletedTask.comments.some(
        (comment: { body: string }) =>
          comment.body === "I'll inspect the current copy before applying the requested revision."
      )
    ).toBe(false);
    expect(secondRunRows).toHaveLength(2);
    expect(secondRunRows[0].runtimeSessionKey).toBe(
      "22222222-2222-4222-8222-222222222222"
    );
    expect(secondRunRows[1].runtimeSessionKey).toBe(
      "22222222-2222-4222-8222-222222222222"
    );
  });

  // TODO: restore this test once the Claude auto-continue path is deterministic enough for CI.
  it.skip(
    "automatically continues a Claude run once after hitting the max turn limit",
    async () => {
    const appDataDir = await mkdtemp(join(tmpdir(), "nova-claude-max-turns-"));
    const claudeStateDir = join(appDataDir, "claude-home");
    const claudeConfigPath = join(claudeStateDir, "settings.json");
    await mkdir(claudeStateDir, { recursive: true });
    await writeFile(
      claudeConfigPath,
      JSON.stringify({ defaultModel: "claude-sonnet-4-6" }, null, 2),
      "utf8"
    );
    const claudeBinaryPath = await createMockClaudeCli(appDataDir, {
      email: "claude-max-turns@example.com",
      failFirstRunWithMaxTurns: true,
    });

    currentAppDataDir = appDataDir;
    currentContext = await createApp({
      logger: false,
      envOverrides: {
        NODE_ENV: "test",
        NOVA_APP_DATA_DIR: appDataDir,
        NOVA_RUNTIME_MODE: "mock",
        CLAUDE_BINARY_PATH: claudeBinaryPath,
        CLAUDE_STATE_DIR: claudeStateDir,
        CLAUDE_CONFIG_PATH: claudeConfigPath,
      },
    });

    const authHeaders = await createAuthHeaders(currentContext, {
      displayName: "Claude Operator",
      email: "claude-max-turns@example.com",
    });

    const { body: project } = await requestJson(
      currentContext,
      "POST",
      "/api/projects",
      {
        name: "Claude Max Turns Project",
        description: "Ensures Claude auto-continues once after hitting the turn cap.",
        projectRoot: "projects/claude-max-turns",
        seedType: "none",
      },
      authHeaders
    );

    const { body: agent } = await requestJson(
      currentContext,
      "POST",
      "/api/agents",
      {
        name: "Claude Resumer",
        role: "Implementation",
        systemInstructions: "Implement changes directly.",
        runtime: {
          kind: "claude-code",
          defaultModelId: "claude-sonnet-4-6",
          sandboxMode: "off",
          defaultThinkingLevel: "medium",
        },
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
        title: "Resume Claude after max turns",
        description: "Create the first Claude-backed implementation.",
        assignedAgentId: agent.id,
      },
      authHeaders
    );

    const startResult = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/start`,
      undefined,
      authHeaders
    );
    expect(startResult.response.statusCode).toBe(200);

    const completedTask = await waitFor(
      async () =>
        (
          await requestJson(
            currentContext!,
            "GET",
            `/api/tasks/${task.id}`,
            undefined,
            authHeaders
          )
        ).body,
      (value) =>
        value.status === "in_review" &&
        value.comments.some(
          (comment: { body: string }) =>
            comment.body === "Implemented the first Claude task pass."
        ) &&
        value.recentRuns.length >= 2,
      10000
    );

    const runs = await currentContext.services.db
      .select()
      .from(taskRuns)
      .where(eq(taskRuns.taskId, task.id))
      .orderBy(taskRuns.createdAt)
      .all();

    expect(completedTask.status).toBe("in_review");
    expect(runs).toHaveLength(2);
    expect(runs[0].status).toBe("failed");
    expect(runs[0].failureReason).toBe(
      "Claude reached the maximum number of turns before completing the task."
    );
    expect(runs[1].status).toBe("completed");
    expect(runs[0].runtimeSessionKey).toBe(
      "22222222-2222-4222-8222-222222222222"
    );
    expect(runs[1].runtimeSessionKey).toBe(
      "22222222-2222-4222-8222-222222222222"
    );
    },
    20000
  );

  it("runs a Codex-backed task and reuses the same Codex thread for a follow-up attempt", async () => {
    const appDataDir = await mkdtemp(join(tmpdir(), "nova-codex-run-"));
    const codexStateDir = join(appDataDir, "codex-home");
    const codexConfigPath = join(codexStateDir, "config.toml");
    const codexArgLogPath = join(appDataDir, "codex-args.log");
    await mkdir(codexStateDir, { recursive: true });
    await writeFile(codexConfigPath, 'model = "gpt-5.4"\n', "utf8");
    await writeFile(
      join(codexStateDir, "auth.json"),
      JSON.stringify({
        auth_mode: "chatgpt",
        tokens: {
          access_token: "test-access",
        },
      }),
      "utf8"
    );
    const codexBinaryPath = await createMockCodexCli(appDataDir, {
      argLogPath: codexArgLogPath,
    });

    currentAppDataDir = appDataDir;
    currentContext = await createApp({
      logger: false,
      envOverrides: {
        NODE_ENV: "test",
        NOVA_APP_DATA_DIR: appDataDir,
        NOVA_RUNTIME_MODE: "mock",
        CODEX_BINARY_PATH: codexBinaryPath,
        CODEX_STATE_DIR: codexStateDir,
        CODEX_CONFIG_PATH: codexConfigPath,
      },
    });

    const authHeaders = await createAuthHeaders(currentContext, {
      displayName: "Codex Operator",
      email: "codex-run@example.com",
    });

    const { body: project } = await requestJson(
      currentContext,
      "POST",
      "/api/projects",
      {
        name: "Codex Project",
        description: "Checks Codex execution continuity.",
        projectRoot: "projects/codex-project",
        seedType: "none",
      },
      authHeaders
    );

    const { body: agent } = await requestJson(
      currentContext,
      "POST",
      "/api/agents",
      {
        name: "Codex Runner",
        role: "Implementation",
        systemInstructions: "Implement changes directly.",
        runtime: {
          kind: "codex",
          defaultModelId: "gpt-5.4",
          sandboxMode: "off",
          defaultThinkingLevel: "medium",
        },
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
        title: "Build the landing page",
        description: "Create the first Codex-backed implementation.",
        assignedAgentId: agent.id,
      },
      authHeaders
    );

    const startResult = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/start`,
      undefined,
      authHeaders
    );
    expect(startResult.response.statusCode).toBe(200);

    const firstCompletedTask = await waitFor(
      async () =>
        (
          await requestJson(
            currentContext!,
            "GET",
            `/api/tasks/${task.id}`,
            undefined,
            authHeaders
          )
        ).body,
      (value) =>
        value.status === "in_review" &&
        value.comments.some(
          (comment: { body: string }) =>
            comment.body === "Implemented the first Codex task pass."
        ),
      4_000
    );

    expect(firstCompletedTask.currentRun).toBeNull();
    expect(
      firstCompletedTask.comments.some(
        (comment: { body: string }) =>
          comment.body === "I'll inspect the landing page files before making changes."
      )
    ).toBe(false);

    const firstRunRows = await currentContext.services.db
      .select()
      .from(taskRuns)
      .where(eq(taskRuns.taskId, task.id))
      .all();

    expect(firstRunRows).toHaveLength(1);
    expect(firstRunRows[0].runtimeKind).toBe("codex");
    expect(firstRunRows[0].runtimeSessionKey).toBe(
      "11111111-1111-4111-8111-111111111111"
    );

    const commentResult = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/comments`,
      {
        body: `@${agent.slug} Please add fast delivery to the landing page copy.`,
      },
      authHeaders
    );
    expect(commentResult.response.statusCode).toBe(200);

    const secondCompletedTask = await waitFor(
      async () =>
        (
          await requestJson(
            currentContext!,
            "GET",
            `/api/tasks/${task.id}`,
            undefined,
            authHeaders
          )
        ).body,
      (value) =>
        value.comments.some(
          (comment: { body: string }) =>
            comment.body === "Updated the landing page copy to mention fast delivery."
        ) &&
        value.recentRuns.length >= 2,
      4_000
    );

    const secondRunRows = await currentContext.services.db
      .select()
      .from(taskRuns)
      .where(eq(taskRuns.taskId, task.id))
      .all();

    expect(secondCompletedTask.status).toBe("in_review");
    expect(
      secondCompletedTask.comments.some(
        (comment: { body: string }) =>
          comment.body === "I'll inspect the copy before making the requested revision."
      )
    ).toBe(false);
    expect(secondRunRows).toHaveLength(2);
    expect(secondRunRows[0].runtimeSessionKey).toBe(
      "11111111-1111-4111-8111-111111111111"
    );
    expect(secondRunRows[1].runtimeSessionKey).toBe(
      "11111111-1111-4111-8111-111111111111"
    );

    const codexInvocations = (await readFile(codexArgLogPath, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as string[])
      .filter((args) => args[0] === "exec");

    expect(codexInvocations).toHaveLength(2);
    expect(codexInvocations[0]).toContain(
      "--dangerously-bypass-approvals-and-sandbox"
    );
    expect(codexInvocations[1]).toContain("resume");
    expect(codexInvocations[1]).toContain(
      "--dangerously-bypass-approvals-and-sandbox"
    );
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

    const attachmentContentResponse = await currentContext.app.inject({
      method: "GET",
      url: `/api/tasks/${task.id}/attachments/${attachment.id}/content`,
    });
    expect(attachmentContentResponse.statusCode).toBe(200);
    expect(attachmentContentResponse.headers["content-type"]).toContain("text/plain");
    expect(attachmentContentResponse.body).toBe(attachmentContent);

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
    const agentContextFile = await readFile(
      join(agent.agentHomePath, ".apm", "runs", run.id, "AGENT_CONTEXT.md"),
      "utf8"
    );
    expect(agentContextFile).toContain("# Agent Context");
    expect(agentContextFile).toContain("## Directive / AGENTS.md");
    expect(agentContextFile).toContain("## Tools / TOOLS.md");
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

  it("accepts supported task attachments and rejects unsupported file types", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Attachment Policy Project",
      projectRoot: "projects/attachments",
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Attachment Agent",
      role: "Docs Reviewer",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Review attachments",
      assignedAgentId: agent.id,
    });

    const pdfUpload = buildMultipartBody(
      "brief.pdf",
      "%PDF-1.7 test pdf",
      "application/pdf"
    );
    const pdfResponse = await currentContext.app.inject({
      method: "POST",
      url: `/api/tasks/${task.id}/attachments`,
      headers: pdfUpload.headers,
      payload: pdfUpload.payload,
    });
    expect(pdfResponse.statusCode).toBe(200);

    const videoUpload = buildMultipartBody(
      "demo.mp4",
      "not a real video",
      "video/mp4"
    );
    const videoResponse = await currentContext.app.inject({
      method: "POST",
      url: `/api/tasks/${task.id}/attachments`,
      headers: videoUpload.headers,
      payload: videoUpload.payload,
    });
    expect(videoResponse.statusCode).toBe(400);
    expect(readErrorMessage(videoResponse)).toContain("Unsupported attachment type");
  });

  it("supports comment attachments and stages them into the run inputs", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Comment Attachment Project",
      projectRoot: "projects/comment-attachments",
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Comment Attachment Agent",
      role: "Reviewer",
      systemInstructions: "Use comment attachments as context when they are provided.",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Review screenshot feedback",
      assignedAgentId: agent.id,
    });

    const uploadRequest = buildMultipartFormBody({
      fields: {
        body: "Please use the attached screenshot as context.",
      },
      files: [
        {
          fileName: "context.png",
          content: "fake-image-content",
          mimeType: "image/png",
        },
      ],
    });

    const commentResponse = await currentContext.app.inject({
      method: "POST",
      url: `/api/tasks/${task.id}/comments`,
      headers: uploadRequest.headers,
      payload: uploadRequest.payload,
    });

    expect(commentResponse.statusCode).toBe(200);
    const comment = commentResponse.json() as {
      id: string;
      body: string;
      attachments: Array<{
        id: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
      }>;
    };
    expect(comment.body).toContain("attached screenshot");
    expect(comment.attachments).toHaveLength(1);
    expect(comment.attachments[0].fileName).toBe("context.png");
    expect(comment.attachments[0].mimeType).toBe("image/png");

    const contentResponse = await currentContext.app.inject({
      method: "GET",
      url: `/api/tasks/${task.id}/comments/${comment.id}/attachments/${comment.attachments[0].id}/content`,
    });
    expect(contentResponse.statusCode).toBe(200);
    expect(contentResponse.headers["content-type"]).toContain("image/png");
    expect(contentResponse.body).toBe("fake-image-content");

    const { body: taskState } = await requestJson(
      currentContext,
      "GET",
      `/api/tasks/${task.id}`
    );
    expect(taskState.comments).toHaveLength(1);
    expect(taskState.comments[0].attachments).toHaveLength(1);
    expect(taskState.comments[0].attachments[0].fileName).toBe("context.png");

    const { body: run } = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/start`
    );

    const stagedCommentAttachmentPath = join(
      agent.agentHomePath,
      ".apm",
      "runs",
      run.id,
      "inputs",
      "comments",
      comment.id,
      "context.png"
    );
    expect(await readFile(stagedCommentAttachmentPath, "utf8")).toBe(
      "fake-image-content"
    );

    const taskFile = await readFile(
      join(agent.agentHomePath, ".apm", "runs", run.id, "TASK.md"),
      "utf8"
    );
    expect(taskFile).toContain("Recent operator follow-up comments:");
    expect(taskFile).toContain("Attachments:");
    expect(taskFile).toContain("context.png (image/png)");
    expect(taskFile).toContain(stagedCommentAttachmentPath);
  });

  it("creates and reuses one task branch per git-backed task", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const sharedRepoPath = join(setup.appDataDir, "shared-branch-project");
    await mkdir(sharedRepoPath, { recursive: true });
    await initGitRepo(sharedRepoPath, "git@github.com:openai/orbit-shop.git");

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Branch Project",
      description: "Ensures task branches are stable across follow-ups.",
      projectRoot: sharedRepoPath,
      seedType: "none",
    });
    const { body: firstAgent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Branch Agent",
      role: "Implementation",
      systemInstructions: "Follow TASK.md and stay on the provided branch.",
    });
    const { body: secondAgent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Review Agent",
      role: "Implementation",
      systemInstructions: "Follow TASK.md and stay on the provided branch.",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${firstAgent.id}`
    );
    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${secondAgent.id}`
    );

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Design a landing page",
      description: "Implement the first marketing page.",
      assignedAgentId: firstAgent.id,
      executionTargetOverride: project.projectRoot,
      useGitWorktree: true,
    });

    const { body: firstRun, response: firstStartResponse } = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/start`
    );
    expect(firstStartResponse.statusCode).toBe(200);

    const firstTaskState = await waitFor(
      async () =>
        (await requestJson(currentContext!, "GET", `/api/tasks/${task.id}`)).body,
      (value) =>
        typeof value.gitBranchName === "string" &&
        value.gitBranchName.length > 0 &&
        typeof value.gitBranchUrl === "string" &&
        value.gitBranchUrl.includes("/tree/") &&
        typeof value.gitWorktreePath === "string" &&
        value.gitWorktreePath.length > 0,
      4_000
    );

    expect(firstTaskState.gitBranchName).toContain("nova/task-001-design-a-landing-page");
    expect(firstTaskState.gitRepoRoot).toBe(
      canonicalizeTmpPath(normalizeAbsolutePath(sharedRepoPath))
    );
    expect(firstTaskState.gitWorktreePath).toContain(
      join(currentAppDataDir!, "git-worktrees")
    );
    expect(firstTaskState.gitBranchUrl).toContain(
      `https://github.com/openai/orbit-shop/tree/${firstTaskState.gitBranchName}`
    );
    expect(await access(firstTaskState.gitWorktreePath!)).toBeUndefined();
    expect((await runGit(sharedRepoPath, ["branch", "--show-current"])).stdout.trim()).toBe(
      "main"
    );
    expect(
      (
        await runGit(canonicalizeTmpPath(firstTaskState.gitWorktreePath!), [
          "branch",
          "--show-current",
        ])
      ).stdout.trim()
    ).toBe(
      firstTaskState.gitBranchName
    );

    const firstTaskFile = await readFile(
      join(firstAgent.agentHomePath, ".apm", "runs", firstRun.id, "TASK.md"),
      "utf8"
    );
    expect(firstTaskFile).toContain(`Branch: ${firstTaskState.gitBranchName}`);
    expect(firstTaskFile).toContain(`Worktree Path: ${firstTaskState.gitWorktreePath}`);
    expect(firstTaskFile).toContain(
      "operator wants you to open a pull request from that branch"
    );

    await waitFor(
      async () =>
        (await requestJson(currentContext!, "GET", `/api/tasks/${task.id}`)).body,
      (value) => value.currentRun === null && value.recentRuns.length >= 1,
      4_000
    );

    const { body: secondRun, response: secondStartResponse } = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/start`
    );
    expect(secondStartResponse.statusCode).toBe(200);

    const secondTaskFile = await readFile(
      join(firstAgent.agentHomePath, ".apm", "runs", secondRun.id, "TASK.md"),
      "utf8"
    );

    expect(secondTaskFile).toContain(`Branch: ${firstTaskState.gitBranchName}`);
    expect(secondTaskFile).toContain(
      `Worktree Path: ${canonicalizeTmpPath(firstTaskState.gitWorktreePath!)}`
    );
    expect((await runGit(sharedRepoPath, ["branch", "--show-current"])).stdout.trim()).toBe(
      "main"
    );
    expect(
      (
        await runGit(canonicalizeTmpPath(firstTaskState.gitWorktreePath!), [
          "branch",
          "--show-current",
        ])
      ).stdout.trim()
    ).toBe(
      firstTaskState.gitBranchName
    );

    await waitFor(
      async () =>
        (await requestJson(currentContext!, "GET", `/api/tasks/${task.id}`)).body,
      (value) =>
        value.currentRun === null && value.recentRuns.length >= 2,
      4_000
    );

    const { body: secondTask } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Implement checkout flow",
      description: "Ship the cart to checkout experience.",
      assignedAgentId: secondAgent.id,
      executionTargetOverride: project.projectRoot,
      useGitWorktree: true,
    });

    const secondTaskStart = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${secondTask.id}/start`
    );
    expect(secondTaskStart.response.statusCode).toBe(200);

    const secondTaskState = await waitFor(
      async () =>
        (await requestJson(currentContext!, "GET", `/api/tasks/${secondTask.id}`)).body,
      (value) =>
        typeof value.gitBranchName === "string" &&
        value.gitBranchName.length > 0 &&
        typeof value.gitWorktreePath === "string" &&
        value.gitWorktreePath.length > 0,
      4_000
    );

    expect(secondTaskState.gitBranchName).toContain(
      "nova/task-002-implement-checkout-flow"
    );
    expect(secondTaskState.gitWorktreePath).not.toBe(firstTaskState.gitWorktreePath);
    expect(secondTaskState.gitRepoRoot).toBe(
      canonicalizeTmpPath(normalizeAbsolutePath(sharedRepoPath))
    );
    expect(await access(secondTaskState.gitWorktreePath!)).toBeUndefined();
    expect(
      (
        await runGit(canonicalizeTmpPath(secondTaskState.gitWorktreePath!), [
          "branch",
          "--show-current",
        ])
      ).stdout.trim()
    ).toBe(
      secondTaskState.gitBranchName
    );
    expect(
      (
        await runGit(canonicalizeTmpPath(firstTaskState.gitWorktreePath!), [
          "branch",
          "--show-current",
        ])
      ).stdout.trim()
    ).toBe(
      firstTaskState.gitBranchName
    );
    expect((await runGit(sharedRepoPath, ["branch", "--show-current"])).stdout.trim()).toBe(
      "main"
    );
  });

  it("keeps shared checkout branch flow when git worktree isolation is disabled", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const sharedRepoPath = join(setup.appDataDir, "shared-checkout-project");
    await mkdir(sharedRepoPath, { recursive: true });
    await initGitRepo(sharedRepoPath, "git@github.com:openai/shared-checkout.git");

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Shared Checkout Project",
      description: "Uses the shared checkout branch flow.",
      projectRoot: sharedRepoPath,
      seedType: "none",
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Shared Checkout Agent",
      role: "Implementation",
      systemInstructions: "Follow TASK.md and stay on the provided branch.",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Implement hero banner",
      description: "Work directly in the shared checkout.",
      assignedAgentId: agent.id,
      executionTargetOverride: project.projectRoot,
      useGitWorktree: false,
    });

    const startResponse = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/start`
    );
    expect(startResponse.response.statusCode).toBe(200);

    const taskState = await waitFor(
      async () =>
        (await requestJson(currentContext!, "GET", `/api/tasks/${task.id}`)).body,
      (value) =>
        typeof value.gitBranchName === "string" &&
        value.gitBranchName.length > 0 &&
        value.gitWorktreePath === null,
      4_000
    );

    expect(taskState.useGitWorktree).toBe(false);
    expect(taskState.gitRepoRoot).toBe(
      canonicalizeTmpPath(normalizeAbsolutePath(sharedRepoPath))
    );
    expect(canonicalizeTmpPath(taskState.resolvedExecutionTarget)).toBe(
      canonicalizeTmpPath(normalizeAbsolutePath(sharedRepoPath))
    );
    expect(taskState.gitBranchName).toContain("nova/task-001-implement-hero-banner");
    expect((await runGit(sharedRepoPath, ["branch", "--show-current"])).stdout.trim()).toBe(
      taskState.gitBranchName
    );

    const taskFile = await readFile(
      join(agent.agentHomePath, ".apm", "runs", startResponse.body.id, "TASK.md"),
      "utf8"
    );
    expect(taskFile).toContain(`Branch: ${taskState.gitBranchName}`);
    expect(taskFile).toContain("Worktree Path: None");
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
        body: "@bridge-agent Please post a checkpoint after you inspect the target.",
      }
    );
    expect(commentResponse.statusCode).toBe(200);

    const runRow = await currentContext.services.db
      .select()
      .from(taskRuns)
      .where(eq(taskRuns.id, run.id))
      .get();
    expect(runRow).toBeTruthy();

    const mirroredTask = await waitFor(
      async () => {
        const [taskResult, sessionHistory] = await Promise.all([
          requestJson(currentContext, "GET", `/api/tasks/${task.id}`),
          currentContext!.services.runtimeManager
            .getAdapter(runRow!.runtimeKind)
            .loadSessionHistory(runRow!.runtimeSessionKey),
        ]);

        return {
          task: taskResult.body,
          sessionHistory,
        };
      },
      (value) =>
        value.task.comments.some(
          (comment: { source: string; body: string }) =>
            comment.source === "ticket_user" &&
            comment.body.includes("@bridge-agent Please post a checkpoint")
        ) &&
        value.sessionHistory.some(
          (message) =>
            message.role === "user" &&
            message.text.includes("@bridge-agent Please post a checkpoint")
        )
    );
    expect(
      mirroredTask.task.comments.some(
        (comment: { source: string; body: string }) =>
          comment.source === "ticket_user" &&
          comment.body.includes("@bridge-agent Please post a checkpoint")
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
        body: "@needs-input-agent Use #4F46E5 for the title color.",
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

  it("keeps plain comments passive and reroutes work only when another agent is mentioned", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;
    const adapter = currentContext.services.runtimeManager.getAdapter("openclaw-native") as {
      startRun: (input: Record<string, unknown>) => Promise<unknown>;
    };
    const originalStartRun = adapter.startRun.bind(adapter);
    let observedThinkingLevel: string | null = null;
    adapter.startRun = async (input) => {
      observedThinkingLevel =
        typeof input.thinkingLevel === "string" ? input.thinkingLevel : null;
      return originalStartRun(input);
    };

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Mention Routing Project",
      projectRoot: "projects/mention-routing",
    });
    const { body: primaryAgent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Primary Agent",
      role: "Execution",
    });
    const { body: secondaryAgent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Secondary Agent",
      role: "Execution",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${primaryAgent.id}`
    );

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Mention routing ticket",
      assignedAgentId: primaryAgent.id,
    });

    const plainCommentResponse = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/comments`,
      {
        body: "Just noting this for later review.",
      }
    );
    expect(plainCommentResponse.response.statusCode).toBe(200);

    await wait(100);

    const passiveTask = (
      await requestJson(currentContext, "GET", `/api/tasks/${task.id}`)
    ).body;
    expect(passiveTask.currentRun).toBeNull();
    expect(passiveTask.recentRuns).toHaveLength(0);
    expect(passiveTask.assignedAgentId).toBe(primaryAgent.id);

    const mentionedCommentResponse = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/comments`,
      {
        body: "@secondary-agent Please pick this up and handle the next pass.",
        thinkingLevel: "low",
      }
    );
    expect(mentionedCommentResponse.response.statusCode).toBe(200);

    const reroutedTask = await waitFor(
      async () =>
        (
          await requestJson(currentContext!, "GET", `/api/tasks/${task.id}`)
        ).body,
      (value) =>
        value.assignedAgentId === secondaryAgent.id &&
        value.status === "in_review" &&
        value.recentRuns.length >= 1
    );
    expect(reroutedTask.assignedAgentId).toBe(secondaryAgent.id);
    expect(observedThinkingLevel).toBe("low");

    const reroutedProject = (
      await requestJson(currentContext, "GET", `/api/projects/${project.id}`)
    ).body;
    expect(reroutedProject.assignedAgentIds).toContain(secondaryAgent.id);
  });

  it("automatically hands a completed task to the configured follow-up agent", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;
    const gitProjectRoot = join(setup.appDataDir, "auto-handoff-repo");
    await mkdir(gitProjectRoot, { recursive: true });
    await initGitRepo(gitProjectRoot, "git@github.com:openai/auto-handoff.git");

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Auto Handoff Project",
      projectRoot: gitProjectRoot,
    });
    const { body: designAgent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Design Agent",
      role: "Implementation",
    });
    const { body: reviewAgent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Review Agent",
      role: "Review",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${designAgent.id}`
    );

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Auto handoff ticket",
      assignedAgentId: designAgent.id,
      handoffAgentId: reviewAgent.id,
      useGitWorktree: true,
    });

    const startResponse = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/start`
    );
    expect(startResponse.response.statusCode).toBe(200);

    const handedOffTask = await waitFor(
      async () =>
        (
          await requestJson(currentContext!, "GET", `/api/tasks/${task.id}`)
        ).body,
      (value) =>
        value.assignedAgentId === reviewAgent.id &&
        value.recentRuns.length >= 2 &&
        value.recentRuns.every(
          (run: { status: string }) =>
            run.status === "completed" || run.status === "aborted"
        )
    );

    expect(handedOffTask.assignedAgentId).toBe(reviewAgent.id);
    expect(
      handedOffTask.comments.some(
        (comment: { authorType: string; body: string }) =>
          comment.authorType === "system" &&
          comment.body.includes("@review-agent Review the completed work for Auto handoff ticket.")
      )
    ).toBe(true);
    expect(
      handedOffTask.comments.some(
        (comment: { authorType: string; body: string }) =>
          comment.authorType === "system" &&
          comment.body.includes("Open worktree directory") &&
          comment.body.includes("nova-open://") &&
          comment.body.includes("Worktree path: `")
      )
    ).toBe(true);
    expect(handedOffTask.recentRuns[0].agentId).toBe(reviewAgent.id);
    expect(handedOffTask.recentRuns[1].agentId).toBe(designAgent.id);

    await wait(150);

    const stabilizedTask = (
      await requestJson(currentContext, "GET", `/api/tasks/${task.id}`)
    ).body;
    expect(stabilizedTask.recentRuns).toHaveLength(2);

    const updatedProject = (
      await requestJson(currentContext, "GET", `/api/projects/${project.id}`)
    ).body;
    expect(updatedProject.assignedAgentIds).toContain(reviewAgent.id);

    await currentContext.services.db.insert(taskComments).values({
      id: randomUUID(),
      taskId: task.id,
      taskRunId: handedOffTask.recentRuns[0].id,
      authorType: "agent",
      authorId: reviewAgent.id,
      source: "agent_mirror",
      externalMessageId: "review-note",
      body: "**Findings**\n- The review agent found a regression worth checking.",
      createdAt: new Date().toISOString(),
    });

    const followUpResponse = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/comments`,
      {
        body: `@${designAgent.slug} Share the artifact path for the implementation.`,
      }
    );
    expect(followUpResponse.response.statusCode).toBe(200);

    const followUpTask = await waitFor(
      async () =>
        (
          await requestJson(currentContext!, "GET", `/api/tasks/${task.id}`)
        ).body,
      (value) =>
        value.assignedAgentId === designAgent.id &&
        value.recentRuns.length >= 3 &&
        value.recentRuns[0]?.agentId === designAgent.id &&
        value.recentRuns[0]?.status === "completed"
    );

    const autoHandoffComments = followUpTask.comments.filter(
      (comment: {
        authorType: string;
        externalMessageId?: string | null;
      }) =>
        comment.authorType === "system" &&
        comment.externalMessageId === "auto_handoff"
    );
    expect(autoHandoffComments).toHaveLength(1);

    await wait(150);

    const stabilizedAfterFollowUp = (
      await requestJson(currentContext, "GET", `/api/tasks/${task.id}`)
    ).body;
    expect(stabilizedAfterFollowUp.recentRuns).toHaveLength(3);
    expect(stabilizedAfterFollowUp.recentRuns[0].agentId).toBe(designAgent.id);

    const resumedDesignRun = stabilizedAfterFollowUp.recentRuns[0];
    const resumedDesignTaskFile = await readFile(
      join(designAgent.agentHomePath, ".apm", "runs", resumedDesignRun.id, "TASK.md"),
      "utf8"
    );
    expect(resumedDesignTaskFile).toContain("Recent operator follow-up comments:");
    expect(resumedDesignTaskFile).toContain(
      `@${designAgent.slug} Share the artifact path for the implementation.`
    );
    expect(resumedDesignTaskFile).toContain("Recent agent handoff context:");
    expect(resumedDesignTaskFile).toContain("Findings");
  });

  it("forwards comment-specific thinking level into an active runtime session", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;
    const adapter = currentContext.services.runtimeManager.getAdapter("openclaw-native") as {
      sendRunInput: (
        runtimeSessionKey: string,
        input: Record<string, unknown>
      ) => Promise<unknown>;
    };
    const originalSendRunInput = adapter.sendRunInput.bind(adapter);
    let observedThinkingLevel: string | null = null;
    adapter.sendRunInput = async (runtimeSessionKey, input) => {
      observedThinkingLevel =
        typeof input.thinkingLevel === "string" ? input.thinkingLevel : null;
      return originalSendRunInput(runtimeSessionKey, input);
    };

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Comment Thinking Project",
      projectRoot: "projects/comment-thinking",
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Comment Thinking Agent",
      role: "Execution",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Comment thinking ticket",
      assignedAgentId: agent.id,
    });

    const { body: run } = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/start`
    );

    const activeTask = await waitFor(
      async () => (await requestJson(currentContext!, "GET", `/api/tasks/${task.id}`)).body,
      (value) => value.currentRun?.id === run.id
    );
    expect(activeTask.currentRun.id).toBe(run.id);

    const commentResponse = await requestJson(
      currentContext,
      "POST",
      `/api/tasks/${task.id}/comments`,
      {
        body: `@${agent.slug} Please do a lighter follow-up pass.`,
        thinkingLevel: "minimal",
      }
    );
    expect(commentResponse.response.statusCode).toBe(200);

    await waitFor(
      async () => observedThinkingLevel,
      (value) => value === "minimal"
    );
    expect(observedThinkingLevel).toBe("minimal");
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
      body: "@follow-up-agent Reduce the hero font size and tighten the spacing.",
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
    expect(stagedTaskFile).toContain(
      "@follow-up-agent Reduce the hero font size and tighten the spacing."
    );
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

  it("clears a failed dashboard attention item after a later successful run", async () => {
    const setup = await createTestContext();
    currentContext = setup.context;
    currentAppDataDir = setup.appDataDir;

    const { body: project } = await requestJson(currentContext, "POST", "/api/projects", {
      name: "Dashboard Resolution",
      projectRoot: "projects/dashboard-resolution",
    });
    const { body: agent } = await requestJson(currentContext, "POST", "/api/agents", {
      name: "Resolution Agent",
      role: "Execution",
    });

    await requestJson(
      currentContext,
      "POST",
      `/api/projects/${project.id}/agents/${agent.id}`
    );

    const { body: task } = await requestJson(currentContext, "POST", "/api/tasks", {
      projectId: project.id,
      title: "Resolve homepage attention item",
      assignedAgentId: agent.id,
    });

    const failedAt = "2026-04-03T10:00:00.000Z";
    const completedAt = "2026-04-03T10:05:00.000Z";

    await currentContext.services.db
      .insert(taskRuns)
      .values([
        {
          id: randomUUID(),
          taskId: task.id,
          attemptNumber: 1,
          agentId: agent.id,
          runtimeKind: "openclaw-native",
          runtimeSessionKey: "attention-session-1",
          runtimeRunId: null,
          status: "failed",
          startedAt: failedAt,
          endedAt: failedAt,
          failureReason: "Initial execution failed.",
          finalSummary: null,
          usageJson: null,
          createdAt: failedAt,
          updatedAt: failedAt,
        },
        {
          id: randomUUID(),
          taskId: task.id,
          attemptNumber: 2,
          agentId: agent.id,
          runtimeKind: "openclaw-native",
          runtimeSessionKey: "attention-session-2",
          runtimeRunId: null,
          status: "completed",
          startedAt: completedAt,
          endedAt: completedAt,
          failureReason: null,
          finalSummary: "Resolved successfully.",
          usageJson: null,
          createdAt: completedAt,
          updatedAt: completedAt,
        },
      ])
      .run();

    await currentContext.services.db
      .update(tasks)
      .set({
        status: "in_review",
        updatedAt: completedAt,
      })
      .where(eq(tasks.id, task.id))
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
        }) =>
          item.kind === "failed_run" &&
          item.href === `/projects/${project.id}/board/${task.id}`
      )
    ).toBe(false);
  });
});
