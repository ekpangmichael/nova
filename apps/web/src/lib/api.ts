export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(message: string, options: { status: number; code?: string; details?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code ?? "api_error";
    this.details = options.details ?? null;
  }
}

const AUTH_COOKIE_NAME = "nova_session";

export type ApiProjectStatus = "active" | "paused" | "archived";
export type ApiSeedType = "none" | "git";
export type ApiAgentStatus = "idle" | "working" | "paused" | "error" | "offline";
export type ApiRuntimeKind = "openclaw-native" | "codex" | "claude-code";
export type ApiSandboxMode = "off" | "docker" | "other";
export type ApiThinkingLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";
export type ApiTaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "failed"
  | "blocked"
  | "paused"
  | "canceled";
export type ApiTaskPriority = "critical" | "high" | "medium" | "low";

export type ApiProjectSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: ApiProjectStatus;
  projectRoot: string;
  seedType: ApiSeedType;
  seedUrl: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  assignedAgentCount: number;
  openTaskCount: number;
  backlogTaskCount: number;
};

export type ApiProjectDetail = ApiProjectSummary & {
  assignedAgentIds: string[];
};

export type ApiProjectActivityItem = {
  id: string;
  projectId: string;
  type: "comment" | "run" | "assignment";
  title: string;
  message: string;
  createdAt: string;
};

export type ApiAgent = {
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
  status: ApiAgentStatus;
  currentTaskId: string | null;
  projectIds: string[];
  lastSyncedAt: string | null;
  runtime: {
    kind: ApiRuntimeKind;
    runtimeAgentId: string;
    workspacePath: string;
    runtimeStatePath: string;
    defaultModelId: string | null;
    modelOverrideAllowed: boolean;
    sandboxMode: ApiSandboxMode;
    defaultThinkingLevel: ApiThinkingLevel;
  };
  createdAt: string;
  updatedAt: string;
};

