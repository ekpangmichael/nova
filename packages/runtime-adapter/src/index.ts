import type {
  JsonValue,
  RuntimeHealth,
  RuntimeKind,
  SandboxMode,
  ThinkingLevel,
} from "@nova/shared";

export type RuntimeEventType =
  | "run.accepted"
  | "run.started"
  | "message.delta"
  | "message.completed"
  | "tool.started"
  | "tool.completed"
  | "artifact.created"
  | "usage"
  | "warning"
  | "error"
  | "run.completed"
  | "run.failed"
  | "run.aborted";

export interface RuntimeCapabilities {
  kind: RuntimeKind;
  executionTargetMode: "inside-agent-home" | "runtime-cwd" | "external";
  supportsStreaming: boolean;
  supportsStop: boolean;
  supportsRetry: boolean;
  supportsPause: boolean;
  supportsResume: boolean;
  supportsAutomations: boolean;
  supportsUsageMetrics: boolean;
}

export type RuntimeSummary = {
  providerKey: string;
  kind: RuntimeKind;
  label: string;
  available: boolean;
  health: RuntimeHealth;
  capabilities: RuntimeCapabilities;
};

export type RuntimeModelCatalogItem = {
  id: string;
  name: string;
  available: boolean;
  local: boolean;
  input: string | null;
  contextWindow: number | null;
  tags: string[];
};

export type RuntimeAgentCatalogItem = {
  runtimeAgentId: string;
  workspacePath: string;
  runtimeStatePath: string;
  displayName: string | null;
  defaultModelId: string | null;
  isDefault: boolean;
};

export type RuntimeCatalog = {
  providerKey: string;
  kind: RuntimeKind;
  label: string;
  available: boolean;
  health: RuntimeHealth;
  capabilities: RuntimeCapabilities;
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
  models: RuntimeModelCatalogItem[];
  existingAgents: RuntimeAgentCatalogItem[];
};

export type RuntimeAttachment = {
  id: string;
  fileName: string;
  path: string;
  mimeType: string;
  sha256: string;
  sizeBytes: number;
};

export type ProjectSeed = {
  type: "none" | "git";
  url: string | null;
};

export type ProvisionRuntimeAgentInput = {
  runtimeAgentId: string;
  workspacePath: string;
  runtimeStatePath: string;
  defaultModelId?: string | null;
  modelOverrideAllowed?: boolean;
  sandboxMode?: SandboxMode;
  defaultThinkingLevel?: ThinkingLevel;
};

export type ProvisionRuntimeAgentResult = {
  runtimeAgentId: string;
  workspacePath: string;
  runtimeStatePath: string;
  defaultModelId: string | null;
};

export type RuntimeWorkspaceFile = {
  relativePath: string;
  content: string;
};

export type SyncRuntimeWorkspaceInput = {
  runtimeAgentId: string;
  workspacePath: string;
  runtimeStatePath: string;
  files: RuntimeWorkspaceFile[];
  identityDefaults?: {
    name?: string | null;
  } | null;
};

export type SyncRuntimeWorkspaceResult = {
  files: string[];
  syncedAt: string;
};

export interface StartRunInput {
  taskId: string;
  runId: string;
  previousRuntimeSessionKey?: string | null;
  agentId: string;
  runtimeAgentId: string;
  agentHomePath: string;
  executionTarget: string;
  prompt: string;
  attachments: RuntimeAttachment[];
  modelOverride?: string | null;
  thinkingLevel?: ThinkingLevel | null;
  sandboxMode?: SandboxMode | null;
}

export interface StartRunResult {
  runtimeSessionKey: string;
  runtimeRunId?: string | null;
  startedAt: string;
}

export interface RuntimeEvent {
  type: RuntimeEventType;
  at: string;
  data: Record<string, JsonValue>;
}

export type RuntimeRunInput = {
  text: string;
  idempotencyKey?: string;
  thinkingLevel?: ThinkingLevel | null;
};

export type RuntimeSessionHistoryMessage = {
  id: string | null;
  seq: number | null;
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: string | null;
};

export type RuntimeAutomation = {
  id: string;
  name: string;
  enabled: boolean;
  runtimeKind: RuntimeKind;
};

export type RuntimeAutomationRun = {
  id: string;
  status: "queued" | "running" | "ok" | "skipped" | "error";
  startedAt: string | null;
  endedAt: string | null;
  summary: string | null;
  raw: JsonValue | null;
};

export type CreateRuntimeAutomationInput = {
  agentId: string;
  name: string;
};

export type UpdateRuntimeAutomationInput = Partial<CreateRuntimeAutomationInput> & {
  enabled?: boolean;
};

export interface RuntimeAdapter {
  kind: RuntimeKind;
  getCapabilities(): Promise<RuntimeCapabilities>;
  getHealth(): Promise<RuntimeHealth>;
  getSummary(): Promise<RuntimeSummary>;
  getCatalog(): Promise<RuntimeCatalog>;
  listRuntimeAgents(): Promise<RuntimeAgentCatalogItem[]>;
  ensureRuntimeReady(): Promise<void>;
  provisionAgent(
    input: ProvisionRuntimeAgentInput
  ): Promise<ProvisionRuntimeAgentResult>;
  deleteAgent(runtimeAgentId: string): Promise<void>;
  ensureAgentWorkspace(
    agentId: string,
    workspacePath: string,
    runtimeStatePath: string
  ): Promise<void>;
  syncAgentWorkspace(
    input: SyncRuntimeWorkspaceInput
  ): Promise<SyncRuntimeWorkspaceResult>;
  ensureProjectRoot(
    agentId: string,
    workspacePath: string,
    projectRoot: string,
    seed?: ProjectSeed | null
  ): Promise<void>;
  startRun(input: StartRunInput): Promise<StartRunResult>;
  stopRun(runtimeSessionKey: string): Promise<void>;
  sendRunInput(
    runtimeSessionKey: string,
    input: RuntimeRunInput
  ): Promise<{ runtimeRunId: string | null; startedAt: string }>;
  loadSessionHistory(
    runtimeSessionKey: string,
    after?: number
  ): Promise<RuntimeSessionHistoryMessage[]>;
  subscribeRun(
    runtimeSessionKey: string,
    onEvent: (event: RuntimeEvent) => Promise<void> | void
  ): Promise<() => Promise<void>>;
  listAutomations(agentId?: string): Promise<RuntimeAutomation[]>;
  createAutomation(input: CreateRuntimeAutomationInput): Promise<RuntimeAutomation>;
  updateAutomation(
    id: string,
    patch: UpdateRuntimeAutomationInput
  ): Promise<RuntimeAutomation>;
  deleteAutomation(id: string): Promise<void>;
  runAutomationNow(id: string): Promise<{ runtimeRunId?: string | null }>;
  getAutomationRuns(id: string): Promise<RuntimeAutomationRun[]>;
}
