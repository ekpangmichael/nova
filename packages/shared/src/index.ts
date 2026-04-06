export const APP_NAME = "Nova";

export const WORKSPACE_LAYOUT = {
  web: "apps/web",
  server: "apps/server",
  shared: "packages/shared",
  db: "packages/db",
  runtimeAdapter: "packages/runtime-adapter",
  ui: "packages/ui",
} as const;

export const PROJECT_STATUSES = ["active", "paused", "archived"] as const;
export const AGENT_STATUSES = [
  "idle",
  "working",
  "paused",
  "error",
  "offline",
] as const;
export const TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "failed",
  "blocked",
  "paused",
  "canceled",
] as const;
export const RUN_STATUSES = [
  "requested",
  "preparing",
  "starting",
  "running",
  "completed",
  "failed",
  "aborted",
] as const;
export const TASK_PRIORITIES = [
  "critical",
  "high",
  "medium",
  "low",
] as const;
export const PROJECT_SEED_TYPES = ["none", "git"] as const;
export const SANDBOX_MODES = ["off", "docker", "other"] as const;
export const RUNTIME_KINDS = [
  "openclaw-native",
  "openclaw-acp",
  "claude-code",
  "codex",
  "custom",
] as const;
export const THINKING_LEVELS = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;
export const COMMENT_AUTHOR_TYPES = ["user", "agent", "system"] as const;
export const TASK_COMMENT_SOURCES = [
  "ticket_user",
  "agent_mirror",
  "agent_api",
  "system",
] as const;
export const ARTIFACT_KINDS = ["input", "output", "modified", "other"] as const;
export const RUNTIME_HEALTH_STATES = [
  "missing_binary",
  "starting",
  "healthy",
  "degraded",
  "error",
] as const;
export const WEBSOCKET_EVENT_TYPES = [
  "project.updated",
  "task.created",
  "task.updated",
  "run.created",
  "run.updated",
  "run.event",
  "agent.updated",
  "runtime.health",
] as const;
export const MAX_TASK_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const TASK_ATTACHMENT_ALLOWED_EXTENSIONS = [
  "pdf",
  "json",
  "jsonc",
  "md",
  "markdown",
  "txt",
  "text",
  "html",
  "htm",
  "css",
  "scss",
  "less",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "py",
  "rb",
  "php",
  "java",
  "c",
  "cc",
  "cpp",
  "cxx",
  "h",
  "hpp",
  "go",
  "rs",
  "swift",
  "kt",
  "kts",
  "sh",
  "bash",
  "zsh",
  "yaml",
  "yml",
  "xml",
  "csv",
  "sql",
  "toml",
  "ini",
  "cfg",
  "conf",
  "log",
  "doc",
  "docx",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
] as const;

export const TASK_ATTACHMENT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/json",
  "application/ld+json",
  "application/xml",
  "text/plain",
  "text/markdown",
  "text/html",
  "text/css",
  "text/javascript",
  "application/javascript",
  "application/x-javascript",
  "text/x-python",
  "application/x-python-code",
  "text/x-java-source",
  "text/x-c",
  "text/x-c++",
  "text/x-go",
  "text/x-rustsrc",
  "text/x-swift",
  "text/x-kotlin",
  "text/x-script.python",
  "text/yaml",
  "application/yaml",
  "text/xml",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
] as const;

export const TASK_ATTACHMENT_ACCEPT_ATTR = TASK_ATTACHMENT_ALLOWED_EXTENSIONS.map(
  (extension) => `.${extension}`
).join(",");

const TASK_ATTACHMENT_EXTENSION_SET = new Set<string>(
  TASK_ATTACHMENT_ALLOWED_EXTENSIONS
);
const TASK_ATTACHMENT_MIME_SET = new Set<string>(TASK_ATTACHMENT_ALLOWED_MIME_TYPES);

export const getTaskAttachmentExtension = (fileName: string) => {
  const normalized = fileName.trim().toLowerCase();
  const lastDot = normalized.lastIndexOf(".");

  if (lastDot <= 0 || lastDot === normalized.length - 1) {
    return "";
  }

  return normalized.slice(lastDot + 1);
};

