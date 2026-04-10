import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type {
  AgentStatus,
  ArtifactKind,
  CommentAuthorType,
  ProjectSeedType,
  ProjectStatus,
  RuntimeKind,
  RunStatus,
  SandboxMode,
  TaskCommentSource,
  TaskPriority,
  TaskStatus,
  ThinkingLevel,
} from "@nova/shared";

const requiredText = (name: string) => text(name).notNull();
const createdAtColumn = () => text("created_at").notNull();
const updatedAtColumn = () => text("updated_at").notNull();

export const settings = sqliteTable("settings", {
  id: requiredText("id").primaryKey(),
  mode: requiredText("mode").$type<"local">(),
  runtimeMode: requiredText("runtime_mode").$type<"mock" | "openclaw">(),
  openclawEnabled: integer("openclaw_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  openclawProfile: requiredText("openclaw_profile"),
  openclawBinaryPath: requiredText("openclaw_binary_path"),
  openclawConfigPath: requiredText("openclaw_config_path"),
  openclawStateDir: requiredText("openclaw_state_dir"),
  codexEnabled: integer("codex_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  codexBinaryPath: requiredText("codex_binary_path"),
  codexConfigPath: requiredText("codex_config_path"),
  codexStateDir: requiredText("codex_state_dir"),
  codexDefaultModel: text("codex_default_model"),
  claudeEnabled: integer("claude_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  claudeBinaryPath: requiredText("claude_binary_path"),
  claudeConfigPath: requiredText("claude_config_path"),
  claudeStateDir: requiredText("claude_state_dir"),
  claudeDefaultModel: text("claude_default_model"),
  gatewayUrl: text("gateway_url"),
  gatewayAuthMode: requiredText("gateway_auth_mode"),
  gatewayTokenEncrypted: text("gateway_token_encrypted"),
  appDataDir: requiredText("app_data_dir"),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

export const users = sqliteTable(
  "users",
  {
    id: requiredText("id").primaryKey(),
    email: requiredText("email"),
    displayName: requiredText("display_name"),
    passwordHash: requiredText("password_hash"),
    googleSub: text("google_sub"),
    lastSignedInAt: text("last_signed_in_at"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
    googleSubUnique: uniqueIndex("users_google_sub_unique").on(table.googleSub),
  })
);

export const userSessions = sqliteTable(
  "user_sessions",
  {
    id: requiredText("id").primaryKey(),
    userId: requiredText("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    sessionTokenHash: requiredText("session_token_hash"),
    expiresAt: requiredText("expires_at"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    tokenUnique: uniqueIndex("user_sessions_token_hash_unique").on(
      table.sessionTokenHash
    ),
    userExpiryIndex: index("user_sessions_user_expiry_idx").on(
      table.userId,
      table.expiresAt
    ),
  })
);

export const projects = sqliteTable(
  "projects",
  {
    id: requiredText("id").primaryKey(),
    slug: requiredText("slug"),
    name: requiredText("name"),
    description: requiredText("description"),
    status: requiredText("status").$type<ProjectStatus>(),
    projectRoot: requiredText("project_root"),
    seedType: requiredText("seed_type").$type<ProjectSeedType>(),
    seedUrl: text("seed_url"),
    tagsJson: text("tags_json"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    slugUnique: uniqueIndex("projects_slug_unique").on(table.slug),
  })
);

export const agents = sqliteTable(
  "agents",
  {
    id: requiredText("id").primaryKey(),
    slug: requiredText("slug"),
    name: requiredText("name"),
    avatar: text("avatar"),
    role: requiredText("role"),
    systemInstructions: requiredText("system_instructions"),
    personaText: text("persona_text"),
    userContextText: text("user_context_text"),
    identityText: text("identity_text"),
    toolsText: text("tools_text"),
    heartbeatText: text("heartbeat_text"),
    memoryText: text("memory_text"),
    runtimeKind: requiredText("runtime_kind").$type<RuntimeKind>(),
    runtimeAgentId: requiredText("runtime_agent_id"),
    agentHomePath: requiredText("agent_home_path"),
    runtimeStatePath: requiredText("runtime_state_path"),
    modelProvider: text("model_provider"),
    modelName: text("model_name"),
    modelOverrideAllowed: integer("model_override_allowed", {
      mode: "boolean",
    })
      .notNull()
      .default(true),
    sandboxMode: requiredText("sandbox_mode").$type<SandboxMode>(),
    defaultThinkingLevel: requiredText("default_thinking_level").$type<ThinkingLevel>(),
    status: requiredText("status").$type<AgentStatus>(),
    currentTaskId: text("current_task_id"),
    lastSeenAt: text("last_seen_at"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    slugUnique: uniqueIndex("agents_slug_unique").on(table.slug),
    runtimeAgentIdUnique: uniqueIndex("agents_runtime_runtime_agent_id_unique").on(
      table.runtimeKind,
      table.runtimeAgentId
    ),
  })
);

export const projectAgents = sqliteTable(
  "project_agents",
  {
    id: requiredText("id").primaryKey(),
    projectId: requiredText("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    agentId: requiredText("agent_id").references(() => agents.id, {
      onDelete: "cascade",
    }),
    createdAt: createdAtColumn(),
  },
  (table) => ({
    uniqueProjectAgent: uniqueIndex("project_agents_project_agent_unique").on(
      table.projectId,
      table.agentId
    ),
  })
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: requiredText("id").primaryKey(),
    taskNumber: integer("task_number").notNull(),
    projectId: requiredText("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    title: requiredText("title"),
    description: requiredText("description"),
    status: requiredText("status").$type<TaskStatus>(),
    priority: requiredText("priority").$type<TaskPriority>(),
    assignedAgentId: requiredText("assigned_agent_id").references(() => agents.id, {
      onDelete: "restrict",
    }),
    handoffAgentId: text("handoff_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    executionTargetOverride: text("execution_target_override"),
    resolvedExecutionTarget: requiredText("resolved_execution_target"),
    useGitWorktree: integer("use_git_worktree", { mode: "boolean" })
      .notNull()
      .default(false),
    gitRepoRoot: text("git_repo_root"),
    gitBranchName: text("git_branch_name"),
    gitBranchUrl: text("git_branch_url"),
    gitWorktreePath: text("git_worktree_path"),
    dueAt: text("due_at"),
    estimatedMinutes: integer("estimated_minutes"),
    labelsJson: text("labels_json"),
    createdBy: requiredText("created_by"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    projectStatusIndex: index("tasks_project_status_idx").on(
      table.projectId,
      table.status
    ),
    agentStatusIndex: index("tasks_agent_status_idx").on(
      table.assignedAgentId,
      table.status
    ),
  })
);

export const taskDependencies = sqliteTable(
  "task_dependencies",
  {
    id: requiredText("id").primaryKey(),
    taskId: requiredText("task_id").references(() => tasks.id, {
      onDelete: "cascade",
    }),
    dependsOnTaskId: requiredText("depends_on_task_id").references(
      () => tasks.id,
      {
        onDelete: "cascade",
      }
    ),
    createdAt: createdAtColumn(),
  },
  (table) => ({
    uniqueTaskDependency: uniqueIndex("task_dependencies_unique").on(
      table.taskId,
      table.dependsOnTaskId
    ),
  })
);

export const taskComments = sqliteTable("task_comments", {
  id: requiredText("id").primaryKey(),
  taskId: requiredText("task_id").references(() => tasks.id, {
    onDelete: "cascade",
  }),
  taskRunId: text("task_run_id").references(() => taskRuns.id, {
    onDelete: "set null",
  }),
  authorType: requiredText("author_type").$type<CommentAuthorType>(),
  authorId: text("author_id"),
  source: requiredText("source").$type<TaskCommentSource>(),
  externalMessageId: text("external_message_id"),
  body: requiredText("body"),
  createdAt: createdAtColumn(),
}, (table) => ({
  taskCreatedIndex: index("task_comments_task_created_idx").on(
    table.taskId,
    table.createdAt
  ),
  externalMessageUnique: uniqueIndex("task_comments_run_source_external_unique").on(
    table.taskRunId,
    table.source,
    table.externalMessageId
  ),
}));

export const taskAttachments = sqliteTable("task_attachments", {
  id: requiredText("id").primaryKey(),
  taskId: requiredText("task_id").references(() => tasks.id, {
    onDelete: "cascade",
  }),
  fileName: requiredText("file_name"),
  mimeType: requiredText("mime_type"),
  relativeStoragePath: requiredText("relative_storage_path"),
  sha256: requiredText("sha256"),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: createdAtColumn(),
});

export const taskCommentAttachments = sqliteTable(
  "task_comment_attachments",
  {
    id: requiredText("id").primaryKey(),
    taskId: requiredText("task_id").references(() => tasks.id, {
      onDelete: "cascade",
    }),
    taskCommentId: requiredText("task_comment_id").references(() => taskComments.id, {
      onDelete: "cascade",
    }),
    fileName: requiredText("file_name"),
    mimeType: requiredText("mime_type"),
    relativeStoragePath: requiredText("relative_storage_path"),
    sha256: requiredText("sha256"),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => ({
    commentCreatedIndex: index("task_comment_attachments_comment_created_idx").on(
      table.taskCommentId,
      table.createdAt
    ),
  })
);

export const taskRuns = sqliteTable(
  "task_runs",
  {
    id: requiredText("id").primaryKey(),
    taskId: requiredText("task_id").references(() => tasks.id, {
      onDelete: "cascade",
    }),
    attemptNumber: integer("attempt_number").notNull(),
    agentId: requiredText("agent_id").references(() => agents.id, {
      onDelete: "restrict",
    }),
    runtimeKind: requiredText("runtime_kind").$type<RuntimeKind>(),
    runtimeSessionKey: requiredText("runtime_session_key"),
    runtimeRunId: text("runtime_run_id"),
    status: requiredText("status").$type<RunStatus>(),
    startedAt: text("started_at"),
    endedAt: text("ended_at"),
    failureReason: text("failure_reason"),
    finalSummary: text("final_summary"),
    usageJson: text("usage_json"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    taskCreatedIndex: index("task_runs_task_created_idx").on(
      table.taskId,
      table.createdAt
    ),
    agentStatusIndex: index("task_runs_agent_status_idx").on(
      table.agentId,
      table.status
    ),
  })
);

export const runEvents = sqliteTable(
  "run_events",
  {
    id: requiredText("id").primaryKey(),
    taskRunId: requiredText("task_run_id").references(() => taskRuns.id, {
      onDelete: "cascade",
    }),
    seq: integer("seq").notNull(),
    eventType: requiredText("event_type"),
    payloadJson: requiredText("payload_json"),
    createdAt: createdAtColumn(),
  },
  (table) => ({
    uniqueRunSeq: uniqueIndex("run_events_run_seq_unique").on(
      table.taskRunId,
      table.seq
    ),
  })
);

export const runArtifacts = sqliteTable("run_artifacts", {
  id: requiredText("id").primaryKey(),
  taskRunId: requiredText("task_run_id").references(() => taskRuns.id, {
    onDelete: "cascade",
  }),
  path: requiredText("path"),
  kind: requiredText("kind").$type<ArtifactKind>(),
  label: text("label"),
  summary: text("summary"),
  mimeType: text("mime_type"),
  sha256: text("sha256"),
  sizeBytes: integer("size_bytes"),
  createdAt: createdAtColumn(),
});

export const schema = {
  settings,
  users,
  userSessions,
  projects,
  agents,
  projectAgents,
  tasks,
  taskDependencies,
  taskComments,
  taskAttachments,
  taskCommentAttachments,
  taskRuns,
  runEvents,
  runArtifacts,
};

export const schemaTables = Object.values(schema);
export const nowSql = sql`CURRENT_TIMESTAMP`;
