export type AgentStatus = "working" | "idle" | "error" | "scheduled" | "offline" | "paused";

export type LogEntry = {
  timestamp: string;
  message: string;
  level: "info" | "success" | "warning" | "active" | "dim";
};

export type WorkingAgent = {
  agentId: string;
  name: string;
  taskLabel: string;
  taskId: string;
  taskHref?: string;
  statusText?: string;
  progress?: number | null;
  logs: LogEntry[];
};

export type IdleAgent = {
  agentId: string;
  name: string;
  statusText: string;
};

export type ScheduledAgent = {
  agentId: string;
  name: string;
  timeUntilStart: string;
};

export type ActivityEvent = {
  id?: string;
  timestamp: string;
  actorLabel: string;
  message: string;
  status: "working" | "idle" | "error" | "scheduled" | "neutral";
  href?: string | null;
};

export type CriticalError = {
  title: string;
  code: string;
  message: string;
  timestamp: string;
  agentId: string;
};

export type HeroStat = {
  label: string;
  value: number;
  unit: string;
  decimals?: number;
  suffix?: string;
  accentColor?: "tertiary" | "secondary" | "on-surface-variant";
};

export type ProjectStatus = "active" | "paused" | "archived";

export type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  agentCount: number;
  maxAgents: number;
  lastSync: string;
  openTasks: number;
  progress: number;
  agents: string[];
};

export type ProjectStat = {
  label: string;
  value: number;
  unit: string;
  decimals?: number;
  accentColor: "secondary" | "tertiary" | "primary";
  icon: string;
};

export type SystemLogEntry = {
  timestamp: string;
  level: "success" | "info" | "warning" | "cleanup";
  message: string;
};

// ========================================
// Task Detail Types
// ========================================

export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "failed"
  | "blocked"
  | "paused"
  | "canceled";

export type TaskAttachment = {
  name: string;
  size: string;
  type: string;
  icon: string;
};

export type ExecutionLogItem = {
  icon: string;
  title: string;
  description: string;
  timeAgo: string;
  runtimeLabel?: string;
};

export type TaskDetail = {
  id: string;
  title: string;
  status: TaskStatus;
  statusLabel: string;
  description: string[];
  priority: string;
  priorityColor: "error" | "tertiary" | "secondary" | "primary" | "outline";
  assignedAgent: { name: string; role: string };
  workspace: string;
  branch: { name: string; url: string | null } | null;
  deadline: string;
  attachments: TaskAttachment[];
  executionLog: ExecutionLogItem[];
};

// ========================================
// Project Detail Types
// ========================================

// ========================================
// Agent Registry Types
// ========================================

export type RegisteredAgent = {
  id: string;
  name: string;
  role: string;
  status: "working" | "idle" | "error" | "offline";
  load: string;
  assignedProject: string | null;
  uptime: string;
  tasksCompleted: number;
  model: string;
};

export type AgentSkill = {
  name: string;
  enabled: boolean;
};

export type AgentHistoryEntry = {
  task: string;
  date: string;
  status: "success" | "fail";
};

export type AgentDetail = {
  id: string;
  name: string;
  agentCode: string;
  icon: string;
  status: "active" | "syncing" | "critical" | "patrolling" | "idle" | "offline";
  statusLabel: string;
  role: string;
  model: string;
  thinkingLevel: string;
  coreDirective: string;
  assignedProject: string | null;
  uptime: string;
  latency: string;
  computeLoad: number;
  reliability: number;
  skills: AgentSkill[];
  history: AgentHistoryEntry[];
};

export type MonitoredAgent = {
  id: string;
  name: string;
  agentCode: string;
  icon: string;
  status: "active" | "syncing" | "critical" | "patrolling" | "idle" | "offline";
  statusLabel: string;
  currentTask: string;
  taskLabel: string;
  metricLabel: string;
  metricValue: string;
  progress: number;
  isError?: boolean;
};

export type ProjectAgent = {
  agentId: string;
  name: string;
  role: string;
  status: "working" | "idle" | "error";
  load: string;
};

export type ProjectEvent = {
  timestamp: string;
  type: "task_completed" | "handoff" | "anomaly" | "routine";
  title: string;
  description: string;
};

// ========================================
// Task Board Types
// ========================================

export type TaskPriority = "urgent" | "high" | "medium" | "low" | "none";

export type BoardTask = {
  id: string;
  displayId?: string;
  title: string;
  priority: TaskPriority;
  assignedAgent?: string;
  progress?: number;
  progressLabel?: string;
  date?: string;
  comments?: number;
  attachments?: number;
};

export type BoardColumn = {
  id: string;
  title: string;
  count: number;
  accentColor: "outline-variant" | "secondary" | "tertiary" | "primary";
  tasks: BoardTask[];
  dimmed?: boolean;
};

export type BoardAgent = {
  name: string;
  status: "working" | "idle" | "error";
  activity: string;
};

export type ProjectDetail = {
  id: string;
  name: string;
  status: "live" | "paused" | "maintenance" | "archived";
  projectId: string;
  priority: string;
  workflowCount: number;
  description: string;
  agents: ProjectAgent[];
  metrics: {
    activeAgents: { current: number; max: number };
    openTasks: number;
    taskTrend: number;
    completedTasks7d: number;
    completedChart: number[];
    tokenCost: { total: number; dailyAvg: number };
  };
  events: ProjectEvent[];
};