export const isAllowedTaskAttachment = (input: {
  fileName: string;
  mimeType?: string | null;
}) => {
  const extension = getTaskAttachmentExtension(input.fileName);
  const normalizedMime = (input.mimeType ?? "").trim().toLowerCase();

  if (extension && TASK_ATTACHMENT_EXTENSION_SET.has(extension)) {
    return true;
  }

  return normalizedMime ? TASK_ATTACHMENT_MIME_SET.has(normalizedMime) : false;
};

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type AgentStatus = (typeof AGENT_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type RunStatus = (typeof RUN_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type ProjectSeedType = (typeof PROJECT_SEED_TYPES)[number];
export type SandboxMode = (typeof SANDBOX_MODES)[number];
export type RuntimeKind = (typeof RUNTIME_KINDS)[number];
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];
export type CommentAuthorType = (typeof COMMENT_AUTHOR_TYPES)[number];
export type TaskCommentSource = (typeof TASK_COMMENT_SOURCES)[number];
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];
export type RuntimeHealthState = (typeof RUNTIME_HEALTH_STATES)[number];
export type WebsocketEventType = (typeof WEBSOCKET_EVENT_TYPES)[number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type SettingsRecord = {
  id: string;
  mode: "local";
  openclawProfile: string;
  openclawBinaryPath: string;
  codexBinaryPath: string;
  codexConfigPath: string;
  codexStateDir: string;
  codexDefaultModel: string | null;
  claudeBinaryPath: string;
  claudeConfigPath: string;
  claudeStateDir: string;
  claudeDefaultModel: string | null;
  gatewayUrl: string | null;
  gatewayAuthMode: string;
  gatewayTokenEncrypted: string | null;
  appDataDir: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: ProjectStatus;
  projectRoot: string;
  seedType: ProjectSeedType;
  seedUrl: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type AgentRecord = {
  id: string;
  slug: string;
  name: string;
  avatar: string | null;
  role: string;
  systemInstructions: string;
  personaText: string | null;
  userContextText: string | null;
  identityText: string | null;
  toolsText: string | null;
  heartbeatText: string | null;
  memoryText: string | null;
  runtimeKind: RuntimeKind;
  runtimeAgentId: string;
  agentHomePath: string;
  runtimeStatePath: string;
  modelProvider: string | null;
  modelName: string | null;
  modelOverrideAllowed: boolean;
  sandboxMode: SandboxMode;
  defaultThinkingLevel: ThinkingLevel;
  status: AgentStatus;
  currentTaskId: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskRecord = {
  id: string;
  taskNumber: number;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAgentId: string;
  handoffAgentId: string | null;
  executionTargetOverride: string | null;
  resolvedExecutionTarget: string;
  gitRepoRoot: string | null;
  gitBranchName: string | null;
  gitBranchUrl: string | null;
  dueAt: string | null;
  estimatedMinutes: number | null;
  labels: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskCommentRecord = {
  id: string;
  taskId: string;
  taskRunId: string | null;
  authorType: CommentAuthorType;
  authorId: string | null;
  authorLabel: string | null;
  source: TaskCommentSource;
  externalMessageId: string | null;
  body: string;
  attachments: TaskCommentAttachmentRecord[];
  createdAt: string;
};

export type TaskAttachmentRecord = {
  id: string;
  taskId: string;
  fileName: string;
  mimeType: string;
  relativeStoragePath: string;
  sha256: string;
  sizeBytes: number;
  createdAt: string;
};

export type TaskCommentAttachmentRecord = {
  id: string;
  taskId: string;
  taskCommentId: string;
  fileName: string;
  mimeType: string;
  relativeStoragePath: string;
  sha256: string;
  sizeBytes: number;
  createdAt: string;
};

export type TaskRunRecord = {
  id: string;
  taskId: string;
  attemptNumber: number;
  agentId: string;
  runtimeKind: RuntimeKind;
  runtimeSessionKey: string;
  runtimeRunId: string | null;
  status: RunStatus;
  startedAt: string | null;
  endedAt: string | null;
  failureReason: string | null;
  finalSummary: string | null;
  usage: JsonValue | null;
  createdAt: string;
  updatedAt: string;
};

export type RunEventRecord = {
  id: string;
  taskRunId: string;
  seq: number;
  eventType: string;
  payload: JsonValue;
  createdAt: string;
};

export type RunArtifactRecord = {
  id: string;
  taskRunId: string;
  path: string;
  kind: ArtifactKind;
  label: string | null;
  summary: string | null;
  mimeType: string | null;
  sha256: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

export type ProjectActivityItem = {
  id: string;
  projectId: string;
  type: "comment" | "run" | "assignment";
  title: string;
  message: string;
  createdAt: string;
};

export type RuntimeHealth = {
  status: RuntimeHealthState;
  mode: "mock" | "openclaw" | "codex" | "claude";
  profile: string;
  gatewayUrl: string | null;
  binaryPath: string;
  binaryVersion: string | null;
  configPath?: string | null;
  stateDir?: string | null;
  details: string[];
  updatedAt: string;
};

export type MonitorSummary = {
  runtimeHealth: RuntimeHealth;
  totalProjectCount: number;
  activeProjectCount: number;
  totalAgentCount: number;
  activeAgentCount: number;
  activeRunCount: number;
  openTaskCount: number;
  recentFailureCount: number;
  completedThisWeekCount: number;
  agentCounts: {
    idle: number;
    working: number;
    paused: number;
    error: number;
    offline: number;
  };
};

export type DashboardStats = {
  totalProjectCount: number;
  activeProjectCount: number;
  totalAgentCount: number;
  activeAgentCount: number;
  openTaskCount: number;
  completedThisWeekCount: number;
};

export type DashboardWorkingLog = {
  at: string;
  message: string;
  level: "info" | "success" | "warning" | "active" | "dim";
};

export type DashboardWorkingRun = {
  runId: string;
  taskId: string;
  taskNumber: number;
  taskTitle: string;
  projectId: string;
  projectName: string;
  agentId: string;
  agentName: string;
  agentSlug: string;
  runtimeAgentId: string;
  status: RunStatus;
  startedAt: string | null;
  lastEventAt: string | null;
  resolvedExecutionTarget: string;
  logs: DashboardWorkingLog[];
};

export type DashboardActivityItem = {
  id: string;
  type: "run" | "comment" | "assignment";
  actorLabel: string;
  status: "working" | "idle" | "error" | "scheduled" | "neutral";
  message: string;
  createdAt: string;
  href: string | null;
};

export type DashboardAttentionItem = {
  id: string;
  kind: "failed_run" | "blocked_task" | "agent_error";
  severity: "error" | "warning";
  title: string;
  message: string;
  createdAt: string;
  href: string | null;
  actionLabel: string;
};

export type ActiveRunView = {
  runId: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  agentId: string;
  agentName: string;
  status: RunStatus;
  startedAt: string | null;
  lastEventAt: string | null;
  resolvedExecutionTarget: string;
};

export type RecentFailureView = {
  runId: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  agentId: string;
  agentName: string;
  failureReason: string | null;
  endedAt: string | null;
};

export type WebsocketEnvelope<TPayload extends JsonValue | Record<string, unknown>> = {
  type: WebsocketEventType;
  payload: TPayload;
  sentAt: string;
};
