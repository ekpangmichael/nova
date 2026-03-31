import { createHash, randomBytes } from "node:crypto";
import { access, copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import {
  and,
  desc,
  eq,
  gte,
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
  DashboardActivityItem,
  DashboardAttentionItem,
  DashboardStats,
  DashboardWorkingLog,
  DashboardWorkingRun,
  JsonValue,
  MonitorSummary,
  ProjectActivityItem,
  RecentFailureView,
  RunEventRecord,
  RuntimeKind,
  RunStatus,
  TaskAttachmentRecord,
  TaskCommentRecord,
  TaskPriority,
  TaskRecord,
  TaskRunRecord,
  TaskStatus,
  ThinkingLevel,
} from "@nova/shared";
import type { AppEnv } from "../env.js";
import {
  badRequest,
  conflict,
  notFound,
  serviceUnavailable,
  ApiError,
} from "../lib/errors.js";
import {
  isAbsoluteHostPath,
  normalizeAbsolutePath,
  normalizeProjectPath,
  resolveExecutionTargetPath,
  resolvePathWithinBase,
  resolveProjectPath,
  sanitizeFileName,
} from "../lib/paths.js";
import { humanizeAgentOperatorMessage } from "../lib/agent-operator-message.js";
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
  runtime?: {
    kind: RuntimeKind;
    runtimeAgentId?: string;
    workspacePath?: string;
    runtimeStatePath?: string;
    defaultModelId?: string | null;
    modelOverrideAllowed?: boolean;
    sandboxMode?: "off" | "docker" | "other";
    defaultThinkingLevel?: ThinkingLevel;
  };
};

