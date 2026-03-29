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
export const COMMENT_AUTHOR_TYPES = ["user", "agent", "system"] as const;
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

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type AgentStatus = (typeof AGENT_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type RunStatus = (typeof RUN_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type ProjectSeedType = (typeof PROJECT_SEED_TYPES)[number];
export type SandboxMode = (typeof SANDBOX_MODES)[number];
export type CommentAuthorType = (typeof COMMENT_AUTHOR_TYPES)[number];
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
  runtimeKind: "openclaw-native";
  runtimeAgentId: string;
  agentHomePath: string;
  modelProvider: string | null;
  modelName: string | null;
  modelOverrideAllowed: boolean;
  sandboxMode: SandboxMode;
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
  executionTargetOverride: string | null;
  resolvedExecutionTarget: string;
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
  authorType: CommentAuthorType;
  authorId: string | null;
  body: string;
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

export type TaskRunRecord = {
  id: string;
  taskId: string;
  attemptNumber: number;
  agentId: string;
  runtimeKind: "openclaw-native";
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
  mode: "mock" | "openclaw";
  profile: string;
  gatewayUrl: string | null;
  binaryPath: string;
  binaryVersion: string | null;
  details: string[];
  updatedAt: string;
};

export type MonitorSummary = {
  runtimeHealth: RuntimeHealth;
  activeRunCount: number;
  openTaskCount: number;
  recentFailureCount: number;
  agentCounts: {
    idle: number;
    working: number;
    paused: number;
    error: number;
    offline: number;
  };
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
