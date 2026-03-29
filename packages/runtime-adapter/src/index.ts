import type { JsonValue, RuntimeHealth } from "@nova/shared";

export type RuntimeKind =
  | "openclaw-native"
  | "openclaw-acp"
  | "claude-code"
  | "codex"
  | "custom";

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

export interface StartRunInput {
  taskId: string;
  runId: string;
  agentId: string;
  runtimeAgentId: string;
  agentHomePath: string;
  executionTarget: string;
  prompt: string;
  attachments: RuntimeAttachment[];
  modelOverride?: string | null;
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
  ensureRuntimeReady(): Promise<void>;
  ensureAgentHome(agentId: string, agentHomePath: string): Promise<void>;
  ensureProjectRoot(
    agentId: string,
    agentHomePath: string,
    projectRoot: string,
    seed?: ProjectSeed | null
  ): Promise<void>;
  startRun(input: StartRunInput): Promise<StartRunResult>;
  stopRun(runtimeSessionKey: string): Promise<void>;
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