type PatchAgentInput = Omit<Partial<CreateAgentInput>, "runtime"> & {
  runtime?: Partial<NonNullable<CreateAgentInput["runtime"]>>;
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

type CreateCommentRecordInput = {
  taskId: string;
  taskRunId?: string | null;
  authorType: "user" | "agent" | "system";
  authorId?: string | null;
  source: "ticket_user" | "agent_mirror" | "agent_api" | "system";
  externalMessageId?: string | null;
  body: string;
  createdAt?: string;
};

type SaveAttachmentInput = {
  taskId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

type AgentRuntimeCheckpointInput = {
  state: "working" | "blocked" | "needs_input";
  summary: string;
  details?: string | null;
};

type AgentRuntimeArtifactInput = {
  kind: ArtifactKind;
  path: string;
  label?: string | null;
  summary?: string | null;
};

type ActiveSubscription = {
  runId: string;
  runtimeSessionKey: string;
  nextSeq: number;
  queue: Promise<void>;
  unsubscribe: (() => Promise<void>) | null;
};

type RunBridgeTokenRecord = {
  token: string;
  taskId: string;
  runId: string;
  agentId: string;
  createdAt: string;
};

const RUN_BRIDGE_TOKEN_TTL_MS = 15 * 60 * 1000;

export class NovaService {
  #db: AppDatabase;
  #env: AppEnv;
  #runtimeManager: RuntimeManager;
  #websocketHub: WebsocketHub;
  #activeRuns = new Map<string, ActiveSubscription>();
  #runBridgeTokens = new Map<string, RunBridgeTokenRecord>();

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

    await this.#reconcileIncompleteRuns();
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

  async listRuntimes() {
    return this.#runtimeManager.listRuntimes();
  }

  async getOpenClawCatalog() {
    return this.#runtimeManager.getOpenClawCatalog();
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
    for (const assignment of assignments) {
      const agent = await this.#getAgentRow(assignment.agentId);
      await this.#runtimeManager
        .getAdapter(agent.runtimeKind)
        .ensureProjectRoot(agent.id, agent.agentHomePath, nextProjectRoot, {
          type: patch.seedType ?? current.seedType,
          url: patch.seedUrl !== undefined ? patch.seedUrl : current.seedUrl,
        });
    }

    const project = await this.getProject(projectId);
    this.#websocketHub.broadcast("project.updated", project);
    return project;
  }

  async deleteProject(projectId: string) {
    await this.#getProjectRow(projectId);

    const [projectTaskRows, assignmentRows] = await Promise.all([
      this.#db
        .select()
        .from(tasks)
        .where(eq(tasks.projectId, projectId))
        .all(),
      this.#db
        .select({ agentId: projectAgents.agentId })
        .from(projectAgents)
        .where(eq(projectAgents.projectId, projectId))
        .all(),
    ]);

    const taskIds = projectTaskRows.map((task) => task.id);
    const assignedAgentIds = [...new Set(assignmentRows.map((row) => row.agentId))];

    const [attachmentRows, runRows] = await Promise.all([
      taskIds.length > 0
        ? this.#db
            .select()
            .from(taskAttachments)
            .where(inArray(taskAttachments.taskId, taskIds))
            .all()
        : Promise.resolve([]),
      taskIds.length > 0
        ? this.#db
            .select()
            .from(taskRuns)
            .where(inArray(taskRuns.taskId, taskIds))
            .all()
        : Promise.resolve([]),
    ]);

    const activeProjectRuns = runRows.filter((run) =>
      ACTIVE_RUN_STATUSES.includes(run.status)
    );

    for (const run of activeProjectRuns) {
      const adapter = this.#runtimeManager.getAdapter(run.runtimeKind);
      await adapter.stopRun(run.runtimeSessionKey);
      const active = this.#activeRuns.get(run.id);
      await active?.queue;
    }

    const agentIdsForStateCleanup = [
      ...new Set([
        ...assignedAgentIds,
        ...projectTaskRows.map((task) => task.assignedAgentId),
        ...runRows.map((run) => run.agentId),
      ]),
    ];
    const agentRows =
      agentIdsForStateCleanup.length > 0
        ? await this.#db
            .select()
            .from(agents)
            .where(inArray(agents.id, agentIdsForStateCleanup))
            .all()
        : [];

    await this.#db.transaction(async (tx) => {
      for (const agent of agentRows) {
        if (!agent.currentTaskId || !taskIds.includes(agent.currentTaskId)) {
          continue;
        }

        await tx
          .update(agents)
          .set({
            currentTaskId: null,
            status: agent.status === "working" ? "idle" : agent.status,
            updatedAt: nowIso(),
          })
          .where(eq(agents.id, agent.id))
          .run();
      }

      await tx.delete(projects).where(eq(projects.id, projectId)).run();
    });

    for (const attachment of attachmentRows) {
      await rm(`${this.#env.attachmentsDir}/${attachment.relativeStoragePath}`, {
        force: true,
      });
    }

    const runDirs = new Set(
      runRows.map((run) => {
        const agent = agentRows.find((row) => row.id === run.agentId);
        return agent ? `${agent.agentHomePath}/.apm/runs/${run.id}` : null;
      })
    );

    for (const runDir of runDirs) {
      if (!runDir) {
        continue;
      }

      await rm(runDir, { recursive: true, force: true });
    }

    for (const taskId of taskIds) {
      await rm(`${this.#env.attachmentsDir}/${taskId}`, {
        recursive: true,
        force: true,
      });
    }

    for (const run of runRows) {
      this.#activeRuns.delete(run.id);
      this.#deleteRunBridgeToken(run.id);
    }

    for (const agentId of assignedAgentIds) {
      this.#websocketHub.broadcast("agent.updated", await this.getAgent(agentId));
    }
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
      .getAdapter(agent.runtimeKind)
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

  async getProjectTasks(projectId: string) {
    await this.#getProjectRow(projectId);

    const rows = await this.#db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(tasks.taskNumber)
      .all();

    if (rows.length === 0) {
      return [];
    }

    const taskIds = rows.map((row) => row.id);
    const agentIds = [...new Set(rows.map((row) => row.assignedAgentId))];

    const [agentRows, commentCounts, attachmentCounts, activeRunRows] =
      await Promise.all([
        this.#db
          .select()
          .from(agents)
          .where(inArray(agents.id, agentIds))
          .all(),
        this.#db
          .select({
            taskId: taskComments.taskId,
            count: sql<number>`count(*)`,
          })
          .from(taskComments)
          .where(inArray(taskComments.taskId, taskIds))
          .groupBy(taskComments.taskId)
          .all(),
        this.#db
          .select({
            taskId: taskAttachments.taskId,
            count: sql<number>`count(*)`,
          })
          .from(taskAttachments)
          .where(inArray(taskAttachments.taskId, taskIds))
          .groupBy(taskAttachments.taskId)
          .all(),
        this.#db
          .select()
          .from(taskRuns)
          .where(
            and(
              inArray(taskRuns.taskId, taskIds),
              inArray(taskRuns.status, ACTIVE_RUN_STATUSES)
            )
          )
          .orderBy(desc(taskRuns.createdAt))
          .all(),
      ]);

    const agentsById = new Map(agentRows.map((row) => [row.id, row]));
    const commentCountsByTaskId = new Map(
      commentCounts.map((row) => [row.taskId, row.count])
    );
    const attachmentCountsByTaskId = new Map(
      attachmentCounts.map((row) => [row.taskId, row.count])
    );
    const activeRunsByTaskId = new Map<string, typeof taskRuns.$inferSelect>();

    for (const run of activeRunRows) {
      if (!activeRunsByTaskId.has(run.taskId)) {
        activeRunsByTaskId.set(run.taskId, run);
      }
    }

    return rows.map((row) => {
      const assignedAgent = agentsById.get(row.assignedAgentId);

      return {
        ...this.#serializeTask(row),
        assignedAgent: assignedAgent
          ? this.#serializeAgentResponse(assignedAgent)
          : null,
        commentCount: commentCountsByTaskId.get(row.id) ?? 0,
        attachmentCount: attachmentCountsByTaskId.get(row.id) ?? 0,
        currentRun: activeRunsByTaskId.has(row.id)
          ? this.#serializeRun(activeRunsByTaskId.get(row.id)!)
          : null,
      };
    });
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
      ...this.#serializeAgentResponse(row),
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
    const runtimeKind = input.runtime?.kind ?? "openclaw-native";
    const runtimeAgentId = input.runtime?.runtimeAgentId?.trim() || slug;
    const runtimeDefaults = this.#buildOpenClawRuntimeDefaults(runtimeAgentId);
    const workspacePath =
      input.runtime?.workspacePath?.trim() || runtimeDefaults.workspacePath;
    const runtimeStatePath =
      input.runtime?.runtimeStatePath?.trim() || runtimeDefaults.runtimeStatePath;
    const adapter = this.#runtimeManager.getAdapter(runtimeKind);
    const runtimeCatalog = await adapter.getCatalog();

    if (!runtimeCatalog.available) {
      throw serviceUnavailable("OpenClaw runtime is not available.", runtimeCatalog.health);
    }

    if (
      runtimeCatalog.existingAgents.some(
        (runtimeAgent) => runtimeAgent.runtimeAgentId === runtimeAgentId
      )
    ) {
      throw conflict(`OpenClaw agent "${runtimeAgentId}" already exists.`);
    }

    const defaultModelId =
      input.runtime?.defaultModelId?.trim() ||
      runtimeCatalog.defaults.defaultModelId ||
      null;

    if (
      defaultModelId &&
      !runtimeCatalog.models.some((model) => model.id === defaultModelId && model.available)
    ) {
      throw badRequest(`Model "${defaultModelId}" is not available in OpenClaw.`);
    }

    const { modelProvider, modelName } = this.#splitModelId(defaultModelId);
    let inserted = false;

    await adapter.provisionAgent({
      runtimeAgentId,
      workspacePath,
      runtimeStatePath,
      defaultModelId,
      modelOverrideAllowed: input.runtime?.modelOverrideAllowed ?? true,
      sandboxMode: input.runtime?.sandboxMode ?? "off",
      defaultThinkingLevel: input.runtime?.defaultThinkingLevel ?? "medium",
    });

    try {
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
          runtimeKind,
          runtimeAgentId,
          agentHomePath: workspacePath,
          runtimeStatePath,
          modelProvider,
          modelName,
          modelOverrideAllowed: input.runtime?.modelOverrideAllowed ?? true,
          sandboxMode: input.runtime?.sandboxMode ?? "off",
          defaultThinkingLevel: input.runtime?.defaultThinkingLevel ?? "medium",
          status: "idle",
          currentTaskId: null,
          lastSeenAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      inserted = true;

      const row = await this.#getAgentRow(id);
      await this.#syncAgentWorkspaceRow(row);

      const agent = await this.getAgent(id);
      this.#websocketHub.broadcast("agent.updated", agent);
      return agent;
    } catch (error) {
      if (inserted) {
        await this.#db.delete(agents).where(eq(agents.id, id)).run();
      }

      try {
        await adapter.deleteAgent(runtimeAgentId);
      } catch {
        // Keep the original error so creation failure is obvious.
      }

      throw error;
    }
  }

  async patchAgent(agentId: string, patch: PatchAgentInput) {
    const current = await this.#getAgentRow(agentId);
    const adapter = this.#runtimeManager.getAdapter(current.runtimeKind);
    const currentDefaultModelId = this.#buildModelId(
      current.modelProvider,
      current.modelName
    );
    const nextDefaultModelId =
      patch.runtime?.defaultModelId !== undefined
        ? patch.runtime.defaultModelId
        : currentDefaultModelId;

    if (patch.runtime?.kind && patch.runtime.kind !== current.runtimeKind) {
      throw badRequest("Switching runtimes after creation is not supported yet.");
    }

    if (
      patch.runtime?.runtimeAgentId !== undefined &&
      patch.runtime.runtimeAgentId !== current.runtimeAgentId
    ) {
      throw badRequest("Updating runtimeAgentId after creation is not supported yet.");
    }

    if (
      patch.runtime?.workspacePath !== undefined &&
      patch.runtime.workspacePath !== current.agentHomePath
    ) {
      throw badRequest("Updating workspacePath after creation is not supported yet.");
    }

    if (
      patch.runtime?.runtimeStatePath !== undefined &&
      patch.runtime.runtimeStatePath !== current.runtimeStatePath
    ) {
      throw badRequest("Updating runtimeStatePath after creation is not supported yet.");
    }

    const { modelProvider, modelName } = this.#splitModelId(nextDefaultModelId ?? null);
    const defaultModelChanged =
      patch.runtime?.defaultModelId !== undefined &&
      nextDefaultModelId !== currentDefaultModelId;

    if (defaultModelChanged && nextDefaultModelId) {
      const catalog = await adapter.getCatalog();
      if (!catalog.models.some((model) => model.id === nextDefaultModelId && model.available)) {
        throw badRequest(`Model "${nextDefaultModelId}" is not available in OpenClaw.`);
      }
    }

    const nextSlug = patch.slug ? slugify(patch.slug) : current.slug;
    const nextName = patch.name?.trim() ?? current.name;
    const nextAvatar = patch.avatar !== undefined ? patch.avatar : current.avatar;
    const nextRole = patch.role?.trim() ?? current.role;
    const nextSystemInstructions =
      patch.systemInstructions?.trim() ?? current.systemInstructions;
    const nextPersonaText =
      patch.personaText !== undefined ? patch.personaText : current.personaText;
    const nextUserContextText =
      patch.userContextText !== undefined
        ? patch.userContextText
        : current.userContextText;
    const nextIdentityText =
      patch.identityText !== undefined ? patch.identityText : current.identityText;
    const nextToolsText =
      patch.toolsText !== undefined ? patch.toolsText : current.toolsText;
    const nextHeartbeatText =
      patch.heartbeatText !== undefined
        ? patch.heartbeatText
        : current.heartbeatText;
    const nextMemoryText =
      patch.memoryText !== undefined ? patch.memoryText : current.memoryText;
    const nextModelOverrideAllowed =
      patch.runtime?.modelOverrideAllowed ?? current.modelOverrideAllowed;
    const nextSandboxMode = patch.runtime?.sandboxMode ?? current.sandboxMode;
    const nextDefaultThinkingLevel =
      patch.runtime?.defaultThinkingLevel ?? current.defaultThinkingLevel;
    const nextStatus = patch.status ?? current.status;
    const needsWorkspaceSync =
      nextName !== current.name ||
      nextRole !== current.role ||
      nextSystemInstructions !== current.systemInstructions ||
      nextPersonaText !== current.personaText ||
      nextUserContextText !== current.userContextText ||
      nextIdentityText !== current.identityText ||
      nextToolsText !== current.toolsText ||
      nextHeartbeatText !== current.heartbeatText ||
      nextMemoryText !== current.memoryText;
    const hasChanges =
      nextSlug !== current.slug ||
      nextName !== current.name ||
      nextAvatar !== current.avatar ||
      nextRole !== current.role ||
      nextSystemInstructions !== current.systemInstructions ||
      nextPersonaText !== current.personaText ||
      nextUserContextText !== current.userContextText ||
      nextIdentityText !== current.identityText ||
      nextToolsText !== current.toolsText ||
      nextHeartbeatText !== current.heartbeatText ||
      nextMemoryText !== current.memoryText ||
      modelProvider !== current.modelProvider ||
      modelName !== current.modelName ||
      nextModelOverrideAllowed !== current.modelOverrideAllowed ||
      nextSandboxMode !== current.sandboxMode ||
      nextDefaultThinkingLevel !== current.defaultThinkingLevel ||
      nextStatus !== current.status;

    if (!hasChanges) {
      return this.getAgent(agentId);
    }

    await this.#db
      .update(agents)
      .set({
        slug: nextSlug,
        name: nextName,
        avatar: nextAvatar,
        role: nextRole,
        systemInstructions: nextSystemInstructions,
        personaText: nextPersonaText,
        userContextText: nextUserContextText,
        identityText: nextIdentityText,
        toolsText: nextToolsText,
        heartbeatText: nextHeartbeatText,
        memoryText: nextMemoryText,
        runtimeAgentId: current.runtimeAgentId,
        agentHomePath: current.agentHomePath,
        runtimeStatePath: current.runtimeStatePath,
        modelProvider,
        modelName,
        modelOverrideAllowed: nextModelOverrideAllowed,
        sandboxMode: nextSandboxMode,
        defaultThinkingLevel: nextDefaultThinkingLevel,
        status: nextStatus,
        updatedAt: nowIso(),
      })
      .where(eq(agents.id, agentId))
      .run();

    const row = await this.#getAgentRow(agentId);
    const agent = await this.getAgent(agentId);
    this.#websocketHub.broadcast("agent.updated", agent);

    if (needsWorkspaceSync) {
      this.#scheduleAgentWorkspaceSync(row);
    }

    return agent;
  }

  async syncAgentHome(agentId: string) {
    const row = await this.#getAgentRow(agentId);
    const result = await this.#syncAgentWorkspaceRow(row);
    const refreshed = await this.getAgent(agentId);
    this.#websocketHub.broadcast("agent.updated", refreshed);

    return {
      agentId,
      homePath: row.agentHomePath,
      files: result.files,
      syncedAt: result.syncedAt,
    };
  }

  async deleteAgent(agentId: string) {
    const agent = await this.#getAgentRow(agentId);
    const [ownedTasks, assignmentRows, runRows] = await Promise.all([
      this.#db
        .select({
          id: tasks.id,
        })
        .from(tasks)
        .where(eq(tasks.assignedAgentId, agentId))
        .all(),
      this.#db
        .select({
          projectId: projectAgents.projectId,
        })
        .from(projectAgents)
        .where(eq(projectAgents.agentId, agentId))
        .all(),
      this.#db
        .select()
        .from(taskRuns)
        .where(eq(taskRuns.agentId, agentId))
        .all(),
    ]);

    if (ownedTasks.length > 0) {
      throw conflict(
        `Cannot delete an agent that still owns ${ownedTasks.length} task${
          ownedTasks.length === 1 ? "" : "s"
        }. Reassign or delete those tasks first.`
      );
    }

    const activeAgentRuns = runRows.filter((run) =>
      ACTIVE_RUN_STATUSES.includes(run.status)
    );

    for (const run of activeAgentRuns) {
      const adapter = this.#runtimeManager.getAdapter(run.runtimeKind);
      await adapter.stopRun(run.runtimeSessionKey);
      const active = this.#activeRuns.get(run.id);
      await active?.queue;
    }

    await this.#runtimeManager
      .getAdapter(agent.runtimeKind)
      .deleteAgent(agent.runtimeAgentId);

    await this.#db.transaction(async (tx) => {
      if (runRows.length > 0) {
        await tx.delete(taskRuns).where(eq(taskRuns.agentId, agentId)).run();
      }

      await tx.delete(agents).where(eq(agents.id, agentId)).run();
    });

    const runDirs = new Set(runRows.map((run) => `${agent.agentHomePath}/.apm/runs/${run.id}`));

    for (const runDir of runDirs) {
      await rm(runDir, { recursive: true, force: true });
    }

    for (const run of runRows) {
      this.#activeRuns.delete(run.id);
      this.#deleteRunBridgeToken(run.id);
    }

    const assignedProjectIds = [...new Set(assignmentRows.map((row) => row.projectId))];

    for (const projectId of assignedProjectIds) {
      this.#websocketHub.broadcast("project.updated", await this.getProject(projectId));
    }
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

  async deleteTask(taskId: string) {
    const task = await this.#getTaskRow(taskId);
    const activeRun = await this.#getActiveRunForTask(taskId);
    const [attachmentRows, runRows, project, agent] = await Promise.all([
      this.#db
        .select()
        .from(taskAttachments)
        .where(eq(taskAttachments.taskId, taskId))
        .all(),
      this.#db
        .select()
        .from(taskRuns)
        .where(eq(taskRuns.taskId, taskId))
        .all(),
      this.#getProjectRow(task.projectId),
      this.#getAgentRow(task.assignedAgentId),
    ]);

    if (activeRun) {
      const adapter = this.#runtimeManager.getAdapter(activeRun.runtimeKind);
      await adapter.stopRun(activeRun.runtimeSessionKey);
      const active = this.#activeRuns.get(activeRun.id);
      await active?.queue;
    }

    await this.#db.transaction(async (tx) => {
      if (agent.currentTaskId === taskId) {
        await tx
          .update(agents)
          .set({
            currentTaskId: null,
            status: agent.status === "working" ? "idle" : agent.status,
            updatedAt: nowIso(),
          })
          .where(eq(agents.id, agent.id))
          .run();
      }

      await tx.delete(tasks).where(eq(tasks.id, taskId)).run();
    });

    for (const attachment of attachmentRows) {
      await rm(`${this.#env.attachmentsDir}/${attachment.relativeStoragePath}`, {
        force: true,
      });
    }

    await rm(`${this.#env.attachmentsDir}/${taskId}`, {
      recursive: true,
      force: true,
    });

    for (const run of runRows) {
      await rm(`${agent.agentHomePath}/.apm/runs/${run.id}`, {
        recursive: true,
        force: true,
      });
      this.#activeRuns.delete(run.id);
      this.#deleteRunBridgeToken(run.id);
    }

    this.#websocketHub.broadcast("project.updated", await this.getProject(project.id));
    this.#websocketHub.broadcast("agent.updated", await this.getAgent(agent.id));
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
      .orderBy(taskComments.createdAt)
      .all();
    return rows.map((row) => this.#serializeComment(row));
  }

  async addTaskComment(taskId: string, input: AddCommentInput) {
    const task = await this.#getTaskRow(taskId);
    const activeRun = await this.#getActiveRunForTask(taskId);
    const authorType = input.authorType ?? "user";
    const comment = await this.#createTaskCommentRecord({
      taskId,
      taskRunId: activeRun?.id ?? null,
      authorType,
      authorId: input.authorId ?? null,
      source: authorType === "system" ? "system" : "ticket_user",
      body: input.body.trim(),
    });

    if (authorType === "user" && activeRun) {
      void this.#forwardCommentToActiveRun(taskId, comment, activeRun);
    } else if (
      authorType === "user" &&
      !activeRun &&
      (await this.#taskShouldAutoResume(task))
    ) {
      void this.#autoResumeTaskAfterComment(taskId);
    }

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
    await this.#syncAgentWorkspaceRow(agent);

    const adapter = this.#runtimeManager.getAdapter(agent.runtimeKind);
    await adapter.ensureRuntimeReady();
    await adapter.ensureAgentWorkspace(
      agent.id,
      agent.agentHomePath,
      agent.runtimeStatePath
    );
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
    const runtimeSessionKey = `nova:task:${taskId}`;
    const runDir = `${agent.agentHomePath}/.apm/runs/${runId}`;
    const inputsDir = `${runDir}/inputs`;
    const outputsDir = `${runDir}/outputs`;
    const bridgeToken = this.#createRunBridgeToken({
      taskId,
      runId,
      agentId: agent.id,
    });
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

    const followUpInstructions = await this.#buildTaskFollowUpInstructions(taskId);

    const taskFile = buildTaskFile({
      taskId,
      runId,
      projectName: project.name,
      agentName: agent.name,
      title: task.title,
      description: task.description,
      resolvedExecutionTarget: resolvedTarget.normalizedPath,
      attachments: attachmentNames,
      extraInstructions: followUpInstructions,
    });

    await writeFile(`${runDir}/TASK.md`, taskFile, "utf8");
    await writeFile(
      `${runDir}/NOVA_RUNTIME.json`,
      stringifyJson({
        baseUrl: this.#getOperatorBaseUrl(),
        taskId,
        runId,
        agentId: agent.id,
        token: bridgeToken.token,
      }),
      "utf8"
    );

    const now = nowIso();

    await this.#db
      .insert(taskRuns)
      .values({
        id: runId,
        taskId,
        attemptNumber,
        agentId: agent.id,
        runtimeKind: agent.runtimeKind,
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

    try {
      const startResult = await adapter.startRun({
        taskId,
        runId,
        agentId: agent.id,
        runtimeAgentId: agent.runtimeAgentId,
        agentHomePath: agent.agentHomePath,
        executionTarget: resolvedTarget.normalizedPath,
        prompt: buildRuntimePrompt(runId, {
          followUpInstructions,
        }),
        attachments: attachments.map((attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          path: `${inputsDir}/${attachment.fileName}`,
          mimeType: attachment.mimeType,
          sha256: attachment.sha256,
          sizeBytes: attachment.sizeBytes,
        })),
        modelOverride: this.#buildModelId(agent.modelProvider, agent.modelName),
        thinkingLevel: agent.defaultThinkingLevel,
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
    } catch (error) {
      if (active.unsubscribe) {
        await active.unsubscribe();
      }

      this.#activeRuns.delete(runId);
      this.#deleteRunBridgeToken(runId);

      await this.#db
        .update(taskRuns)
        .set({
          status: "failed",
          endedAt: nowIso(),
          failureReason:
            error instanceof Error ? error.message : "Runtime failed to start.",
          updatedAt: nowIso(),
        })
        .where(eq(taskRuns.id, runId))
        .run();

      await this.#db
        .update(tasks)
        .set({
          status: task.status,
          updatedAt: nowIso(),
        })
        .where(eq(tasks.id, taskId))
        .run();

      await this.#db
        .update(agents)
        .set({
          status: "idle",
          currentTaskId: null,
          updatedAt: nowIso(),
        })
        .where(eq(agents.id, agent.id))
        .run();

      await this.#createTaskCommentRecord({
        taskId,
        taskRunId: runId,
        authorType: "system",
        authorId: null,
        source: "system",
        body:
          error instanceof Error
            ? `Run failed to start: ${error.message}`
            : "Run failed to start.",
      });

      throw error;
    }
  }

  async #buildTaskFollowUpInstructions(taskId: string) {
    const comments = await this.#db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, taskId))
      .orderBy(desc(taskComments.createdAt))
      .all();

    const latestAgentCommentAt =
      comments.find((comment) => comment.authorType === "agent")?.createdAt ?? null;
    const relevantOperatorComments = comments.filter((comment) => {
      if (comment.authorType !== "user") {
        return false;
      }

      if (!latestAgentCommentAt) {
        return true;
      }

      return comment.createdAt > latestAgentCommentAt;
    });
    const recentOperatorComments = relevantOperatorComments.slice(0, 5).reverse();

    if (recentOperatorComments.length === 0) {
      return null;
    }

    return [
      "Recent operator follow-up comments:",
      ...recentOperatorComments.map(
        (comment, index) => `${index + 1}. [${comment.createdAt}] ${comment.body}`
      ),
      "Treat the newest operator comment as the current revision request.",
    ].join("\n");
  }

  async stopTask(taskId: string) {
    const activeRun = await this.#getActiveRunForTask(taskId);

    if (!activeRun) {
      throw conflict("Task does not have an active run.");
    }

    await this.#runtimeManager
      .getAdapter(activeRun.runtimeKind)
      .stopRun(activeRun.runtimeSessionKey);
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
      agent: this.#serializeAgentResponse(agent),
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
      label: row.label,
      summary: row.summary,
      mimeType: row.mimeType,
      sha256: row.sha256,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt,
    }));
  }

  async addAgentRuntimeComment(
    taskId: string,
    token: string,
    input: { body: string }
  ) {
    const authorization = await this.#authorizeRunBridgeToken(token, taskId);
    const comment = await this.#createTaskCommentRecord({
      taskId,
      taskRunId: authorization.runId,
      authorType: "agent",
      authorId: authorization.agentId,
      source: "agent_api",
      body: humanizeAgentOperatorMessage(input.body),
    });

    this.#websocketHub.broadcast("task.updated", await this.getTask(taskId));
    return comment;
  }

  async addAgentRuntimeCheckpoint(
    taskId: string,
    token: string,
    input: AgentRuntimeCheckpointInput
  ) {
    const authorization = await this.#authorizeRunBridgeToken(token, taskId);
    const checkpointBody = [
      `[${input.state.replace(/_/g, " ").toUpperCase()}] ${input.summary.trim()}`,
      input.details?.trim() || null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const runtimeEvent = {
      type: "warning",
      at: nowIso(),
      data: {
        checkpointState: input.state,
        summary: input.summary.trim(),
        details: input.details?.trim() ?? null,
      },
    } satisfies RuntimeEvent;
    const seq = await this.#appendRunEvent(authorization.runId, runtimeEvent);
    const checkpointComment =
      input.state !== "needs_input"
        ? await this.#createTaskCommentRecord({
            taskId,
            taskRunId: authorization.runId,
            authorType: "agent",
            authorId: authorization.agentId,
            source: "agent_api",
            body: checkpointBody,
          })
        : null;

    if (input.state === "needs_input") {
      await this.#db
        .update(tasks)
        .set({
          status: "blocked",
          updatedAt: nowIso(),
        })
        .where(eq(tasks.id, taskId))
        .run();
    }

    this.#websocketHub.broadcast("run.event", {
      runId: authorization.runId,
      taskId,
      seq,
      event: runtimeEvent,
    });
    this.#websocketHub.broadcast("run.updated", await this.getRun(authorization.runId));
    this.#websocketHub.broadcast("task.updated", await this.getTask(taskId));
    if (checkpointComment) {
      return checkpointComment;
    }

    return {
      state: input.state,
      summary: input.summary.trim(),
      details: input.details?.trim() ?? null,
    };
  }

  async addAgentRuntimeArtifact(
    taskId: string,
    token: string,
    input: AgentRuntimeArtifactInput
  ) {
    const authorization = await this.#authorizeRunBridgeToken(token, taskId);
    const task = await this.#getTaskRow(taskId);
    const agent = await this.#getAgentRow(authorization.agentId);
    const absolutePath = this.#resolveAgentArtifactPath({
      agentHomePath: agent.agentHomePath,
      task,
      runId: authorization.runId,
      inputPath: input.path,
    });
    const stats = await stat(absolutePath).catch(() => null);

    if (!stats?.isFile()) {
      throw badRequest("Artifact path must point to an existing file.");
    }

    const buffer = await readFile(absolutePath);
    const artifact = {
      id: generateId(),
      taskRunId: authorization.runId,
      path: absolutePath,
      kind: input.kind,
      label: input.label?.trim() || null,
      summary: input.summary?.trim() || null,
      mimeType: null,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      sizeBytes: stats.size,
      createdAt: nowIso(),
    };

    await this.#db.insert(runArtifacts).values(artifact).run();
    const runtimeEvent = {
      type: "artifact.created",
      at: artifact.createdAt,
      data: {
        path: absolutePath,
        kind: input.kind,
        label: artifact.label,
        summary: artifact.summary,
      },
    } satisfies RuntimeEvent;
    const seq = await this.#appendRunEvent(authorization.runId, runtimeEvent);

    this.#websocketHub.broadcast("run.event", {
      runId: authorization.runId,
      taskId,
      seq,
      event: runtimeEvent,
    });
    this.#websocketHub.broadcast("run.updated", await this.getRun(authorization.runId));
    this.#websocketHub.broadcast("task.updated", await this.getTask(taskId));
    return artifact;
  }

  async getMonitorSummary(): Promise<MonitorSummary> {
    const [runtimeHealth, stats, recentFailureCount] = await Promise.all([
      this.#runtimeManager.getHealth(),
      this.getDashboardStats(),
      this.#db
        .select({ count: sql<number>`count(*)` })
        .from(taskRuns)
        .where(eq(taskRuns.status, "failed"))
        .get()
        .then((row) => row?.count ?? 0),
    ]);

    return {
      runtimeHealth,
      totalProjectCount: stats.totalProjectCount,
      activeProjectCount: stats.activeProjectCount,
      totalAgentCount: stats.totalAgentCount,
      activeAgentCount: stats.activeAgentCount,
      activeRunCount:
        (await this.#db
          .select({ count: sql<number>`count(*)` })
          .from(taskRuns)
          .where(inArray(taskRuns.status, ACTIVE_RUN_STATUSES))
          .get())?.count ?? 0,
      openTaskCount: stats.openTaskCount,
      recentFailureCount,
      completedThisWeekCount: stats.completedThisWeekCount,
      agentCounts: {
        idle:
          stats.totalAgentCount -
          stats.activeAgentCount -
          ((await this.#db
            .select({ count: sql<number>`count(*)` })
            .from(agents)
            .where(eq(agents.status, "offline"))
            .get())?.count ?? 0),
        working:
          (await this.#db
            .select({ count: sql<number>`count(*)` })
            .from(agents)
            .where(eq(agents.status, "working"))
            .get())?.count ?? 0,
        paused:
          (await this.#db
            .select({ count: sql<number>`count(*)` })
            .from(agents)
            .where(eq(agents.status, "paused"))
            .get())?.count ?? 0,
        error:
          (await this.#db
            .select({ count: sql<number>`count(*)` })
            .from(agents)
            .where(eq(agents.status, "error"))
            .get())?.count ?? 0,
        offline:
          (await this.#db
            .select({ count: sql<number>`count(*)` })
            .from(agents)
            .where(eq(agents.status, "offline"))
            .get())?.count ?? 0,
      },
    };
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const completedSince = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const countAgentStatus = (status: AgentRecord["status"]) =>
      this.#db
        .select({ count: sql<number>`count(*)` })
        .from(agents)
        .where(eq(agents.status, status))
        .get()
        .then((row) => row?.count ?? 0);

    const [
      totalProjectCount,
      activeProjectCount,
      totalAgentCount,
      idleAgentCount,
      workingAgentCount,
      pausedAgentCount,
      errorAgentCount,
      openTaskCount,
      completedThisWeekCount,
    ] = await Promise.all([
      this.#db
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .get()
        .then((row) => row?.count ?? 0),
      this.#db
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(eq(projects.status, "active"))
        .get()
        .then((row) => row?.count ?? 0),
      this.#db
        .select({ count: sql<number>`count(*)` })
        .from(agents)
        .get()
        .then((row) => row?.count ?? 0),
      countAgentStatus("idle"),
      countAgentStatus("working"),
      countAgentStatus("paused"),
      countAgentStatus("error"),
      this.#db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(notInArray(tasks.status, ["done", "canceled"]))
        .get()
        .then((row) => row?.count ?? 0),
      this.#db
        .select({ count: sql<number>`count(distinct ${taskRuns.taskId})` })
        .from(taskRuns)
        .where(
          and(eq(taskRuns.status, "completed"), gte(taskRuns.endedAt, completedSince))
        )
        .get()
        .then((row) => row?.count ?? 0),
    ]);

    return {
      totalProjectCount,
      activeProjectCount,
      totalAgentCount,
      activeAgentCount:
        idleAgentCount + workingAgentCount + pausedAgentCount + errorAgentCount,
      openTaskCount,
      completedThisWeekCount,
    };
  }

  async getDashboardWorkingRuns(limit = 3): Promise<DashboardWorkingRun[]> {
    const rows = await this.#db
      .select({
        runId: taskRuns.id,
        taskId: tasks.id,
        taskNumber: tasks.taskNumber,
        taskTitle: tasks.title,
        projectId: projects.id,
        projectName: projects.name,
        agentId: agents.id,
        agentName: agents.name,
        agentSlug: agents.slug,
        runtimeAgentId: agents.runtimeAgentId,
        status: taskRuns.status,
        startedAt: taskRuns.startedAt,
        resolvedExecutionTarget: tasks.resolvedExecutionTarget,
      })
      .from(taskRuns)
      .innerJoin(tasks, eq(taskRuns.taskId, tasks.id))
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .innerJoin(agents, eq(taskRuns.agentId, agents.id))
      .where(inArray(taskRuns.status, ACTIVE_RUN_STATUSES))
      .orderBy(desc(taskRuns.createdAt))
      .limit(limit)
      .all();

    return Promise.all(
      rows.map(async (row) => {
        const eventRows = await this.#db
          .select({
            eventType: runEvents.eventType,
            payloadJson: runEvents.payloadJson,
            createdAt: runEvents.createdAt,
          })
          .from(runEvents)
          .where(eq(runEvents.taskRunId, row.runId))
          .orderBy(desc(runEvents.seq))
          .limit(8)
          .all();

        const logs = eventRows
          .map((eventRow) =>
            this.#buildDashboardWorkingLog(
              eventRow.eventType,
              parseJsonText<JsonValue>(eventRow.payloadJson, null),
              eventRow.createdAt
            )
          )
          .filter((entry): entry is DashboardWorkingLog => Boolean(entry))
          .slice(0, 4)
          .reverse();

        const lastEventAt = eventRows[0]?.createdAt ?? row.startedAt ?? null;

        return {
          runId: row.runId,
          taskId: row.taskId,
          taskNumber: row.taskNumber,
          taskTitle: row.taskTitle,
          projectId: row.projectId,
          projectName: row.projectName,
          agentId: row.agentId,
          agentName: row.agentName,
          agentSlug: row.agentSlug,
          runtimeAgentId: row.runtimeAgentId,
          status: row.status,
          startedAt: row.startedAt,
          lastEventAt,
          resolvedExecutionTarget: row.resolvedExecutionTarget,
          logs:
            logs.length > 0
              ? logs
              : [
                  {
                    at: row.startedAt ?? nowIso(),
                    level: "dim",
                    message: "Waiting for runtime events...",
                  },
                ],
        };
      })
    );
  }

  async getDashboardActivity(limit = 6): Promise<DashboardActivityItem[]> {
    const summarize = (value: string, max = 96) => {
      const compact = value.replace(/\s+/g, " ").trim();

      if (!compact) {
        return "";
      }

      return compact.length <= max
        ? compact
        : `${compact.slice(0, max - 1).trimEnd()}…`;
    };
    const formatTaskLabel = (taskNumber: number, taskTitle: string) =>
      `TASK-${String(taskNumber).padStart(3, "0")} ${taskTitle}`;
    const readAgentLabel = (row: {
      runtimeAgentId: string | null;
      agentSlug: string | null;
      agentName: string | null;
    }) =>
      row.runtimeAgentId || row.agentSlug || row.agentName || "AGENT";

    const [commentRows, runRows, assignmentRows] = await Promise.all([
      this.#db
        .select({
          id: taskComments.id,
          taskId: tasks.id,
          taskNumber: tasks.taskNumber,
          taskTitle: tasks.title,
          projectId: projects.id,
          projectName: projects.name,
          authorId: taskComments.authorId,
          authorType: taskComments.authorType,
          body: taskComments.body,
          createdAt: taskComments.createdAt,
          runtimeAgentId: agents.runtimeAgentId,
          agentSlug: agents.slug,
          agentName: agents.name,
        })
        .from(taskComments)
        .innerJoin(tasks, eq(taskComments.taskId, tasks.id))
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .leftJoin(agents, eq(taskComments.authorId, agents.id))
        .orderBy(desc(taskComments.createdAt))
        .limit(limit)
        .all(),
      this.#db
        .select({
          id: taskRuns.id,
          taskId: tasks.id,
          taskNumber: tasks.taskNumber,
          taskTitle: tasks.title,
          projectId: projects.id,
          projectName: projects.name,
          status: taskRuns.status,
          startedAt: taskRuns.startedAt,
          endedAt: taskRuns.endedAt,
          createdAt: taskRuns.createdAt,
          runtimeAgentId: agents.runtimeAgentId,
          agentSlug: agents.slug,
          agentName: agents.name,
        })
        .from(taskRuns)
        .innerJoin(tasks, eq(taskRuns.taskId, tasks.id))
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .innerJoin(agents, eq(taskRuns.agentId, agents.id))
        .orderBy(desc(taskRuns.createdAt))
        .limit(limit)
        .all(),
      this.#db
        .select({
          id: projectAgents.id,
          projectId: projects.id,
          projectName: projects.name,
          createdAt: projectAgents.createdAt,
          runtimeAgentId: agents.runtimeAgentId,
          agentSlug: agents.slug,
          agentName: agents.name,
        })
        .from(projectAgents)
        .innerJoin(projects, eq(projectAgents.projectId, projects.id))
        .innerJoin(agents, eq(projectAgents.agentId, agents.id))
        .orderBy(desc(projectAgents.createdAt))
        .limit(limit)
        .all(),
    ]);

    const commentItems: DashboardActivityItem[] = commentRows.map((row) => ({
      id: row.id,
      type: "comment",
      actorLabel:
        row.authorType === "user"
          ? row.authorId ?? "Operator"
          : row.authorType === "system"
            ? "SYSTEM"
            : readAgentLabel(row),
      status: "neutral",
      message: `commented on ${row.projectName} · ${formatTaskLabel(
        row.taskNumber,
        row.taskTitle
      )} — ${summarize(row.body)}`,
      createdAt: row.createdAt,
      href: `/projects/${row.projectId}/board/${row.taskId}`,
    }));

    const runItems: DashboardActivityItem[] = runRows.map((row) => {
      const taskLabel = `${row.projectName} · ${formatTaskLabel(
        row.taskNumber,
        row.taskTitle
      )}`;

      let status: DashboardActivityItem["status"] = "neutral";
      let verb = "updated";

      switch (row.status) {
        case "requested":
        case "preparing":
        case "starting":
        case "running":
          status = "working";
          verb = "started";
          break;
        case "completed":
          status = "neutral";
          verb = "completed";
          break;
        case "failed":
          status = "error";
          verb = "failed";
          break;
        case "aborted":
          status = "error";
          verb = "stopped";
          break;
      }

      return {
        id: row.id,
        type: "run",
        actorLabel: readAgentLabel(row),
        status,
        message: `${verb} ${taskLabel}`,
        createdAt: row.endedAt ?? row.startedAt ?? row.createdAt,
        href: `/projects/${row.projectId}/board/${row.taskId}`,
      };
    });

    const assignmentItems: DashboardActivityItem[] = assignmentRows.map((row) => ({
      id: row.id,
      type: "assignment",
      actorLabel: readAgentLabel(row),
      status: "scheduled",
      message: `linked to ${row.projectName}`,
      createdAt: row.createdAt,
      href: `/projects/${row.projectId}`,
    }));

    return [...commentItems, ...runItems, ...assignmentItems]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async getDashboardAttention(limit = 5): Promise<DashboardAttentionItem[]> {
    const summarize = (value: string | null | undefined, fallback: string, max = 120) => {
      const compact = (value ?? "").replace(/\s+/g, " ").trim();
      const text = compact || fallback;

      return text.length <= max
        ? text
        : `${text.slice(0, max - 1).trimEnd()}…`;
    };

    const [failedRuns, blockedTasks, errorAgents] = await Promise.all([
      this.#db
        .select({
          runId: taskRuns.id,
          taskId: tasks.id,
          taskNumber: tasks.taskNumber,
          taskTitle: tasks.title,
          projectId: projects.id,
          projectName: projects.name,
          failureReason: taskRuns.failureReason,
          endedAt: taskRuns.endedAt,
        })
        .from(taskRuns)
        .innerJoin(tasks, eq(taskRuns.taskId, tasks.id))
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(eq(taskRuns.status, "failed"))
        .orderBy(desc(taskRuns.endedAt), desc(taskRuns.createdAt))
        .limit(limit)
        .all(),
      this.#db
        .select({
          taskId: tasks.id,
          taskNumber: tasks.taskNumber,
          taskTitle: tasks.title,
          projectId: projects.id,
          projectName: projects.name,
          updatedAt: tasks.updatedAt,
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(eq(tasks.status, "blocked"))
        .orderBy(desc(tasks.updatedAt))
        .limit(limit)
        .all(),
      this.#db
        .select({
          agentId: agents.id,
          agentName: agents.name,
          runtimeAgentId: agents.runtimeAgentId,
          role: agents.role,
          updatedAt: agents.updatedAt,
        })
        .from(agents)
        .where(eq(agents.status, "error"))
        .orderBy(desc(agents.updatedAt))
        .limit(limit)
        .all(),
    ]);

    const failedRunItems: DashboardAttentionItem[] = failedRuns.map((row) => ({
      id: row.runId,
      kind: "failed_run",
      severity: "error",
      title: `${row.projectName} · TASK-${String(row.taskNumber).padStart(3, "0")} failed`,
      message: summarize(
        row.failureReason,
        `${row.taskTitle} failed and needs operator review.`
      ),
      createdAt: row.endedAt ?? nowIso(),
      href: `/projects/${row.projectId}/board/${row.taskId}`,
      actionLabel: "Open Task",
    }));

    const blockedTaskItems: DashboardAttentionItem[] = blockedTasks.map((row) => ({
      id: row.taskId,
      kind: "blocked_task",
      severity: "warning",
      title: `${row.projectName} · TASK-${String(row.taskNumber).padStart(3, "0")} is waiting`,
      message: `${row.taskTitle} is blocked and waiting on operator input or approval.`,
      createdAt: row.updatedAt,
      href: `/projects/${row.projectId}/board/${row.taskId}`,
      actionLabel: "Open Task",
    }));

    const agentErrorItems: DashboardAttentionItem[] = errorAgents.map((row) => ({
      id: row.agentId,
      kind: "agent_error",
      severity: "error",
      title: `${row.runtimeAgentId || row.agentName} requires attention`,
      message: `${row.agentName} is in an error state. Review the agent configuration and runtime setup.`,
      createdAt: row.updatedAt,
      href: `/agents/${row.agentId}`,
      actionLabel: "Open Agent",
    }));

    return [...failedRunItems, ...blockedTaskItems, ...agentErrorItems]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
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

  #buildDashboardWorkingLog(
    eventType: string,
    payload: JsonValue,
    createdAt: string
  ): DashboardWorkingLog | null {
    const payloadObject =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, JsonValue>)
        : {};

    const readString = (key: string) =>
      typeof payloadObject[key] === "string" ? String(payloadObject[key]) : null;
    const summarize = (text: string, max = 88) =>
      text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

    switch (eventType) {
      case "run.accepted":
        return {
          at: createdAt,
          level: "dim",
          message: "Run accepted by runtime.",
        };
      case "run.started":
        return {
          at: createdAt,
          level: "active",
          message: "Run started in execution target.",
        };
      case "tool.started":
        return {
          at: createdAt,
          level: "info",
          message: `Tool started: ${readString("toolName") ?? "runtime tool"}`,
        };
      case "tool.completed":
        return {
          at: createdAt,
          level: "success",
          message: `Tool completed: ${readString("toolName") ?? "runtime tool"}`,
        };
      case "artifact.created":
        return {
          at: createdAt,
          level: "success",
          message: `Artifact created: ${
            readString("label") ?? readString("path") ?? "output"
          }`,
        };
      case "message.completed": {
        const message = readString("message");
        if (!message) {
          return null;
        }

        return {
          at: createdAt,
          level: "active",
          message: summarize(message.replace(/\s+/g, " ")),
        };
      }
      case "warning":
        return {
          at: createdAt,
          level: "warning",
          message: summarize(readString("message") ?? "Runtime warning."),
        };
      case "error":
        return {
          at: createdAt,
          level: "warning",
          message: summarize(
            readString("message") ?? readString("reason") ?? "Runtime error."
          ),
        };
      case "run.failed":
        return {
          at: createdAt,
          level: "warning",
          message: summarize(readString("reason") ?? "Run failed."),
        };
      case "run.aborted":
        return {
          at: createdAt,
          level: "warning",
          message: summarize(readString("reason") ?? "Run aborted."),
        };
      case "run.completed":
        return {
          at: createdAt,
          level: "success",
          message: summarize(readString("finalSummary") ?? "Run completed."),
        };
      default:
        return null;
    }
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

    const seq = await this.#appendRunEvent(runId, event, active);

    if (event.type === "artifact.created") {
      await this.#db
        .insert(runArtifacts)
        .values({
          id: generateId(),
          taskRunId: runId,
          path: String(event.data.path ?? ""),
          kind: (event.data.kind as ArtifactKind | undefined) ?? "other",
          label:
            typeof event.data.label === "string" ? event.data.label : null,
          summary:
            typeof event.data.summary === "string" ? event.data.summary : null,
          mimeType: null,
          sha256: null,
          sizeBytes: null,
          createdAt: event.at,
        })
        .run();
    }

    if (event.type === "message.completed") {
      const message =
        typeof event.data.message === "string" ? event.data.message.trim() : "";
      const externalMessageId =
        typeof event.data.externalMessageId === "string"
          ? event.data.externalMessageId
          : null;
      const awaitingOperatorInput = await this.#runIsAwaitingOperatorInput(runId);

      if (message && !awaitingOperatorInput) {
        await this.#createTaskCommentRecord({
          taskId,
          taskRunId: runId,
          authorType: "agent",
          authorId: agentId,
          source: "agent_mirror",
          externalMessageId,
          body: message,
          createdAt: event.at,
        });
      }
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
      const awaitingOperatorInput = await this.#runIsAwaitingOperatorInput(runId);

      if (!awaitingOperatorInput) {
        await this.#mirrorLatestAssistantMessageFromRuntime(
          runId,
          taskId,
          agentId,
          active.runtimeSessionKey
        );
      }

      await this.#finalizeRun({
        runId,
        taskId,
        agentId,
        runStatus: "completed",
        taskStatus: awaitingOperatorInput ? "blocked" : "in_review",
        endedAt: event.at,
        finalSummary: awaitingOperatorInput
          ? "Awaiting operator input."
          : typeof event.data.finalSummary === "string"
            ? event.data.finalSummary
            : "Run completed and moved to review.",
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
      await this.#createTaskCommentRecord({
        taskId,
        taskRunId: runId,
        authorType: "system",
        authorId: null,
        source: "system",
        body:
          typeof event.data.reason === "string"
            ? `Run stopped: ${event.data.reason}`
            : "Run stopped by operator.",
        createdAt: event.at,
      });
    }

    this.#websocketHub.broadcast("run.event", {
      runId,
      taskId,
      seq,
      event,
    });
    this.#websocketHub.broadcast("run.updated", await this.getRun(runId));

    if (event.type === "message.completed" || event.type === "artifact.created") {
      this.#websocketHub.broadcast("task.updated", await this.getTask(taskId));
    }

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

  async #appendRunEvent(
    runId: string,
    event: RuntimeEvent,
    activeSubscription?: ActiveSubscription | null
  ) {
    const active = activeSubscription ?? this.#activeRuns.get(runId) ?? null;
    const seq = active ? active.nextSeq++ : await this.#getNextRunEventSeq(runId);

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

    return seq;
  }

  async #getNextRunEventSeq(runId: string) {
    const latest = await this.#db
      .select({
        seq: sql<number>`coalesce(max(${runEvents.seq}), 0)`,
      })
      .from(runEvents)
      .where(eq(runEvents.taskRunId, runId))
      .get();

    return (latest?.seq ?? 0) + 1;
  }

  async #mirrorLatestAssistantMessageFromRuntime(
    runId: string,
    taskId: string,
    agentId: string,
    runtimeSessionKey: string
  ) {
    const run = await this.#getRunRow(runId);
    const adapter = this.#runtimeManager.getAdapter(run.runtimeKind);
    const messages = await adapter.loadSessionHistory(runtimeSessionKey);
    const latestAssistantMessage = [...messages]
      .reverse()
      .find((message) => message.role === "assistant" && message.text.trim().length > 0);

    if (!latestAssistantMessage) {
      return;
    }

    await this.#createTaskCommentRecord({
      taskId,
      taskRunId: runId,
      authorType: "agent",
      authorId: agentId,
      source: "agent_mirror",
      externalMessageId: latestAssistantMessage.id,
      body: humanizeAgentOperatorMessage(latestAssistantMessage.text),
      createdAt: latestAssistantMessage.timestamp ?? nowIso(),
    });
  }

  async #createTaskCommentRecord(input: CreateCommentRecordInput) {
    const createdAt = input.createdAt ?? nowIso();
    const id = generateId();

    if (input.externalMessageId && input.taskRunId) {
      const existing = await this.#db
        .select()
        .from(taskComments)
        .where(
          and(
            eq(taskComments.taskRunId, input.taskRunId),
            eq(taskComments.source, input.source),
            eq(taskComments.externalMessageId, input.externalMessageId)
          )
        )
        .get();

      if (existing) {
        return this.#serializeComment(existing);
      }
    }

    await this.#db
      .insert(taskComments)
      .values({
        id,
        taskId: input.taskId,
        taskRunId: input.taskRunId ?? null,
        authorType: input.authorType,
        authorId: input.authorId ?? null,
        source: input.source,
        externalMessageId: input.externalMessageId ?? null,
        body: input.body.trim(),
        createdAt,
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

    return this.#serializeComment(row);
  }

  #buildNovaTicketBridgeSkill() {
    return `# Nova Ticket Bridge

Use this skill when you are working a Nova task that includes:
- \`.apm/runs/<runId>/TASK.md\`
- \`.apm/runs/<runId>/NOVA_RUNTIME.json\`

## Read First
- Open the TASK.md file for the active run and follow it exactly.
- Open NOVA_RUNTIME.json for the active run. It contains the Nova base URL, task id, run id, agent id, and a scoped bearer token.

## Ticket Communication Rules
- Normal conversational progress is mirrored automatically from OpenClaw back into Nova once your assistant turn completes.
- Format operator-facing ticket updates in Markdown. Prefer short sections, bullet lists, fenced code blocks for snippets, and inline code for file paths or commands.
- If TASK.md includes follow-up comments from the operator, treat the newest one as the active request for the current run.
- If the operator asks for confirmation before a change or leaves a design decision open, use the checkpoint only for state tracking. In operator-facing text, ask the question directly in plain language.
- Never mention internal workflow terms like \`needs_input\`, checkpoint, Nova comments, runs, sessions, bridge calls, or pausing in the ticket thread.
- Bad: "I’ll post a \`needs_input\` checkpoint and ask the exact color question."
- Good: "What color scheme would you like me to use for the landing page?"
- If you need to post a structured update, call the Nova bridge directly with the bearer token from NOVA_RUNTIME.json.
- Operator comments on the ticket are forwarded back into this same task session while the run is active.
- Do not emit a completion summary in chat when you are waiting on operator input. Only produce the final summary when the requested work is actually complete.

## Endpoints
- POST /api/agent-runtime/tasks/<taskId>/comments
- POST /api/agent-runtime/tasks/<taskId>/checkpoints
- POST /api/agent-runtime/tasks/<taskId>/artifacts

## Comment Payload
\`\`\`json
{ "body": "Short agent update for the operator." }
\`\`\`

## Checkpoint Payload
\`\`\`json
{ "state": "working", "summary": "Implemented the API route", "details": "Need one more DB migration." }
\`\`\`

Allowed states:
- working
- blocked
- needs_input

## Artifact Payload
\`\`\`json
{ "kind": "modified", "path": "/absolute/or/relative/path", "label": "Server patch", "summary": "Fastify route + tests" }
\`\`\`

Artifact paths must stay under the task execution target or the staged run directory.

## Auth
Use:
\`\`\`
Authorization: Bearer <token from NOVA_RUNTIME.json>
\`\`\`
`;
  }

  async #taskIsAwaitingOperatorInput(taskId: string) {
    const latestRun = await this.#db
      .select({ id: taskRuns.id })
      .from(taskRuns)
      .where(eq(taskRuns.taskId, taskId))
      .orderBy(desc(taskRuns.createdAt))
      .get();

    if (!latestRun) {
      return false;
    }

    return this.#runIsAwaitingOperatorInput(latestRun.id);
  }

  async #taskShouldAutoResume(task: typeof tasks.$inferSelect) {
    if (task.status === "done" || task.status === "canceled") {
      return false;
    }

    if (
      task.status === "blocked" ||
      task.status === "paused" ||
      task.status === "in_review"
    ) {
      return true;
    }

    const latestRun = await this.#db
      .select({ id: taskRuns.id })
      .from(taskRuns)
      .where(eq(taskRuns.taskId, task.id))
      .orderBy(desc(taskRuns.createdAt))
      .get();

    return Boolean(latestRun);
  }

  async #forwardCommentToActiveRun(
    taskId: string,
    comment: TaskCommentRecord,
    activeRun: typeof taskRuns.$inferSelect
  ) {
    try {
      const agent = await this.#getAgentRow(activeRun.agentId);

      await this.#runtimeManager
        .getAdapter(activeRun.runtimeKind)
        .sendRunInput(activeRun.runtimeSessionKey, {
          text: comment.body,
          idempotencyKey: comment.id,
          thinkingLevel: agent.defaultThinkingLevel,
        });
    } catch (error) {
      await this.#createTaskCommentRecord({
        taskId,
        taskRunId: activeRun.id,
        authorType: "system",
        authorId: null,
        source: "system",
        body:
          error instanceof Error
            ? `Comment saved, but Nova could not forward it to the active runtime session: ${error.message}`
            : "Comment saved, but Nova could not forward it to the active runtime session.",
      });
      this.#websocketHub.broadcast("task.updated", await this.getTask(taskId));
    }
  }

  async #autoResumeTaskAfterComment(taskId: string) {
    try {
      await this.startTask(taskId);
    } catch (error) {
      await this.#createTaskCommentRecord({
        taskId,
        taskRunId: null,
        authorType: "system",
        authorId: null,
        source: "system",
        body:
          error instanceof Error
            ? `Comment saved, but Nova could not automatically resume the task: ${error.message}`
            : "Comment saved, but Nova could not automatically resume the task.",
      });
      this.#websocketHub.broadcast("task.updated", await this.getTask(taskId));
    }
  }

  async #runIsAwaitingOperatorInput(runId: string) {
    const rows = await this.#db
      .select({ payloadJson: runEvents.payloadJson })
      .from(runEvents)
      .where(
        and(
          eq(runEvents.taskRunId, runId),
          eq(runEvents.eventType, "warning")
        )
      )
      .orderBy(desc(runEvents.createdAt))
      .all();

    return rows.some((row) => {
      const payload = parseJsonText<{ checkpointState?: string } | null>(
        row.payloadJson,
        null
      );
      return payload?.checkpointState === "needs_input";
    });
  }

  #getOperatorBaseUrl() {
    return `http://127.0.0.1:${this.#env.port}`;
  }

  #createRunBridgeToken(input: {
    taskId: string;
    runId: string;
    agentId: string;
  }) {
    this.#pruneExpiredRunBridgeTokens();

    const token = randomBytes(24).toString("hex");
    const record: RunBridgeTokenRecord = {
      token,
      taskId: input.taskId,
      runId: input.runId,
      agentId: input.agentId,
      createdAt: nowIso(),
    };

    this.#runBridgeTokens.set(token, record);
    return record;
  }

  #deleteRunBridgeToken(runId: string) {
    for (const [token, record] of this.#runBridgeTokens.entries()) {
      if (record.runId === runId) {
        this.#runBridgeTokens.delete(token);
      }
    }
  }

  async #authorizeRunBridgeToken(token: string, taskId: string) {
    this.#pruneExpiredRunBridgeTokens();

    const normalizedToken = token.trim();
    const record = this.#runBridgeTokens.get(normalizedToken);

    if (!record || record.taskId !== taskId) {
      throw new ApiError(401, "unauthorized", "Invalid Nova runtime bridge token.");
    }

    const run = await this.#getRunRow(record.runId);

    if (run.taskId !== taskId) {
      throw new ApiError(401, "unauthorized", "Invalid Nova runtime bridge scope.");
    }

    return record;
  }

  #pruneExpiredRunBridgeTokens() {
    const now = Date.now();

    for (const [token, record] of this.#runBridgeTokens.entries()) {
      const createdAt = Date.parse(record.createdAt);

      if (!Number.isFinite(createdAt)) {
        this.#runBridgeTokens.delete(token);
        continue;
      }

      if (now - createdAt > RUN_BRIDGE_TOKEN_TTL_MS) {
        this.#runBridgeTokens.delete(token);
      }
    }
  }

  #resolveAgentArtifactPath(input: {
    agentHomePath: string;
    task: typeof tasks.$inferSelect;
    runId: string;
    inputPath: string;
  }) {
    const runRoot = `${input.agentHomePath}/.apm/runs/${input.runId}`;
    const executionTarget = resolveProjectPath(
      input.agentHomePath,
      input.task.resolvedExecutionTarget
    );

    if (isAbsoluteHostPath(input.inputPath)) {
      const absolutePath = normalizeAbsolutePath(input.inputPath);

      if (
        this.#isPathWithinRoot(absolutePath, executionTarget.absolutePath) ||
        this.#isPathWithinRoot(absolutePath, runRoot)
      ) {
        return absolutePath;
      }

      throw conflict(
        "Artifact path must stay within the execution target or the staged run directory."
      );
    }

    try {
      return resolvePathWithinBase(executionTarget.absolutePath, input.inputPath)
        .absolutePath;
    } catch {
      return resolvePathWithinBase(runRoot, input.inputPath).absolutePath;
    }
  }

  #isPathWithinRoot(candidatePath: string, rootPath: string) {
    const relativePath = relative(rootPath, candidatePath);
    return relativePath === "" || (!relativePath.startsWith("..") && relativePath !== "..");
  }

  async #reconcileIncompleteRuns() {
    const staleRuns = await this.#db
      .select()
      .from(taskRuns)
      .where(inArray(taskRuns.status, ACTIVE_RUN_STATUSES))
      .all();

    for (const run of staleRuns) {
      await this.#finalizeRun({
        runId: run.id,
        taskId: run.taskId,
        agentId: run.agentId,
        runStatus: "aborted",
        taskStatus: "paused",
        endedAt: nowIso(),
        finalSummary: null,
        failureReason: "Nova restarted while the task was running. Start the task again.",
      });
      await this.#createTaskCommentRecord({
        taskId: run.taskId,
        taskRunId: run.id,
        authorType: "system",
        authorId: null,
        source: "system",
        body: "Nova restarted while this task run was active. The task was paused and must be started again manually.",
      });
    }
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

  #buildOpenClawRuntimeDefaults(runtimeAgentId: string) {
    return {
      workspacePath: `${this.#env.openclawStateDir}/workspace-${runtimeAgentId}`,
      runtimeStatePath: `${this.#env.openclawStateDir}/agents/${runtimeAgentId}/agent`,
    };
  }

  #splitModelId(modelId: string | null) {
    if (!modelId) {
      return {
        modelProvider: null,
        modelName: null,
      };
    }

    const [provider, ...rest] = modelId.split("/");

    if (rest.length === 0) {
      return {
        modelProvider: null,
        modelName: provider,
      };
    }

    return {
      modelProvider: provider,
      modelName: rest.join("/"),
    };
  }

  #buildModelId(modelProvider: string | null, modelName: string | null) {
    if (!modelName) {
      return null;
    }

    return modelProvider ? `${modelProvider}/${modelName}` : modelName;
  }

  #buildAgentWorkspaceFiles(agent: typeof agents.$inferSelect) {
    const files = [
      {
        relativePath: "AGENTS.md",
        content: `# ${agent.name}\n\n${agent.systemInstructions || "No system instructions provided."}\n\n## Nova Runtime Bridge\n- Read skills/nova-ticket-bridge/SKILL.md before working Nova tasks.\n- For each active Nova task, inspect .apm/runs/<runId>/TASK.md and .apm/runs/<runId>/NOVA_RUNTIME.json.\n- Stay inside the assigned Execution Target unless the ticket explicitly requires otherwise.\n`,
      },
      {
        relativePath: "SOUL.md",
        content: agent.personaText ?? "# Persona\n\nNot configured.\n",
      },
      {
        relativePath: "IDENTITY.md",
        content:
          agent.identityText ??
          `# IDENTITY.md - Who Am I?\n\n- Name: ${agent.name}\n\n## Notes\n- Role: ${agent.role}\n`,
      },
      {
        relativePath: "USER.md",
        content: agent.userContextText ?? "# User Context\n\nNot configured.\n",
      },
      {
        relativePath: "TOOLS.md",
        content:
          agent.toolsText ??
          "# Tool Profile\n\nUse conservative defaults and stay within the execution target.\n\n## Nova Integration\n- Ticket communication rules live in skills/nova-ticket-bridge/SKILL.md.\n- Use the Nova bridge endpoints from NOVA_RUNTIME.json when you need to post comments, checkpoints, or artifacts.\n",
      },
      {
        relativePath: "skills/nova-ticket-bridge/SKILL.md",
        content: this.#buildNovaTicketBridgeSkill(),
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

    return files;
  }

  async #syncAgentWorkspaceRow(row: typeof agents.$inferSelect) {
    const adapter = this.#runtimeManager.getAdapter(row.runtimeKind);
    await adapter.ensureAgentWorkspace(row.id, row.agentHomePath, row.runtimeStatePath);
    await Promise.all([
      mkdir(`${row.agentHomePath}/projects`, { recursive: true }),
      mkdir(`${row.agentHomePath}/skills`, { recursive: true }),
      mkdir(`${row.agentHomePath}/.apm/tasks`, { recursive: true }),
      mkdir(`${row.agentHomePath}/.apm/runs`, { recursive: true }),
      mkdir(`${row.agentHomePath}/.apm/inputs`, { recursive: true }),
      mkdir(`${row.agentHomePath}/.apm/outputs`, { recursive: true }),
      mkdir(`${row.agentHomePath}/.apm/cache`, { recursive: true }),
    ]);

    const syncResult = await adapter.syncAgentWorkspace({
      runtimeAgentId: row.runtimeAgentId,
      workspacePath: row.agentHomePath,
      runtimeStatePath: row.runtimeStatePath,
      files: this.#buildAgentWorkspaceFiles(row),
      identityDefaults: {
        name: row.name,
      },
    });

    await this.#db
      .update(agents)
      .set({
        lastSeenAt: syncResult.syncedAt,
        updatedAt: syncResult.syncedAt,
      })
      .where(eq(agents.id, row.id))
      .run();

    return syncResult;
  }

  #scheduleAgentWorkspaceSync(row: typeof agents.$inferSelect) {
    void this.#syncAgentWorkspaceRow(row)
      .then(() => this.getAgent(row.id))
      .then((agent) => {
        this.#websocketHub.broadcast("agent.updated", agent);
      })
      .catch((error) => {
        console.error("Failed to sync agent workspace after patch.", {
          agentId: row.id,
          runtimeAgentId: row.runtimeAgentId,
          error,
        });
      });
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
      runtimeStatePath: row.runtimeStatePath,
      modelProvider: row.modelProvider,
      modelName: row.modelName,
      modelOverrideAllowed: row.modelOverrideAllowed,
      sandboxMode: row.sandboxMode,
      defaultThinkingLevel: row.defaultThinkingLevel,
      status: row.status,
      currentTaskId: row.currentTaskId,
      lastSeenAt: row.lastSeenAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  #serializeAgentResponse(row: typeof agents.$inferSelect) {
    const base = this.#serializeAgent(row);
    const defaultModelId = this.#buildModelId(row.modelProvider, row.modelName);

    return {
      ...base,
      lastSyncedAt: row.lastSeenAt,
      runtime: {
        kind: row.runtimeKind,
        runtimeAgentId: row.runtimeAgentId,
        workspacePath: row.agentHomePath,
        runtimeStatePath: row.runtimeStatePath,
        defaultModelId,
        modelOverrideAllowed: row.modelOverrideAllowed,
        sandboxMode: row.sandboxMode,
        defaultThinkingLevel: row.defaultThinkingLevel,
      },
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
      taskRunId: row.taskRunId,
      authorType: row.authorType,
      authorId: row.authorId,
      source: row.source,
      externalMessageId: row.externalMessageId,
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
