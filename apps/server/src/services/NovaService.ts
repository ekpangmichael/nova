import { createHash } from "node:crypto";
import { access, copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  and,
  desc,
  eq,
  inArray,
  notInArray,
  sql,
} from "drizzle-orm";
import {
  agents,
  projectAgents,
  projects,
  runArtifacts,
  runEvents,
  settings,
  taskAttachments,
  taskComments,
  taskDependencies,
  taskRuns,
  tasks,
  type AppDatabase,
} from "@nova/db";
import type { RuntimeEvent } from "@nova/runtime-adapter";
import type {
  ActiveRunView,
  AgentRecord,
  ArtifactKind,
  JsonValue,
  MonitorSummary,
  ProjectActivityItem,
  RecentFailureView,
  RunEventRecord,
  RunStatus,
  TaskAttachmentRecord,
  TaskCommentRecord,
  TaskPriority,
  TaskRecord,
  TaskRunRecord,
  TaskStatus,
} from "@nova/shared";
import type { AppEnv } from "../env.js";
import {
  badRequest,
  conflict,
  notFound,
  serviceUnavailable,
} from "../lib/errors.js";
import {
  isAbsoluteHostPath,
  normalizeProjectPath,
  resolveExecutionTargetPath,
  sanitizeFileName,
} from "../lib/paths.js";
import { ACTIVE_RUN_STATUSES, canManuallyTransitionTask } from "../lib/task-state.js";
import { buildRuntimePrompt, buildTaskFile } from "../lib/task-file.js";
import { generateId, nowIso, parseJsonText, slugify, stringifyJson } from "../lib/utils.js";
import type { RuntimeManager } from "./runtime/RuntimeManager.js";
import type { WebsocketHub } from "./websocket/WebsocketHub.js";

type CreateProjectInput = {
  name: string;
  description?: string;
  slug?: string;
  status?: "active" | "paused" | "archived";
  projectRoot: string;
  seedType?: "none" | "git";
  seedUrl?: string | null;
  tags?: string[];
};

type PatchProjectInput = Partial<CreateProjectInput>;

type CreateAgentInput = {
  name: string;
  role: string;
  slug?: string;
  avatar?: string | null;
  systemInstructions?: string;
  personaText?: string | null;
  userContextText?: string | null;
  identityText?: string | null;
  toolsText?: string | null;
  heartbeatText?: string | null;
  memoryText?: string | null;
  runtimeAgentId?: string;
  agentHomePath?: string;
  modelProvider?: string | null;
  modelName?: string | null;
  modelOverrideAllowed?: boolean;
  sandboxMode?: "off" | "docker" | "other";
};

type PatchAgentInput = Partial<CreateAgentInput> & {
  status?: "idle" | "working" | "paused" | "error" | "offline";
};

type CreateTaskInput = {
  projectId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedAgentId: string;
  executionTargetOverride?: string | null;
  dueAt?: string | null;
  estimatedMinutes?: number | null;
  labels?: string[];
  createdBy?: string;
};

type PatchTaskInput = Partial<Omit<CreateTaskInput, "projectId">>;

type AddCommentInput = {
  authorType?: "user" | "agent" | "system";
  authorId?: string | null;
  body: string;
};