export type ApiRuntimeHealth = {
  status: "missing_binary" | "starting" | "healthy" | "degraded" | "error";
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

export type ApiRuntimeSummary = {
  providerKey: string;
  kind: ApiRuntimeKind;
  label: string;
  available: boolean;
  health: ApiRuntimeHealth;
  capabilities: {
    kind: ApiRuntimeKind;
    executionTargetMode: "inside-agent-home" | "runtime-cwd" | "external";
    supportsStreaming: boolean;
    supportsStop: boolean;
    supportsRetry: boolean;
    supportsPause: boolean;
    supportsResume: boolean;
    supportsAutomations: boolean;
    supportsUsageMetrics: boolean;
  };
};

export type ApiOpenClawCatalog = ApiRuntimeSummary & {
  configPath: string | null;
  stateDir: string | null;
  gateway: {
    reachable: boolean;
    url: string | null;
    bindMode: string | null;
    bindHost: string | null;
    port: number | null;
    authMode: string | null;
  };
  defaults: {
    defaultAgentId: string | null;
    defaultModelId: string | null;
    workspacePathTemplate: string;
    runtimeStatePathTemplate: string;
  };
  models: Array<{
    id: string;
    name: string;
    available: boolean;
    local: boolean;
    input: string | null;
    contextWindow: number | null;
    tags: string[];
  }>;
  existingAgents: Array<{
    runtimeAgentId: string;
    workspacePath: string;
    runtimeStatePath: string;
    displayName: string | null;
    defaultModelId: string | null;
    isDefault: boolean;
  }>;
};

export type ApiCodexCatalog = ApiRuntimeSummary & {
  configPath: string | null;
  stateDir: string | null;
  gateway: {
    reachable: boolean;
    url: string | null;
    bindMode: string | null;
    bindHost: string | null;
    port: number | null;
    authMode: string | null;
  };
  defaults: {
    defaultAgentId: string | null;
    defaultModelId: string | null;
    workspacePathTemplate: string;
    runtimeStatePathTemplate: string;
  };
  models: Array<{
    id: string;
    name: string;
    available: boolean;
    local: boolean;
    input: string | null;
    contextWindow: number | null;
    tags: string[];
  }>;
  existingAgents: Array<{
    runtimeAgentId: string;
    workspacePath: string;
    runtimeStatePath: string;
    displayName: string | null;
    defaultModelId: string | null;
    isDefault: boolean;
  }>;
};

export type ApiOpenClawConfigValues = {
  runtimeMode: "mock" | "openclaw";
  profile: string;
  binaryPath: string;
  stateDir: string;
  configPath: string;
  gatewayUrl: string | null;
};

export type ApiOpenClawConfigSnapshot = {
  enabled: boolean;
  current: ApiOpenClawConfigValues;
  detected: {
    profile: string;
    binaryPath: string;
    stateDir: string;
    configPath: string;
    gatewayUrl: string | null;
  };
  health: ApiRuntimeHealth;
};

export type ApiCodexConfigValues = {
  binaryPath: string;
  stateDir: string;
  configPath: string;
  defaultModel: string | null;
};

export type ApiCodexLoginSummary = {
  status: "logged_in" | "logged_out" | "unknown";
  authMode: string | null;
  lastRefresh: string | null;
  message: string;
};

export type ApiCodexConfigSnapshot = {
  enabled: boolean;
  current: ApiCodexConfigValues;
  detected: ApiCodexConfigValues;
  auth: ApiCodexLoginSummary;
  health: ApiRuntimeHealth;
};

export type ApiClaudeConfigValues = {
  binaryPath: string;
  stateDir: string;
  configPath: string;
  defaultModel: string | null;
};

export type ApiClaudeLoginSummary = {
  status: "logged_in" | "logged_out" | "unknown";
  authMode: string | null;
  email: string | null;
  subscriptionType: string | null;
  message: string;
};

export type ApiClaudeCatalog = ApiRuntimeSummary & {
  configPath: string | null;
  stateDir: string | null;
  gateway: {
    reachable: boolean;
    url: string | null;
    bindMode: string | null;
    bindHost: string | null;
    port: number | null;
    authMode: string | null;
  };
  defaults: {
    defaultAgentId: string | null;
    defaultModelId: string | null;
    workspacePathTemplate: string;
    runtimeStatePathTemplate: string;
  };
  models: Array<{
    id: string;
    name: string;
    available: boolean;
    local: boolean;
    input: string | null;
    contextWindow: number | null;
    tags: string[];
  }>;
  existingAgents: Array<{
    runtimeAgentId: string;
    workspacePath: string;
    runtimeStatePath: string;
    displayName: string | null;
    defaultModelId: string | null;
    isDefault: boolean;
  }>;
};

export type ApiClaudeConfigSnapshot = {
  enabled: boolean;
  current: ApiClaudeConfigValues;
  detected: ApiClaudeConfigValues;
  auth: ApiClaudeLoginSummary;
  health: ApiRuntimeHealth;
};

export type PatchOpenClawConfigInput = {
  profile: string;
  binaryPath?: string | null;
  stateDir?: string | null;
  configPath?: string | null;
  gatewayUrl?: string | null;
};

export type PatchCodexConfigInput = {
  binaryPath?: string | null;
  stateDir?: string | null;
  configPath?: string | null;
  defaultModel?: string | null;
};

export type PatchClaudeConfigInput = {
  binaryPath?: string | null;
  stateDir?: string | null;
  configPath?: string | null;
  defaultModel?: string | null;
};

export type SetRuntimeEnabledInput = {
  enabled: boolean;
};

export type ApiMonitorSummary = {
  runtimeHealth: ApiRuntimeHealth;
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

export type ApiDashboardStats = {
  totalProjectCount: number;
  activeProjectCount: number;
  totalAgentCount: number;
  activeAgentCount: number;
  openTaskCount: number;
  completedThisWeekCount: number;
};

export type ApiDashboardWorkingRun = {
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
  status:
    | "requested"
    | "preparing"
    | "starting"
    | "running"
    | "completed"
    | "failed"
    | "aborted";
  startedAt: string | null;
  lastEventAt: string | null;
  resolvedExecutionTarget: string;
  logs: Array<{
    at: string;
    message: string;
    level: "info" | "success" | "warning" | "active" | "dim";
  }>;
};

export type ApiDashboardActivityItem = {
  id: string;
  type: "run" | "comment" | "assignment";
  actorLabel: string;
  status: "working" | "idle" | "error" | "scheduled" | "neutral";
  message: string;
  createdAt: string;
  href: string | null;
};

export type ApiDashboardAttentionItem = {
  id: string;
  kind: "failed_run" | "blocked_task" | "agent_error";
  severity: "error" | "warning";
  title: string;
  message: string;
  createdAt: string;
  href: string | null;
  actionLabel: string;
};

export type ApiTaskComment = {
  id: string;
  taskId: string;
  taskRunId: string | null;
  authorType: "user" | "agent" | "system";
  authorId: string | null;
  authorLabel: string | null;
  source: "ticket_user" | "agent_mirror" | "agent_api" | "system";
  externalMessageId: string | null;
  body: string;
  attachments: ApiTaskCommentAttachment[];
  createdAt: string;
};

export type ApiTaskAttachment = {
  id: string;
  taskId: string;
  fileName: string;
  mimeType: string;
  relativeStoragePath: string;
  sha256: string;
  sizeBytes: number;
  createdAt: string;
};

export type ApiTaskCommentAttachment = {
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

export type ApiTaskRun = {
  id: string;
  taskId: string;
  attemptNumber: number;
  agentId: string;
  runtimeKind: ApiRuntimeKind;
  runtimeSessionKey: string;
  runtimeRunId: string | null;
  status:
    | "requested"
    | "preparing"
    | "starting"
    | "running"
    | "completed"
    | "failed"
    | "aborted";
  startedAt: string | null;
  endedAt: string | null;
  failureReason: string | null;
  finalSummary: string | null;
  usage: unknown;
  createdAt: string;
  updatedAt: string;
};

export type ApiRunEvent = {
  id: string;
  taskRunId: string;
  seq: number;
  eventType: string;
  payload: unknown;
  createdAt: string;
};

export type ApiRunArtifact = {
  id: string;
  taskRunId: string;
  path: string;
  kind: "input" | "output" | "modified" | "other";
  label: string | null;
  summary: string | null;
  mimeType: string | null;
  sha256: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

export type ApiTaskSummary = {
  id: string;
  taskNumber: number;
  projectId: string;
  title: string;
  description: string;
  status: ApiTaskStatus;
  priority: ApiTaskPriority;
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
  assignedAgent: ApiAgent | null;
  handoffAgent: ApiAgent | null;
  commentCount: number;
  attachmentCount: number;
  currentRun: ApiTaskRun | null;
};

export type ApiTaskDetail = ApiTaskSummary & {
  project: ApiProjectDetail;
  attachments: ApiTaskAttachment[];
  comments: ApiTaskComment[];
  recentRuns: ApiTaskRun[];
};

export type CreateProjectInput = {
  name: string;
  description?: string;
  status?: ApiProjectStatus;
  projectRoot: string;
  seedType?: ApiSeedType;
  seedUrl?: string | null;
  tags?: string[];
};

export type PatchProjectInput = Partial<CreateProjectInput>;

export type CreateAgentInput = {
  name: string;
  role: string;
  avatar?: string | null;
  systemInstructions?: string;
  personaText?: string | null;
  userContextText?: string | null;
  identityText?: string | null;
  toolsText?: string | null;
  heartbeatText?: string | null;
  memoryText?: string | null;
  runtime?: {
    kind: ApiRuntimeKind;
    runtimeAgentId?: string;
    workspacePath?: string;
    runtimeStatePath?: string;
    defaultModelId?: string | null;
    modelOverrideAllowed?: boolean;
    sandboxMode?: ApiSandboxMode;
    defaultThinkingLevel?: ApiThinkingLevel;
  };
};

export type ImportOpenClawAgentInput = Omit<CreateAgentInput, "runtime"> & {
  runtime: {
    runtimeAgentId: string;
    defaultModelId?: string | null;
    modelOverrideAllowed?: boolean;
    sandboxMode?: ApiSandboxMode;
    defaultThinkingLevel?: ApiThinkingLevel;
  };
};

export type PatchAgentInput = Partial<Omit<CreateAgentInput, "runtime">> & {
  status?: ApiAgentStatus;
  runtime?: {
    kind?: ApiRuntimeKind;
    runtimeAgentId?: string;
    workspacePath?: string;
    runtimeStatePath?: string;
    defaultModelId?: string | null;
    modelOverrideAllowed?: boolean;
    sandboxMode?: ApiSandboxMode;
    defaultThinkingLevel?: ApiThinkingLevel;
  };
};

export type CreateTaskInput = {
  projectId: string;
  title: string;
  description?: string;
  status?: ApiTaskStatus;
  priority?: ApiTaskPriority;
  assignedAgentId: string;
  handoffAgentId?: string | null;
  executionTargetOverride?: string | null;
  dueAt?: string | null;
  estimatedMinutes?: number | null;
  labels?: string[];
  createdBy?: string;
};

export type PatchTaskInput = Partial<Omit<CreateTaskInput, "projectId">>;

export type AddTaskCommentInput = {
  authorType?: "user" | "agent" | "system";
  authorId?: string | null;
  body: string;
  attachments?: File[];
  thinkingLevel?: ApiThinkingLevel | null;
};

export type DirectorySelection = {
  path: string | null;
  canceled: boolean;
};

const WEB_ORIGIN =
  process.env.NEXT_PUBLIC_WEB_ORIGIN?.replace(/\/$/, "") ?? "http://127.0.0.1:3000";

const SERVER_API_BASE_URL =
  process.env.NOVA_BACKEND_URL?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:4010/api";

const API_BASE_URL =
  typeof window === "undefined"
    ? SERVER_API_BASE_URL
    : process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "/api/backend";

const buildApiUrl = (path: string) =>
  `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let authHeaders: HeadersInit | undefined;

  if (typeof window === "undefined") {
    const { cookies } = await import("next/headers");
    const sessionToken = (await cookies()).get(AUTH_COOKIE_NAME)?.value ?? null;

    if (sessionToken) {
      authHeaders = {
        "x-nova-session-token": sessionToken,
      };
    }
  }

  const response = await fetch(buildApiUrl(path), {
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      ...(authHeaders ?? {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let payload: { error?: { code?: string; message?: string; details?: unknown }; message?: string } | null =
      null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    throw new ApiError(
      payload?.error?.message ?? payload?.message ?? `Request failed with status ${response.status}.`,
      {
        status: response.status,
        code: payload?.error?.code,
        details: payload?.error?.details,
      }
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const responseText = await response.text();

  if (!responseText.trim()) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}

export async function getProjects() {
  return requestJson<ApiProjectSummary[]>("/projects");
}

export async function getProject(projectId: string) {
  return requestJson<ApiProjectDetail>(`/projects/${projectId}`);
}

export async function getProjectActivity(projectId: string) {
  return requestJson<ApiProjectActivityItem[]>(`/projects/${projectId}/activity`);
}

export async function getProjectTasks(projectId: string) {
  return requestJson<ApiTaskSummary[]>(`/projects/${projectId}/tasks`);
}

export async function getAgents() {
  return requestJson<ApiAgent[]>("/agents");
}

export async function getAgent(agentId: string) {
  return requestJson<ApiAgent>(`/agents/${agentId}`);
}

export async function getTask(taskId: string) {
  return requestJson<ApiTaskDetail>(`/tasks/${taskId}`);
}

export async function getRuntimes() {
  return requestJson<ApiRuntimeSummary[]>("/runtimes");
}

export async function getOpenClawCatalog() {
  return requestJson<ApiOpenClawCatalog>("/runtimes/openclaw/catalog");
}

export async function getCodexCatalog() {
  return requestJson<ApiCodexCatalog>("/runtimes/codex/catalog");
}

export async function getClaudeCatalog() {
  return requestJson<ApiClaudeCatalog>("/runtimes/claude/catalog");
}

export async function getOpenClawConfig() {
  return requestJson<ApiOpenClawConfigSnapshot>("/runtimes/openclaw/config");
}

export async function testOpenClawConfig(input: PatchOpenClawConfigInput) {
  return requestJson<ApiOpenClawConfigSnapshot>("/runtimes/openclaw/config/test", {
    method: "POST",
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function updateOpenClawConfig(input: PatchOpenClawConfigInput) {
  return requestJson<ApiOpenClawConfigSnapshot>("/runtimes/openclaw/config", {
    method: "PATCH",
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function setOpenClawEnabled(input: SetRuntimeEnabledInput) {
  return requestJson<ApiOpenClawConfigSnapshot>("/runtimes/openclaw/enabled", {
    method: "PATCH",
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function getCodexConfig() {
  return requestJson<ApiCodexConfigSnapshot>("/runtimes/codex/config");
}

export async function getClaudeConfig() {
  return requestJson<ApiClaudeConfigSnapshot>("/runtimes/claude/config");
}

export async function testCodexConfig(input: PatchCodexConfigInput) {
  return requestJson<ApiCodexConfigSnapshot>("/runtimes/codex/config/test", {
    method: "POST",
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function updateCodexConfig(input: PatchCodexConfigInput) {
  return requestJson<ApiCodexConfigSnapshot>("/runtimes/codex/config", {
    method: "PATCH",
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function setCodexEnabled(input: SetRuntimeEnabledInput) {
  return requestJson<ApiCodexConfigSnapshot>("/runtimes/codex/enabled", {
    method: "PATCH",
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function testClaudeConfig(input: PatchClaudeConfigInput) {
  return requestJson<ApiClaudeConfigSnapshot>("/runtimes/claude/config/test", {
    method: "POST",
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function updateClaudeConfig(input: PatchClaudeConfigInput) {
  return requestJson<ApiClaudeConfigSnapshot>("/runtimes/claude/config", {
    method: "PATCH",
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function setClaudeEnabled(input: SetRuntimeEnabledInput) {
  return requestJson<ApiClaudeConfigSnapshot>("/runtimes/claude/enabled", {
    method: "PATCH",
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function getMonitorSummary() {
  return requestJson<ApiMonitorSummary>("/monitor/summary");
}

export async function getDashboardStats() {
  return requestJson<ApiDashboardStats>("/dashboard/stats");
}

export async function getDashboardWorkingRuns() {
  return requestJson<ApiDashboardWorkingRun[]>("/dashboard/working");
}

export async function getDashboardActivity() {
  return requestJson<ApiDashboardActivityItem[]>("/dashboard/activity");
}

export async function getDashboardAttention() {
  return requestJson<ApiDashboardAttentionItem[]>("/dashboard/attention");
}

export async function createProject(input: CreateProjectInput) {
  return requestJson<ApiProjectSummary>("/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function patchProject(projectId: string, input: PatchProjectInput) {
  return requestJson<ApiProjectDetail>(`/projects/${projectId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function deleteProject(projectId: string) {
  return requestJson<void>(`/projects/${projectId}`, {
    method: "DELETE",
  });
}

export async function assignAgentToProject(projectId: string, agentId: string) {
  return requestJson<void>(`/projects/${projectId}/agents/${agentId}`, {
    method: "POST",
  });
}

export async function createAgent(input: CreateAgentInput) {
  return requestJson<ApiAgent>("/agents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function importOpenClawAgent(input: ImportOpenClawAgentInput) {
  return requestJson<ApiAgent>("/agents/import/openclaw", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function patchAgent(agentId: string, input: PatchAgentInput) {
  return requestJson<ApiAgent>(`/agents/${agentId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function deleteAgent(agentId: string) {
  return requestJson<void>(`/agents/${agentId}`, {
    method: "DELETE",
  });
}

export async function createTask(input: CreateTaskInput) {
  return requestJson<ApiTaskDetail>("/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function patchTask(taskId: string, input: PatchTaskInput) {
  return requestJson<ApiTaskDetail>(`/tasks/${taskId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function deleteTask(taskId: string) {
  return requestJson<void>(`/tasks/${taskId}`, {
    method: "DELETE",
  });
}

export async function addTaskComment(taskId: string, input: AddTaskCommentInput) {
  if (input.attachments && input.attachments.length > 0) {
    const formData = new FormData();
    formData.append("body", input.body);

    if (input.authorType) {
      formData.append("authorType", input.authorType);
    }

    if (input.authorId != null) {
      formData.append("authorId", input.authorId);
    }

    if (input.thinkingLevel) {
      formData.append("thinkingLevel", input.thinkingLevel);
    }

    for (const file of input.attachments) {
      formData.append("files", file);
    }

    return requestJson<ApiTaskComment>(`/tasks/${taskId}/comments`, {
      method: "POST",
      body: formData,
    });
  }

  return requestJson<ApiTaskComment>(`/tasks/${taskId}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export function getTaskCommentAttachmentContentUrl(
  taskId: string,
  commentId: string,
  attachmentId: string
) {
  return buildApiUrl(
    `/tasks/${taskId}/comments/${commentId}/attachments/${attachmentId}/content`
  );
}

export async function startTask(taskId: string) {
  return requestJson<ApiTaskRun>(`/tasks/${taskId}/start`, {
    method: "POST",
  });
}

export async function stopTask(taskId: string) {
  return requestJson<ApiTaskRun>(`/tasks/${taskId}/stop`, {
    method: "POST",
  });
}

export async function getRunEvents(runId: string) {
  return requestJson<ApiRunEvent[]>(`/runs/${runId}/events`);
}

export async function getRunArtifacts(runId: string) {
  return requestJson<ApiRunArtifact[]>(`/runs/${runId}/artifacts`);
}

export async function uploadTaskAttachment(taskId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return requestJson<ApiTaskAttachment>(`/tasks/${taskId}/attachments`, {
    method: "POST",
    body: formData,
  });
}

export async function selectDirectory() {
  return requestJson<DirectorySelection>("/system/select-directory", {
    method: "POST",
  });
}

export async function selectProjectRootDirectory() {
  return selectDirectory();
}

export async function selectExecutionTargetDirectory() {
  return selectDirectory();
}

export function resolveBackendWebsocketUrl() {
  const configuredBase =
    process.env.NOVA_BACKEND_URL?.replace(/\/$/, "") ??
    "http://127.0.0.1:4010/api";
  const backendUrl = new URL(configuredBase.replace(/\/api$/, ""));

  if (typeof window !== "undefined") {
    backendUrl.hostname = window.location.hostname;
  }

  backendUrl.protocol = backendUrl.protocol === "https:" ? "wss:" : "ws:";

  return `${backendUrl.toString().replace(/\/$/, "")}/ws`;
}