type SaveAttachmentInput = {
  taskId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

type ActiveSubscription = {
  runId: string;
  runtimeSessionKey: string;
  nextSeq: number;
  queue: Promise<void>;
  unsubscribe: (() => Promise<void>) | null;
};

export class NovaService {
  #db: AppDatabase;
  #env: AppEnv;
  #runtimeManager: RuntimeManager;
  #websocketHub: WebsocketHub;
  #activeRuns = new Map<string, ActiveSubscription>();

  constructor(input: {
    db: AppDatabase;
    env: AppEnv;
    runtimeManager: RuntimeManager;
    websocketHub: WebsocketHub;
  }) {
    this.#db = input.db;
    this.#env = input.env;
    this.#runtimeManager = input.runtimeManager;
    this.#websocketHub = input.websocketHub;
  }

  async bootstrap() {
    await Promise.all([
      mkdir(this.#env.appDataDir, { recursive: true }),
      mkdir(this.#env.attachmentsDir, { recursive: true }),
      mkdir(this.#env.logsDir, { recursive: true }),
      mkdir(this.#env.tempDir, { recursive: true }),
      mkdir(this.#env.agentHomesDir, { recursive: true }),
    ]);

    const existingSettings = await this.#db.select().from(settings).get();

    if (!existingSettings) {
      const now = nowIso();
      await this.#db
        .insert(settings)
        .values({
          id: "local",
          mode: "local",
          openclawProfile: this.#env.openclawProfile,
          openclawBinaryPath: this.#env.openclawBinaryPath,
          gatewayUrl: this.#env.openclawGatewayUrl,
          gatewayAuthMode: "server-only",
          gatewayTokenEncrypted: null,
          appDataDir: this.#env.appDataDir,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  }

  async close() {
    for (const subscription of this.#activeRuns.values()) {
      if (subscription.unsubscribe) {
        await subscription.unsubscribe();
      }
    }
  }

  async getAppHealth() {
    return {
      status: "ok",
      service: "nova-server",
      timestamp: nowIso(),
      runtimeHealth: await this.getRuntimeHealth(),
    };
  }

  async getRuntimeHealth() {
    return this.#runtimeManager.getHealth();
  }

  async setupRuntime() {
    const health = await this.#runtimeManager.setup();
    this.#websocketHub.broadcast("runtime.health", health);
    return health;
  }

  async restartRuntime() {
    const health = await this.#runtimeManager.restart();
    this.#websocketHub.broadcast("runtime.health", health);
    return health;
  }

  async listProjects() {
    const rows = await this.#db.select().from(projects).orderBy(projects.createdAt).all();

    return Promise.all(
      rows.map(async (row) => {
        const [assignedAgentCount, openTaskCount, backlogTaskCount] =
          await Promise.all([
            this.#countProjectAgents(row.id),
            this.#countOpenTasks(row.id),
            this.#countTasksWithStatuses(row.id, ["backlog"]),
          ]);

        return {
          ...this.#serializeProject(row),
          assignedAgentCount,
          openTaskCount,
          backlogTaskCount,
        };
      })
    );
  }

  async getProject(projectId: string) {
    const row = await this.#getProjectRow(projectId);
    const [assignedAgentIds, openTaskCount, backlogTaskCount] = await Promise.all([
      this.#listProjectAgentIds(projectId),
      this.#countOpenTasks(projectId),
      this.#countTasksWithStatuses(projectId, ["backlog"]),
    ]);

    return {
      ...this.#serializeProject(row),
      assignedAgentIds,
      openTaskCount,
      backlogTaskCount,
    };
  }

  async createProject(input: CreateProjectInput) {
    const slug = input.slug ? slugify(input.slug) : slugify(input.name);

    if (!slug) {
      throw badRequest("Project slug could not be generated.");
    }

    const id = generateId();
    const now = nowIso();

    await this.#db
      .insert(projects)
      .values({
        id,
        slug,
        name: input.name.trim(),
        description: input.description?.trim() ?? "",
        status: input.status ?? "active",
        projectRoot: await this.#normalizeProjectRoot(input.projectRoot),
        seedType: input.seedType ?? "none",
        seedUrl: input.seedUrl ?? null,
        tagsJson: stringifyJson(input.tags ?? []),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const project = await this.getProject(id);
    this.#websocketHub.broadcast("project.updated", project);
    return project;
  }

  async patchProject(projectId: string, patch: PatchProjectInput) {
    const current = await this.#getProjectRow(projectId);
    const nextProjectRoot =
      patch.projectRoot !== undefined
        ? await this.#normalizeProjectRoot(patch.projectRoot)
        : current.projectRoot;

    await this.#db
      .update(projects)
      .set({
        slug: patch.slug ? slugify(patch.slug) : current.slug,
        name: patch.name?.trim() ?? current.name,
        description: patch.description?.trim() ?? current.description,
        status: patch.status ?? current.status,
        projectRoot: nextProjectRoot,
        seedType: patch.seedType ?? current.seedType,
        seedUrl:
          patch.seedUrl !== undefined ? patch.seedUrl : current.seedUrl,
        tagsJson:
          patch.tags !== undefined
            ? stringifyJson(patch.tags)
            : current.tagsJson,
        updatedAt: nowIso(),
      })
      .where(eq(projects.id, projectId))
      .run();

    const assignments = await this.#db
      .select({ agentId: projectAgents.agentId })
      .from(projectAgents)
      .where(eq(projectAgents.projectId, projectId))
      .all();
    const adapter = this.#runtimeManager.getAdapter();

    for (const assignment of assignments) {
      const agent = await this.#getAgentRow(assignment.agentId);
      await adapter.ensureProjectRoot(agent.id, agent.agentHomePath, nextProjectRoot, {
        type: patch.seedType ?? current.seedType,
        url: patch.seedUrl !== undefined ? patch.seedUrl : current.seedUrl,
      });
    }

    const project = await this.getProject(projectId);
    this.#websocketHub.broadcast("project.updated", project);
    return project;
  }

  async assignAgentToProject(projectId: string, agentId: string) {
    const project = await this.#getProjectRow(projectId);
    const agent = await this.#getAgentRow(agentId);
    const existing = await this.#db
      .select()
      .from(projectAgents)
      .where(and(eq(projectAgents.projectId, projectId), eq(projectAgents.agentId, agentId)))
      .get();

    if (existing) {
      throw conflict("Agent is already assigned to this project.");
    }

    await this.#db
      .insert(projectAgents)
      .values({
        id: generateId(),
        projectId,
        agentId,
        createdAt: nowIso(),
      })
      .run();

    await this.#runtimeManager
      .getAdapter()
      .ensureProjectRoot(agent.id, agent.agentHomePath, project.projectRoot, {
        type: project.seedType,
        url: project.seedUrl,
      });

    this.#websocketHub.broadcast("project.updated", await this.getProject(projectId));
    this.#websocketHub.broadcast("agent.updated", await this.getAgent(agentId));

    return {
      projectId,
      agentId,
      createdAt: nowIso(),
    };
  }

  async unassignAgentFromProject(projectId: string, agentId: string) {
    const assignment = await this.#db
      .select()
      .from(projectAgents)
      .where(and(eq(projectAgents.projectId, projectId), eq(projectAgents.agentId, agentId)))
      .get();

    if (!assignment) {
      throw notFound("Project agent assignment was not found.");
    }

    const assignedTask = await this.#db
      .select()
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), eq(tasks.assignedAgentId, agentId)))
      .get();

    if (assignedTask) {
      throw conflict("Cannot unassign an agent that still owns project tasks.");
    }

    await this.#db
      .delete(projectAgents)
      .where(eq(projectAgents.id, assignment.id))
      .run();

    this.#websocketHub.broadcast("project.updated", await this.getProject(projectId));
    this.#websocketHub.broadcast("agent.updated", await this.getAgent(agentId));
  }

  async getProjectActivity(projectId: string): Promise<ProjectActivityItem[]> {
    await this.#getProjectRow(projectId);

    const commentItems = (
      await this.#db
        .select({
          id: taskComments.id,
          taskId: tasks.id,
          taskTitle: tasks.title,
          body: taskComments.body,
          createdAt: taskComments.createdAt,
        })
        .from(taskComments)
        .innerJoin(tasks, eq(taskComments.taskId, tasks.id))
        .where(eq(tasks.projectId, projectId))
        .orderBy(desc(taskComments.createdAt))
        .limit(10)
        .all()
    ).map((row) => ({
      id: row.id,
      projectId,
      type: "comment" as const,
      title: `Comment on ${row.taskTitle}`,
      message: row.body,
      createdAt: row.createdAt,
    }));

    const runItems = (
      await this.#db
        .select({
          id: taskRuns.id,
          taskTitle: tasks.title,
          status: taskRuns.status,
          createdAt: taskRuns.createdAt,
        })
        .from(taskRuns)
        .innerJoin(tasks, eq(taskRuns.taskId, tasks.id))
        .where(eq(tasks.projectId, projectId))
        .orderBy(desc(taskRuns.createdAt))
        .limit(10)
        .all()
    ).map((row) => ({
      id: row.id,
      projectId,
      type: "run" as const,
      title: `Run ${row.status} for ${row.taskTitle}`,
      message: `Task run entered ${row.status}.`,
      createdAt: row.createdAt,
    }));

    const assignmentItems = (
      await this.#db
        .select({
          id: projectAgents.id,
          agentName: agents.name,
          createdAt: projectAgents.createdAt,
        })
        .from(projectAgents)
        .innerJoin(agents, eq(projectAgents.agentId, agents.id))
        .where(eq(projectAgents.projectId, projectId))
        .orderBy(desc(projectAgents.createdAt))
        .limit(10)
        .all()
    ).map((row) => ({
      id: row.id,
      projectId,
      type: "assignment" as const,
      title: "Agent assigned",
      message: `${row.agentName} was assigned to the project.`,
      createdAt: row.createdAt,
    }));

    return [...commentItems, ...runItems, ...assignmentItems]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20);
  }

  async listAgents() {
    const rows = await this.#db.select().from(agents).orderBy(agents.createdAt).all();
    return Promise.all(rows.map((row) => this.getAgent(row.id)));
  }

  async getAgent(agentId: string) {
    const row = await this.#getAgentRow(agentId);
    const projectIds = (
      await this.#db
        .select({ projectId: projectAgents.projectId })
        .from(projectAgents)
        .where(eq(projectAgents.agentId, agentId))
        .all()
    ).map((project) => project.projectId);

    return {
      ...this.#serializeAgent(row),
      projectIds,
    };
  }

  async createAgent(input: CreateAgentInput) {
    const slug = input.slug ? slugify(input.slug) : slugify(input.name);

    if (!slug) {
      throw badRequest("Agent slug could not be generated.");
    }

    const id = generateId();
    const now = nowIso();
    const agentHomePath = input.agentHomePath ?? `${this.#env.agentHomesDir}/${slug}`;

    await this.#db
      .insert(agents)
      .values({
        id,
        slug,
        name: input.name.trim(),
        avatar: input.avatar ?? null,
        role: input.role.trim(),
        systemInstructions: input.systemInstructions?.trim() ?? "",
        personaText: input.personaText ?? null,
        userContextText: input.userContextText ?? null,
        identityText: input.identityText ?? null,
        toolsText: input.toolsText ?? null,
        heartbeatText: input.heartbeatText ?? null,
        memoryText: input.memoryText ?? null,
        runtimeKind: "openclaw-native",
        runtimeAgentId: input.runtimeAgentId ?? `openclaw-${slug}`,
        agentHomePath,
        modelProvider: input.modelProvider ?? null,
        modelName: input.modelName ?? null,
        modelOverrideAllowed: input.modelOverrideAllowed ?? true,
        sandboxMode: input.sandboxMode ?? "off",
        status: "idle",
        currentTaskId: null,
        lastSeenAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await this.#runtimeManager.getAdapter().ensureAgentHome(id, agentHomePath);

    const agent = await this.getAgent(id);
    this.#websocketHub.broadcast("agent.updated", agent);
    return agent;
  }

  async patchAgent(agentId: string, patch: PatchAgentInput) {
    const current = await this.#getAgentRow(agentId);
    const nextHomePath = patch.agentHomePath ?? current.agentHomePath;

    await this.#db
      .update(agents)
      .set({
        slug: patch.slug ? slugify(patch.slug) : current.slug,
        name: patch.name?.trim() ?? current.name,
        avatar: patch.avatar !== undefined ? patch.avatar : current.avatar,
        role: patch.role?.trim() ?? current.role,
        systemInstructions:
          patch.systemInstructions?.trim() ?? current.systemInstructions,
        personaText:
          patch.personaText !== undefined ? patch.personaText : current.personaText,
        userContextText:
          patch.userContextText !== undefined
            ? patch.userContextText
            : current.userContextText,
        identityText:
          patch.identityText !== undefined ? patch.identityText : current.identityText,
        toolsText:
          patch.toolsText !== undefined ? patch.toolsText : current.toolsText,
        heartbeatText:
          patch.heartbeatText !== undefined
            ? patch.heartbeatText
            : current.heartbeatText,
        memoryText:
          patch.memoryText !== undefined ? patch.memoryText : current.memoryText,
        runtimeAgentId: patch.runtimeAgentId ?? current.runtimeAgentId,
        agentHomePath: nextHomePath,
        modelProvider:
          patch.modelProvider !== undefined
            ? patch.modelProvider
            : current.modelProvider,
        modelName:
          patch.modelName !== undefined ? patch.modelName : current.modelName,
        modelOverrideAllowed:
          patch.modelOverrideAllowed ?? current.modelOverrideAllowed,
        sandboxMode: patch.sandboxMode ?? current.sandboxMode,
        status: patch.status ?? current.status,
        updatedAt: nowIso(),
      })
      .where(eq(agents.id, agentId))
      .run();

    await this.#runtimeManager.getAdapter().ensureAgentHome(agentId, nextHomePath);
    const agent = await this.getAgent(agentId);
    this.#websocketHub.broadcast("agent.updated", agent);
    return agent;
  }

  async syncAgentHome(agentId: string) {
    const agent = await this.getAgent(agentId);
    const homePath = agent.agentHomePath;

    await this.#runtimeManager.getAdapter().ensureAgentHome(agent.id, homePath);
    await Promise.all([
      mkdir(`${homePath}/projects`, { recursive: true }),
      mkdir(`${homePath}/skills`, { recursive: true }),
      mkdir(`${homePath}/.apm/tasks`, { recursive: true }),
      mkdir(`${homePath}/.apm/runs`, { recursive: true }),
      mkdir(`${homePath}/.apm/inputs`, { recursive: true }),
      mkdir(`${homePath}/.apm/outputs`, { recursive: true }),
      mkdir(`${homePath}/.apm/cache`, { recursive: true }),
    ]);

    const files = [
      {
        relativePath: "AGENTS.md",
        content: `# ${agent.name}\n\n${agent.systemInstructions || "No system instructions provided."}\n\n## Task Execution Guidance\n- Agent Home: ${homePath}\n- Stay inside the assigned Execution Target.\n- App-managed run files live under .apm/runs/.\n`,
      },
      {
        relativePath: "SOUL.md",
        content: agent.personaText ?? "# Persona\n\nNot configured.\n",
      },
      {
        relativePath: "IDENTITY.md",
        content:
          agent.identityText ??
          `# Identity\n\nName: ${agent.name}\nRole: ${agent.role}\n`,
      },
      {
        relativePath: "USER.md",
        content: agent.userContextText ?? "# User Context\n\nNot configured.\n",
      },
      {
        relativePath: "TOOLS.md",
        content:
          agent.toolsText ??
          "# Tool Profile\n\nUse conservative defaults and stay within the execution target.\n",
      },
    ];

    if (agent.heartbeatText) {
      files.push({
        relativePath: "HEARTBEAT.md",
        content: agent.heartbeatText,
      });
    }

    if (agent.memoryText) {
      files.push({
        relativePath: "MEMORY.md",
        content: agent.memoryText,
      });
    }

    await Promise.all(
      files.map(async (file) => {
        const absolutePath = `${homePath}/${file.relativePath}`;
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, file.content, "utf8");
      })
    );

    await this.#db
      .update(agents)
      .set({
        lastSeenAt: nowIso(),
        updatedAt: nowIso(),
      })
      .where(eq(agents.id, agentId))
      .run();

    const refreshed = await this.getAgent(agentId);
    this.#websocketHub.broadcast("agent.updated", refreshed);

    return {
      agentId,
      homePath,
      files: files.map((file) => file.relativePath),
      syncedAt: nowIso(),
    };
  }

  async getAgentTasks(agentId: string) {
    await this.#getAgentRow(agentId);
    const rows = await this.#db
      .select()
      .from(tasks)
      .where(eq(tasks.assignedAgentId, agentId))
      .orderBy(desc(tasks.updatedAt))
      .all();
    return rows.map((row) => this.#serializeTask(row));
  }

  async getAgentRuns(agentId: string) {
    await this.#getAgentRow(agentId);
    const rows = await this.#db
      .select()
      .from(taskRuns)
      .where(eq(taskRuns.agentId, agentId))
      .orderBy(desc(taskRuns.createdAt))
      .all();
    return rows.map((row) => this.#serializeRun(row));
  }

  async createTask(input: CreateTaskInput) {
    const project = await this.#getProjectRow(input.projectId);
    const agent = await this.#getAssignedAgentForProject(
      input.assignedAgentId,
      input.projectId
    );
    const target = this.#resolveExecutionTarget(
      agent.agentHomePath,
      project.projectRoot,
      input.executionTargetOverride
    );

    const taskId = generateId();
    const now = nowIso();

    const taskNumber = await this.#db.transaction(async (tx) => {
      const result = await tx
        .select({
          maxTaskNumber: sql<number>`coalesce(max(${tasks.taskNumber}), 0)`,
        })
        .from(tasks)
        .where(eq(tasks.projectId, input.projectId))
        .get();

      const nextTaskNumber = (result?.maxTaskNumber ?? 0) + 1;

      await tx
        .insert(tasks)
        .values({
          id: taskId,
          taskNumber: nextTaskNumber,
          projectId: input.projectId,
          title: input.title.trim(),
          description: input.description?.trim() ?? "",
          status: input.status ?? "todo",
          priority: input.priority ?? "medium",
          assignedAgentId: input.assignedAgentId,
          executionTargetOverride:
            input.executionTargetOverride !== undefined &&
            input.executionTargetOverride !== null
              ? normalizeProjectPath(input.executionTargetOverride)
              : null,
          resolvedExecutionTarget: target.normalizedPath,
          dueAt: input.dueAt ?? null,
          estimatedMinutes: input.estimatedMinutes ?? null,
          labelsJson: stringifyJson(input.labels ?? []),
          createdBy: input.createdBy ?? "local-user",
          createdAt: now,
          updatedAt: now,
        })
        .run();

      return nextTaskNumber;
    });

    const task = await this.getTask(taskId);
    this.#websocketHub.broadcast("task.created", task);
    this.#websocketHub.broadcast("project.updated", await this.getProject(project.id));
    return {
      ...task,
      taskNumber,
    };
  }

  async patchTask(taskId: string, patch: PatchTaskInput) {
    const current = await this.#getTaskRow(taskId);
    const project = await this.#getProjectRow(current.projectId);
    const currentRun = await this.#getActiveRunForTask(taskId);

    if (currentRun && patch.assignedAgentId && patch.assignedAgentId !== current.assignedAgentId) {
      throw conflict("Cannot change task agent while a run is active.");
    }

    if (currentRun && patch.executionTargetOverride !== undefined) {
      throw conflict("Cannot change execution target while a run is active.");
    }

    if (
      patch.status !== undefined &&
      !canManuallyTransitionTask(current.status, patch.status)
    ) {
      throw conflict(
        `Manual transition from ${current.status} to ${patch.status} is not allowed.`
      );
    }

    const nextAgentId = patch.assignedAgentId ?? current.assignedAgentId;
    const agent = await this.#getAssignedAgentForProject(nextAgentId, current.projectId);
    const nextTargetSource =
      patch.executionTargetOverride !== undefined
        ? patch.executionTargetOverride
        : current.executionTargetOverride;
    const nextResolvedTarget = this.#resolveExecutionTarget(
      agent.agentHomePath,
      project.projectRoot,
      nextTargetSource
    );

    await this.#db
      .update(tasks)
      .set({
        title: patch.title?.trim() ?? current.title,
        description: patch.description?.trim() ?? current.description,
        status: patch.status ?? current.status,
        priority: patch.priority ?? current.priority,
        assignedAgentId: nextAgentId,
        executionTargetOverride:
          patch.executionTargetOverride !== undefined
            ? patch.executionTargetOverride
              ? normalizeProjectPath(patch.executionTargetOverride)
              : null
            : current.executionTargetOverride,
        resolvedExecutionTarget: nextResolvedTarget.normalizedPath,
        dueAt: patch.dueAt !== undefined ? patch.dueAt : current.dueAt,
        estimatedMinutes:
          patch.estimatedMinutes !== undefined
            ? patch.estimatedMinutes
            : current.estimatedMinutes,
        labelsJson:
          patch.labels !== undefined
            ? stringifyJson(patch.labels)
            : current.labelsJson,
        updatedAt: nowIso(),
      })
      .where(eq(tasks.id, taskId))
      .run();

    const task = await this.getTask(taskId);
    this.#websocketHub.broadcast("task.updated", task);
    return task;
  }

  async getTask(taskId: string) {
    const row = await this.#getTaskRow(taskId);
    const [project, assignedAgent, attachments, comments, runs] = await Promise.all([
      this.getProject(row.projectId),
      this.getAgent(row.assignedAgentId),
      this.getTaskAttachments(taskId),
      this.getTaskComments(taskId),
      this.getTaskRuns(taskId),
    ]);

    const currentRun =
      runs.find((run) => ACTIVE_RUN_STATUSES.includes(run.status)) ?? null;

    return {
      ...this.#serializeTask(row),
      project,
      assignedAgent,
      attachments,
      comments,
      currentRun,
      recentRuns: runs.slice(0, 5),
    };
  }

  async getTaskRuns(taskId: string) {
    await this.#getTaskRow(taskId);
    const rows = await this.#db
      .select()
      .from(taskRuns)
      .where(eq(taskRuns.taskId, taskId))
      .orderBy(desc(taskRuns.createdAt))
      .all();
    return rows.map((row) => this.#serializeRun(row));
  }

  async getTaskComments(taskId: string) {
    await this.#getTaskRow(taskId);
    const rows = await this.#db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, taskId))
      .orderBy(desc(taskComments.createdAt))
      .all();
    return rows.map((row) => this.#serializeComment(row));
  }

  async addTaskComment(taskId: string, input: AddCommentInput) {
    await this.#getTaskRow(taskId);
    const id = generateId();

    await this.#db
      .insert(taskComments)
      .values({
        id,
        taskId,
        authorType: input.authorType ?? "user",
        authorId: input.authorId ?? null,
        body: input.body.trim(),
        createdAt: nowIso(),
      })
      .run();

    const row = await this.#db
      .select()
      .from(taskComments)
      .where(eq(taskComments.id, id))
      .get();

    if (!row) {
      throw notFound("Task comment was not persisted.");
    }

    const comment = this.#serializeComment(row);
    this.#websocketHub.broadcast("task.updated", await this.getTask(taskId));
    return comment;
  }

  async getTaskAttachments(taskId: string) {
    await this.#getTaskRow(taskId);
    const rows = await this.#db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.taskId, taskId))
      .orderBy(desc(taskAttachments.createdAt))
      .all();
    return rows.map((row) => this.#serializeAttachment(row));
  }

  async saveTaskAttachment(input: SaveAttachmentInput) {
    await this.#getTaskRow(input.taskId);

    if (input.buffer.byteLength > 25 * 1024 * 1024) {
      throw badRequest("Attachment exceeds the 25 MB upload limit.");
    }

    const id = generateId();
    const fileName = sanitizeFileName(input.fileName);
    const relativeStoragePath = `${input.taskId}/${id}-${fileName}`;
    const absoluteStoragePath = `${this.#env.attachmentsDir}/${relativeStoragePath}`;
    const sha256 = createHash("sha256").update(input.buffer).digest("hex");

    await mkdir(dirname(absoluteStoragePath), { recursive: true });
    await writeFile(absoluteStoragePath, input.buffer);

    await this.#db
      .insert(taskAttachments)
      .values({
        id,
        taskId: input.taskId,
        fileName,
        mimeType: input.mimeType,
        relativeStoragePath,
        sha256,
        sizeBytes: input.buffer.byteLength,
        createdAt: nowIso(),
      })
      .run();

    const row = await this.#db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.id, id))
      .get();

    if (!row) {
      throw notFound("Task attachment was not persisted.");
    }

    const attachment = this.#serializeAttachment(row);
    this.#websocketHub.broadcast("task.updated", await this.getTask(input.taskId));
    return attachment;
  }

  async startTask(taskId: string) {
    const task = await this.#getTaskRow(taskId);
    const project = await this.#getProjectRow(task.projectId);
    const agent = await this.#getAgentRow(task.assignedAgentId);
    const attachments = await this.#db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.taskId, taskId))
      .all();

    await this.#assertTaskCanStart(task, agent, attachments);

    const adapter = this.#runtimeManager.getAdapter();
    await adapter.ensureRuntimeReady();
    await adapter.ensureAgentHome(agent.id, agent.agentHomePath);
    await adapter.ensureProjectRoot(agent.id, agent.agentHomePath, project.projectRoot, {
      type: project.seedType,
      url: project.seedUrl,
    });

    const resolvedTarget = this.#resolveExecutionTarget(
      agent.agentHomePath,
      project.projectRoot,
      task.executionTargetOverride
    );
    const runId = generateId();
    const runtimeSessionKey = `apm:task:${runId}`;
    const runDir = `${agent.agentHomePath}/.apm/runs/${runId}`;
    const inputsDir = `${runDir}/inputs`;
    const outputsDir = `${runDir}/outputs`;
    const attemptResult = await this.#db
      .select({
        maxAttempt: sql<number>`coalesce(max(${taskRuns.attemptNumber}), 0)`,
      })
      .from(taskRuns)
      .where(eq(taskRuns.taskId, taskId))
      .get();
    const attemptNumber = (attemptResult?.maxAttempt ?? 0) + 1;

    await Promise.all([
      mkdir(inputsDir, { recursive: true }),
      mkdir(outputsDir, { recursive: true }),
    ]);

    const attachmentNames: string[] = [];

    for (const attachment of attachments) {
      const source = `${this.#env.attachmentsDir}/${attachment.relativeStoragePath}`;
      const destination = `${inputsDir}/${attachment.fileName}`;
      await copyFile(source, destination);
      attachmentNames.push(attachment.fileName);
    }

    const taskFile = buildTaskFile({
      taskId,
      runId,
      projectName: project.name,
      agentName: agent.name,
      title: task.title,
      description: task.description,
      resolvedExecutionTarget: resolvedTarget.normalizedPath,
      attachments: attachmentNames,
      extraInstructions: null,
    });

    await writeFile(`${runDir}/TASK.md`, taskFile, "utf8");

    const now = nowIso();

    await this.#db
      .insert(taskRuns)
      .values({
        id: runId,
        taskId,
        attemptNumber,
        agentId: agent.id,
        runtimeKind: "openclaw-native",
        runtimeSessionKey,
        runtimeRunId: null,
        status: "preparing",
        startedAt: null,
        endedAt: null,
        failureReason: null,
        finalSummary: null,
        usageJson: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const active: ActiveSubscription = {
      runId,
      runtimeSessionKey,
      nextSeq: 1,
      queue: Promise.resolve(),
      unsubscribe: null,
    };
    this.#activeRuns.set(runId, active);

    const startResult = await adapter.startRun({
      taskId,
      runId,
      agentId: agent.id,
      runtimeAgentId: agent.runtimeAgentId,
      agentHomePath: agent.agentHomePath,
      executionTarget: resolvedTarget.normalizedPath,
      prompt: buildRuntimePrompt(runId),
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        path: `${inputsDir}/${attachment.fileName}`,
        mimeType: attachment.mimeType,
        sha256: attachment.sha256,
        sizeBytes: attachment.sizeBytes,
      })),
      modelOverride: agent.modelName,
    });

    await this.#db
      .update(taskRuns)
      .set({
        runtimeSessionKey: startResult.runtimeSessionKey,
        runtimeRunId: startResult.runtimeRunId ?? null,
        status: "running",
        startedAt: startResult.startedAt,
        updatedAt: nowIso(),
      })
      .where(eq(taskRuns.id, runId))
      .run();

    await this.#db
      .update(tasks)
      .set({
        status: "in_progress",
        resolvedExecutionTarget: resolvedTarget.normalizedPath,
        updatedAt: nowIso(),
      })
      .where(eq(tasks.id, taskId))
      .run();

    await this.#db
      .update(agents)
      .set({
        status: "working",
        currentTaskId: taskId,
        lastSeenAt: nowIso(),
        updatedAt: nowIso(),
      })
      .where(eq(agents.id, agent.id))
      .run();

    const unsubscribe = await adapter.subscribeRun(
      startResult.runtimeSessionKey,
      async (event) => {
        const subscription = this.#activeRuns.get(runId);

        if (!subscription) {
          return;
        }

        subscription.queue = subscription.queue.then(async () => {
          await this.#handleRuntimeEvent(runId, taskId, agent.id, event);
        });

        await subscription.queue;
      }
    );

    active.runtimeSessionKey = startResult.runtimeSessionKey;
    active.unsubscribe = unsubscribe;

    const run = await this.getRun(runId);
    this.#websocketHub.broadcast("run.created", run);
    this.#websocketHub.broadcast("run.updated", run);
    this.#websocketHub.broadcast("task.updated", await this.getTask(taskId));
    this.#websocketHub.broadcast("agent.updated", await this.getAgent(agent.id));

    return run;
  }

  async stopTask(taskId: string) {
    const activeRun = await this.#getActiveRunForTask(taskId);

    if (!activeRun) {
      throw conflict("Task does not have an active run.");
    }

    await this.#runtimeManager.getAdapter().stopRun(activeRun.runtimeSessionKey);
    const active = this.#activeRuns.get(activeRun.id);
    await active?.queue;
    return this.getRun(activeRun.id);
  }

  async getRun(runId: string) {
    const row = await this.#getRunRow(runId);
    const [task, agent] = await Promise.all([
      this.#getTaskRow(row.taskId),
      this.#getAgentRow(row.agentId),
    ]);

    return {
      ...this.#serializeRun(row),
      task: this.#serializeTask(task),
      agent: this.#serializeAgent(agent),
    };
  }

  async getRunEvents(runId: string): Promise<RunEventRecord[]> {
    await this.#getRunRow(runId);
    const rows = await this.#db
      .select()
      .from(runEvents)
      .where(eq(runEvents.taskRunId, runId))
      .orderBy(runEvents.seq)
      .all();

    return rows.map((row) => ({
      id: row.id,
      taskRunId: row.taskRunId,
      seq: row.seq,
      eventType: row.eventType,
      payload: parseJsonText<JsonValue>(row.payloadJson, null),
      createdAt: row.createdAt,
    }));
  }

  async getRunArtifacts(runId: string) {
    await this.#getRunRow(runId);
    const rows = await this.#db
      .select()
      .from(runArtifacts)
      .where(eq(runArtifacts.taskRunId, runId))
      .orderBy(desc(runArtifacts.createdAt))
      .all();

    return rows.map((row) => ({
      id: row.id,
      taskRunId: row.taskRunId,
      path: row.path,
      kind: row.kind,
      mimeType: row.mimeType,
      sha256: row.sha256,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt,
    }));
  }

  async getMonitorSummary(): Promise<MonitorSummary> {
    const runtimeHealth = await this.#runtimeManager.getHealth();

    const countByStatus = async (status: AgentRecord["status"]) =>
      (await this.#db
        .select({ count: sql<number>`count(*)` })
        .from(agents)
        .where(eq(agents.status, status))
        .get())?.count ?? 0;

    return {
      runtimeHealth,
      activeRunCount:
        (await this.#db
          .select({ count: sql<number>`count(*)` })
          .from(taskRuns)
          .where(inArray(taskRuns.status, ACTIVE_RUN_STATUSES))
          .get())?.count ?? 0,
      openTaskCount:
        (await this.#db
          .select({ count: sql<number>`count(*)` })
          .from(tasks)
          .where(notInArray(tasks.status, ["done", "canceled"]))
          .get())?.count ?? 0,
      recentFailureCount:
        (await this.#db
          .select({ count: sql<number>`count(*)` })
          .from(taskRuns)
          .where(eq(taskRuns.status, "failed"))
          .get())?.count ?? 0,
      agentCounts: {
        idle: await countByStatus("idle"),
        working: await countByStatus("working"),
        paused: await countByStatus("paused"),
        error: await countByStatus("error"),
        offline: await countByStatus("offline"),
      },
    };
  }

  async getMonitorActiveRuns(): Promise<ActiveRunView[]> {
    const rows = await this.#db
      .select({
        runId: taskRuns.id,
        taskId: tasks.id,
        taskTitle: tasks.title,
        projectId: projects.id,
        projectName: projects.name,
        agentId: agents.id,
        agentName: agents.name,
        status: taskRuns.status,
        startedAt: taskRuns.startedAt,
        createdAt: taskRuns.createdAt,
        resolvedExecutionTarget: tasks.resolvedExecutionTarget,
      })
      .from(taskRuns)
      .innerJoin(tasks, eq(taskRuns.taskId, tasks.id))
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .innerJoin(agents, eq(taskRuns.agentId, agents.id))
      .where(inArray(taskRuns.status, ACTIVE_RUN_STATUSES))
      .orderBy(desc(taskRuns.createdAt))
      .all();

    return Promise.all(
      rows.map(async (row) => ({
        runId: row.runId,
        taskId: row.taskId,
        taskTitle: row.taskTitle,
        projectId: row.projectId,
        projectName: row.projectName,
        agentId: row.agentId,
        agentName: row.agentName,
        status: row.status,
        startedAt: row.startedAt,
        lastEventAt:
          (
            await this.#db
              .select({ createdAt: runEvents.createdAt })
              .from(runEvents)
              .where(eq(runEvents.taskRunId, row.runId))
              .orderBy(desc(runEvents.seq))
              .get()
          )?.createdAt ?? null,
        resolvedExecutionTarget: row.resolvedExecutionTarget,
      }))
    );
  }

  async getMonitorRecentFailures(): Promise<RecentFailureView[]> {
    return this.#db
      .select({
        runId: taskRuns.id,
        taskId: tasks.id,
        taskTitle: tasks.title,
        projectId: projects.id,
        projectName: projects.name,
        agentId: agents.id,
        agentName: agents.name,
        failureReason: taskRuns.failureReason,
        endedAt: taskRuns.endedAt,
      })
      .from(taskRuns)
      .innerJoin(tasks, eq(taskRuns.taskId, tasks.id))
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .innerJoin(agents, eq(taskRuns.agentId, agents.id))
      .where(eq(taskRuns.status, "failed"))
      .orderBy(desc(taskRuns.endedAt))
      .limit(20)
      .all();
  }

  async #assertTaskCanStart(
    task: typeof tasks.$inferSelect,
    agent: typeof agents.$inferSelect,
    attachmentsForTask: (typeof taskAttachments.$inferSelect)[]
  ) {
    if (task.status === "done" || task.status === "canceled") {
      throw conflict("Task cannot be started from its current status.");
    }

    if (agent.status !== "idle") {
      throw conflict("Assigned agent is not idle.");
    }

    const activeRun = await this.#getActiveRunForTask(task.id);

    if (activeRun) {
      throw conflict("Task already has an active run.");
    }

    const dependencyIds = (
      await this.#db
        .select({ dependsOnTaskId: taskDependencies.dependsOnTaskId })
        .from(taskDependencies)
        .where(eq(taskDependencies.taskId, task.id))
        .all()
    ).map((dependency) => dependency.dependsOnTaskId);

    if (dependencyIds.length > 0) {
      const incompleteDependency = await this.#db
        .select()
        .from(tasks)
        .where(
          and(
            inArray(tasks.id, dependencyIds),
            notInArray(tasks.status, ["done"])
          )
        )
        .get();

      if (incompleteDependency) {
        throw conflict("Task dependencies must be complete before starting.");
      }
    }

    for (const attachment of attachmentsForTask) {
      try {
        await access(`${this.#env.attachmentsDir}/${attachment.relativeStoragePath}`);
      } catch {
        throw conflict("Task attachment is missing on disk.", {
          attachmentId: attachment.id,
        });
      }
    }

    const runtimeHealth = await this.#runtimeManager.getHealth();

    if (runtimeHealth.status !== "healthy") {
      throw serviceUnavailable("Runtime health is not healthy.", runtimeHealth);
    }
  }

  async #handleRuntimeEvent(
    runId: string,
    taskId: string,
    agentId: string,
    event: RuntimeEvent
  ) {
    const active = this.#activeRuns.get(runId);

    if (!active) {
      return;
    }

    const seq = active.nextSeq++;

    await this.#db
      .insert(runEvents)
      .values({
        id: generateId(),
        taskRunId: runId,
        seq,
        eventType: event.type,
        payloadJson: stringifyJson(event.data),
        createdAt: event.at,
      })
      .run();

    if (event.type === "artifact.created") {
      await this.#db
        .insert(runArtifacts)
        .values({
          id: generateId(),
          taskRunId: runId,
          path: String(event.data.path ?? ""),
          kind: (event.data.kind as ArtifactKind | undefined) ?? "other",
          mimeType: null,
          sha256: null,
          sizeBytes: null,
          createdAt: event.at,
        })
        .run();
    }

    if (event.type === "usage") {
      await this.#db
        .update(taskRuns)
        .set({
          usageJson: stringifyJson(event.data),
          updatedAt: nowIso(),
        })
        .where(eq(taskRuns.id, runId))
        .run();
    }

    if (event.type === "run.accepted") {
      await this.#db
        .update(taskRuns)
        .set({
          status: "starting",
          updatedAt: nowIso(),
        })
        .where(eq(taskRuns.id, runId))
        .run();
    }

    if (event.type === "run.started") {
      await this.#db
        .update(taskRuns)
        .set({
          status: "running",
          startedAt: event.at,
          updatedAt: nowIso(),
        })
        .where(eq(taskRuns.id, runId))
        .run();
    }

    if (event.type === "run.completed") {
      await this.#finalizeRun({
        runId,
        taskId,
        agentId,
        runStatus: "completed",
        taskStatus: "done",
        endedAt: event.at,
        finalSummary:
          typeof event.data.finalSummary === "string"
            ? event.data.finalSummary
            : "Run completed.",
        failureReason: null,
      });
    }

    if (event.type === "run.failed") {
      await this.#finalizeRun({
        runId,
        taskId,
        agentId,
        runStatus: "failed",
        taskStatus: "failed",
        endedAt: event.at,
        finalSummary: null,
        failureReason:
          typeof event.data.reason === "string"
            ? event.data.reason
            : "Run failed.",
      });
    }

    if (event.type === "run.aborted") {
      await this.#finalizeRun({
        runId,
        taskId,
        agentId,
        runStatus: "aborted",
        taskStatus: "paused",
        endedAt: event.at,
        finalSummary: null,
        failureReason:
          typeof event.data.reason === "string"
            ? event.data.reason
            : "Run aborted.",
      });
    }

    this.#websocketHub.broadcast("run.event", {
      runId,
      taskId,
      seq,
      event,
    });
    this.#websocketHub.broadcast("run.updated", await this.getRun(runId));

    if (
      event.type === "run.completed" ||
      event.type === "run.failed" ||
      event.type === "run.aborted"
    ) {
      this.#websocketHub.broadcast("task.updated", await this.getTask(taskId));
      this.#websocketHub.broadcast("agent.updated", await this.getAgent(agentId));

      if (active.unsubscribe) {
        await active.unsubscribe();
      }

      this.#activeRuns.delete(runId);
    }
  }

  async #finalizeRun(input: {
    runId: string;
    taskId: string;
    agentId: string;
    runStatus: RunStatus;
    taskStatus: TaskStatus;
    endedAt: string;
    finalSummary: string | null;
    failureReason: string | null;
  }) {
    await this.#db
      .update(taskRuns)
      .set({
        status: input.runStatus,
        endedAt: input.endedAt,
        finalSummary: input.finalSummary,
        failureReason: input.failureReason,
        updatedAt: nowIso(),
      })
      .where(eq(taskRuns.id, input.runId))
      .run();

    await this.#db
      .update(tasks)
      .set({
        status: input.taskStatus,
        updatedAt: nowIso(),
      })
      .where(eq(tasks.id, input.taskId))
      .run();

    await this.#db
      .update(agents)
      .set({
        status: "idle",
        currentTaskId: null,
        lastSeenAt: nowIso(),
        updatedAt: nowIso(),
      })
      .where(eq(agents.id, input.agentId))
      .run();
  }

  async #countProjectAgents(projectId: string) {
    return (
      (
        await this.#db
          .select({ count: sql<number>`count(*)` })
          .from(projectAgents)
          .where(eq(projectAgents.projectId, projectId))
          .get()
      )?.count ?? 0
    );
  }

  async #countOpenTasks(projectId: string) {
    return (
      (
        await this.#db
          .select({ count: sql<number>`count(*)` })
          .from(tasks)
          .where(
            and(
              eq(tasks.projectId, projectId),
              notInArray(tasks.status, ["done", "canceled"])
            )
          )
          .get()
      )?.count ?? 0
    );
  }

  async #countTasksWithStatuses(projectId: string, statuses: TaskStatus[]) {
    return (
      (
        await this.#db
          .select({ count: sql<number>`count(*)` })
          .from(tasks)
          .where(and(eq(tasks.projectId, projectId), inArray(tasks.status, statuses)))
          .get()
      )?.count ?? 0
    );
  }

  async #listProjectAgentIds(projectId: string) {
    return (
      await this.#db
        .select({ agentId: projectAgents.agentId })
        .from(projectAgents)
        .where(eq(projectAgents.projectId, projectId))
        .all()
    ).map((row) => row.agentId);
  }

  #resolveExecutionTarget(
    agentHomePath: string,
    projectRoot: string,
    override?: string | null
  ) {
    return resolveExecutionTargetPath(agentHomePath, projectRoot, override);
  }

  async #normalizeProjectRoot(input: string) {
    const normalized = normalizeProjectPath(input);

    if (!isAbsoluteHostPath(normalized)) {
      return normalized;
    }

    const projectRootStat = await stat(normalized).catch(() => null);

    if (!projectRootStat || !projectRootStat.isDirectory()) {
      throw badRequest("Absolute project root must point to an existing directory.");
    }

    return normalized;
  }

  #serializeProject(row: typeof projects.$inferSelect) {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      status: row.status,
      projectRoot: row.projectRoot,
      seedType: row.seedType,
      seedUrl: row.seedUrl,
      tags: parseJsonText<string[]>(row.tagsJson, []),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  #serializeAgent(row: typeof agents.$inferSelect): AgentRecord {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      avatar: row.avatar,
      role: row.role,
      systemInstructions: row.systemInstructions,
      personaText: row.personaText,
      userContextText: row.userContextText,
      identityText: row.identityText,
      toolsText: row.toolsText,
      heartbeatText: row.heartbeatText,
      memoryText: row.memoryText,
      runtimeKind: row.runtimeKind,
      runtimeAgentId: row.runtimeAgentId,
      agentHomePath: row.agentHomePath,
      modelProvider: row.modelProvider,
      modelName: row.modelName,
      modelOverrideAllowed: row.modelOverrideAllowed,
      sandboxMode: row.sandboxMode,
      status: row.status,
      currentTaskId: row.currentTaskId,
      lastSeenAt: row.lastSeenAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  #serializeTask(row: typeof tasks.$inferSelect): TaskRecord {
    return {
      id: row.id,
      taskNumber: row.taskNumber,
      projectId: row.projectId,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      assignedAgentId: row.assignedAgentId,
      executionTargetOverride: row.executionTargetOverride,
      resolvedExecutionTarget: row.resolvedExecutionTarget,
      dueAt: row.dueAt,
      estimatedMinutes: row.estimatedMinutes,
      labels: parseJsonText<string[]>(row.labelsJson, []),
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  #serializeComment(row: typeof taskComments.$inferSelect): TaskCommentRecord {
    return {
      id: row.id,
      taskId: row.taskId,
      authorType: row.authorType,
      authorId: row.authorId,
      body: row.body,
      createdAt: row.createdAt,
    };
  }

  #serializeAttachment(
    row: typeof taskAttachments.$inferSelect
  ): TaskAttachmentRecord {
    return {
      id: row.id,
      taskId: row.taskId,
      fileName: row.fileName,
      mimeType: row.mimeType,
      relativeStoragePath: row.relativeStoragePath,
      sha256: row.sha256,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt,
    };
  }

  #serializeRun(row: typeof taskRuns.$inferSelect): TaskRunRecord {
    return {
      id: row.id,
      taskId: row.taskId,
      attemptNumber: row.attemptNumber,
      agentId: row.agentId,
      runtimeKind: row.runtimeKind,
      runtimeSessionKey: row.runtimeSessionKey,
      runtimeRunId: row.runtimeRunId,
      status: row.status,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      failureReason: row.failureReason,
      finalSummary: row.finalSummary,
      usage: parseJsonText<JsonValue>(row.usageJson, null),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async #getProjectRow(projectId: string) {
    const row = await this.#db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    if (!row) {
      throw notFound("Project was not found.");
    }

    return row;
  }

  async #getAgentRow(agentId: string) {
    const row = await this.#db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .get();

    if (!row) {
      throw notFound("Agent was not found.");
    }

    return row;
  }

  async #getTaskRow(taskId: string) {
    const row = await this.#db.select().from(tasks).where(eq(tasks.id, taskId)).get();

    if (!row) {
      throw notFound("Task was not found.");
    }

    return row;
  }

  async #getRunRow(runId: string) {
    const row = await this.#db
      .select()
      .from(taskRuns)
      .where(eq(taskRuns.id, runId))
      .get();

    if (!row) {
      throw notFound("Run was not found.");
    }

    return row;
  }

  async #getAssignedAgentForProject(agentId: string, projectId: string) {
    const [agent, assignment] = await Promise.all([
      this.#getAgentRow(agentId),
      this.#db
        .select()
        .from(projectAgents)
        .where(and(eq(projectAgents.agentId, agentId), eq(projectAgents.projectId, projectId)))
        .get(),
    ]);

    if (!assignment) {
      throw conflict("Assigned agent is not linked to the project.");
    }

    return agent;
  }

  async #getActiveRunForTask(taskId: string) {
    return (
      (await this.#db
        .select()
        .from(taskRuns)
        .where(and(eq(taskRuns.taskId, taskId), inArray(taskRuns.status, ACTIVE_RUN_STATUSES)))
        .get()) ?? null
    );
  }
}
