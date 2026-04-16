import type {
  WorkingAgent,
  IdleAgent,
  ScheduledAgent,
  ActivityEvent,
  CriticalError,
  HeroStat,
  Project,
  ProjectStat,
  SystemLogEntry,
  ProjectDetail,
  BoardColumn,
  BoardAgent,
  TaskDetail,
  RegisteredAgent,
  MonitoredAgent,
  AgentDetail,
} from "@/types";

export const heroStats: HeroStat[] = [
  { label: "Total Projects", value: 4, unit: "active", accentColor: "secondary" },
  { label: "Active Agents", value: 12, unit: "/ 14 deployed", accentColor: "tertiary" },
  { label: "Open Tasks", value: 37, unit: "across projects" },
  { label: "Completed This Week", value: 18, unit: "tasks" },
];

export const workingAgents: WorkingAgent[] = [
  {
    agentId: "AGENT_X-99",
    name: "Market Sentiment Analyzer",
    progress: 65.2,
    taskLabel: "Processing: BATCH_04",
    taskId: "T-14",
    logs: [
      { timestamp: "14:20:01", message: "Initializing neural bridge...", level: "dim" },
      { timestamp: "14:20:03", message: "Fetching real-time ticker data", level: "info" },
      { timestamp: "14:20:05", message: "Applying NLP weights (v2.4)", level: "info" },
      { timestamp: "14:20:12", message: "Generating sentiment vectors", level: "active" },
    ],
  },
  {
    agentId: "AGENT_V-02",
    name: "Network Vulnerability Probe",
    progress: 22.1,
    taskLabel: "Scanning: SUBNET_DELTA",
    taskId: "T-18",
    logs: [
      { timestamp: "14:18:55", message: "Protocol handshake success", level: "dim" },
      { timestamp: "14:19:10", message: "Probing firewall layer 3", level: "info" },
      { timestamp: "14:19:45", message: "Latency check: 14ms nominal", level: "info" },
      { timestamp: "14:20:10", message: "Brute force simulation active", level: "active" },
    ],
  },
  {
    agentId: "AGENT_M-00",
    name: "Deep Log Forensics",
    progress: 89.8,
    taskLabel: "Compiling: WEEKLY_REPORT",
    taskId: "T-21",
    logs: [
      { timestamp: "14:05:00", message: "Aggregating multi-source logs", level: "info" },
      { timestamp: "14:12:12", message: "Pattern matching identified", level: "info" },
      { timestamp: "14:15:22", message: "Noise filtered: 4.2GB reduced", level: "info" },
      { timestamp: "14:20:11", message: "Writing final summary block", level: "active" },
    ],
  },
];

export const idleAgents: IdleAgent[] = [
  { agentId: "IDLE_IC_342", name: "Image Classifier v3", statusText: "Waiting for payload" },
  { agentId: "IDLE_DAM_901", name: "Discord Auto-Mod", statusText: "No activity detected" },
  { agentId: "IDLE_EAR_117", name: "Email Auto-Responder", statusText: "Inbox clear" },
  { agentId: "IDLE_DPM_553", name: "Data Pipeline Monitor", statusText: "Pipeline nominal" },
];

export const scheduledAgents: ScheduledAgent[] = [
  { agentId: "SCH_DB_VAC", name: "Database Vacuum", timeUntilStart: "04:12:00" },
  { agentId: "SCH_BKP_SYN", name: "Backup Synchronization", timeUntilStart: "08:45:12" },
];

export const activityFeed: ActivityEvent[] = [
  { timestamp: "14:20:12", actorLabel: "AGENT_X-99", message: "began processing BATCH_04 \u2014 sentiment analysis pipeline", status: "working" },
  { timestamp: "14:18:55", actorLabel: "AGENT_V-02", message: "initiated subnet delta scan \u2014 handshake confirmed", status: "working" },
  { timestamp: "14:15:33", actorLabel: "PROXY_ALPHA_9", message: "authentication failure \u2014 ERR_403 key rotation blocked", status: "error" },
  { timestamp: "14:12:12", actorLabel: "AGENT_M-00", message: "pattern matching completed \u2014 4.2GB noise filtered", status: "neutral" },
  { timestamp: "13:58:22", actorLabel: "IDLE_IC_342", message: "entered standby \u2014 awaiting payload dispatch", status: "idle" },
  { timestamp: "13:45:10", actorLabel: "SCH_DB_VAC", message: "queued for execution \u2014 T-04:12:00 until dispatch", status: "scheduled" },
];

export const criticalErrors: CriticalError[] = [
  {
    title: "Agent Authentication Failure",
    code: "ERR_403",
    message:
      "Agent PROXY_ALPHA_9 failed to rotate API keys. All child processes halted to prevent protocol leakage. Manual intervention required to re-authenticate the vault.",
    timestamp: "14:15:33 UTC",
    agentId: "PROXY_ALPHA_9",
  },
];

// ========================================
// Projects Page Data
// ========================================

export const projectStats: ProjectStat[] = [
  { label: "Total Projects", value: 4, unit: "REGISTERED", accentColor: "secondary", icon: "folder_open" },
  { label: "Active Projects", value: 2, unit: "RUNNING", accentColor: "tertiary", icon: "play_circle" },
  { label: "Open Tasks", value: 210, unit: "ACROSS ALL", accentColor: "primary", icon: "assignment" },
];

export const projects: Project[] = [
  {
    id: "proj-mkt-auto",
    name: "Marketing Automation",
    status: "active",
    agentCount: 14,
    maxAgents: 20,
    lastSync: "2m ago",
    openTasks: 42,
    progress: 68,
    agents: ["A1", "A2", "+12"],
  },
  {
    id: "proj-codebase",
    name: "Codebase Maintenance",
    status: "paused",
    agentCount: 0,
    maxAgents: 8,
    lastSync: "14h ago",
    openTasks: 12,
    progress: 92,
    agents: ["C1", "C2"],
  },
  {
    id: "proj-neural-sync",
    name: "Neural Sync Engine",
    status: "active",
    agentCount: 64,
    maxAgents: 64,
    lastSync: "Just now",
    openTasks: 156,
    progress: 34,
    agents: ["N1", "N2", "N3", "+61"],
  },
  {
    id: "proj-legacy-scraper",
    name: "Legacy Scraper V2",
    status: "archived",
    agentCount: 0,
    maxAgents: 0,
    lastSync: "Jan 12 2024",
    openTasks: 0,
    progress: 100,
    agents: [],
  },
];

// ========================================
// Agent Registry Data
// ========================================

export const registeredAgents: RegisteredAgent[] = [
  { id: "SIG-04", name: "Sigma-04", role: "Strategic Handoff Lead", status: "working", load: "24.2 t/s", assignedProject: "Marketing Automation", uptime: "14d 6h", tasksCompleted: 342, model: "claude-3.5-sonnet" },
  { id: "DEL-09", name: "Delta-9", role: "Creative Asset Synthesis", status: "idle", load: "0.0 t/s", assignedProject: "Marketing Automation", uptime: "14d 6h", tasksCompleted: 189, model: "claude-3.5-sonnet" },
  { id: "PSI-AL", name: "Psi-Alpha", role: "Semantic Integrity Monitor", status: "error", load: "ERR_CRIT", assignedProject: "Marketing Automation", uptime: "2d 14h", tasksCompleted: 57, model: "claude-3-opus" },
  { id: "NSE-01", name: "SyncMaster", role: "Orchestration Lead", status: "working", load: "98.4 t/s", assignedProject: "Neural Sync Engine", uptime: "30d 0h", tasksCompleted: 1847, model: "claude-3.5-sonnet" },
  { id: "NSE-02", name: "IngestPrime", role: "Data Pipeline Head", status: "working", load: "64.1 t/s", assignedProject: "Neural Sync Engine", uptime: "30d 0h", tasksCompleted: 923, model: "claude-3-haiku" },
  { id: "NSE-03", name: "PatternWeave", role: "Recognition Engine", status: "working", load: "42.8 t/s", assignedProject: "Neural Sync Engine", uptime: "28d 12h", tasksCompleted: 714, model: "claude-3.5-sonnet" },
  { id: "COD-01", name: "CodeScan-1", role: "Vulnerability Analysis", status: "idle", load: "0.0 t/s", assignedProject: "Codebase Maintenance", uptime: "45d 8h", tasksCompleted: 412, model: "claude-3-opus" },
  { id: "COD-02", name: "DepBot-2", role: "Dependency Management", status: "idle", load: "0.0 t/s", assignedProject: "Codebase Maintenance", uptime: "45d 8h", tasksCompleted: 256, model: "claude-3-haiku" },
  { id: "VLC-07", name: "Vulcan-7", role: "Web Scraping & Ingestion", status: "working", load: "31.6 t/s", assignedProject: "Marketing Automation", uptime: "7d 2h", tasksCompleted: 98, model: "claude-3-haiku" },
  { id: "ORN-X", name: "Orion-X", role: "Content Generation", status: "idle", load: "0.0 t/s", assignedProject: null, uptime: "60d 0h", tasksCompleted: 2104, model: "claude-3.5-sonnet" },
  { id: "NOV-9", name: "Nova-9", role: "Anomaly Detection", status: "error", load: "ERR_NET", assignedProject: "Neural Sync Engine", uptime: "0d 0h", tasksCompleted: 0, model: "claude-3-opus" },
  { id: "ATL-3", name: "Atlas-3", role: "Report Generation", status: "offline", load: "--", assignedProject: null, uptime: "0d 0h", tasksCompleted: 567, model: "claude-3-haiku" },
];

export const monitoredAgents: MonitoredAgent[] = [
  { id: "N-904-B", name: "Epsilon_7", agentCode: "N-904-B", icon: "memory", status: "active", statusLabel: "Active", currentTask: "Analyzing market sentiment across decentralized liquidity pools...", taskLabel: "Current Task", metricLabel: "PROGRESS", metricValue: "74.2%", progress: 74.2 },
  { id: "K-221-A", name: "Kyros_Delta", agentCode: "K-221-A", icon: "cloud_sync", status: "syncing", statusLabel: "Syncing", currentTask: "Vectorizing incoming data streams from regional node clusters...", taskLabel: "Current Task", metricLabel: "BUFF_LOAD", metricValue: "12.8%", progress: 12.8 },
  { id: "V-001-X", name: "Nova_Prime", agentCode: "V-001-X", icon: "warning", status: "critical", statusLabel: "Critical", currentTask: "Memory leak detected in neural pruning sub-routine. Throttling active.", taskLabel: "Issue Detected", metricLabel: "STATUS", metricValue: "THROTTLED", progress: 100, isError: true },
  { id: "O-442-M", name: "Orion_7", agentCode: "O-442-M", icon: "model_training", status: "active", statusLabel: "Active", currentTask: "Training localized LLM on proprietary research documents...", taskLabel: "Current Task", metricLabel: "EPOCH_3", metricValue: "45.0%", progress: 45 },
  { id: "S-119-Z", name: "Sentinel_V", agentCode: "S-119-Z", icon: "security", status: "patrolling", statusLabel: "Patrolling", currentTask: "Monitoring external API gateway for anomalous injection attempts.", taskLabel: "Current Task", metricLabel: "UPTIME", metricValue: "99.9%", progress: 99.9 },
];

export const agentDetails: Record<string, AgentDetail> = {
  "N-904-B": {
    id: "N-904-B", name: "Epsilon_7", agentCode: "0x4F2E9...A1", icon: "memory",
    status: "active", statusLabel: "Active Status", role: "Autonomous Research Architect",
    model: "Claude 3.5 Sonnet", thinkingLevel: "High",
    coreDirective: "Operate within a zero-trust framework to synthesize complex market data into actionable quarterly reports. Prioritize depth over speed, and maintain an objective, academic tone in all communications.",
    assignedProject: "Marketing Automation", uptime: "14d 6h 32m", latency: "142ms",
    computeLoad: 42, reliability: 99.8,
    skills: [
      { name: "Recursive Web Synthesis", enabled: true },
      { name: "Cross-Agent Communication (CAC)", enabled: false },
      { name: "Cryptographic Validation", enabled: true },
      { name: "Self-Correction Loop", enabled: true },
    ],
    history: [
      { task: "Market Sentiment Sync", date: "Oct 24, 14:22", status: "success" },
      { task: "PDF Data Extraction", date: "Oct 23, 09:15", status: "fail" },
      { task: "API Handshake: Stripe", date: "Oct 22, 18:40", status: "success" },
      { task: "Token Limit Warning", date: "Oct 21, 11:05", status: "success" },
      { task: "Vector Database Re-index", date: "Oct 21, 04:00", status: "success" },
    ],
  },
  "K-221-A": {
    id: "K-221-A", name: "Kyros_Delta", agentCode: "0x7B3D1...C4", icon: "cloud_sync",
    status: "syncing", statusLabel: "Syncing", role: "Data Vectorization Specialist",
    model: "Claude 3 Haiku", thinkingLevel: "Low",
    coreDirective: "Maintain continuous data pipeline integrity across regional node clusters. Optimize for throughput while ensuring zero data loss during vectorization passes.",
    assignedProject: "Neural Sync Engine", uptime: "30d 0h 14m", latency: "24ms",
    computeLoad: 13, reliability: 99.9,
    skills: [
      { name: "Vector Embedding", enabled: true },
      { name: "Stream Processing", enabled: true },
      { name: "Data Normalization", enabled: true },
      { name: "Cross-Agent Communication (CAC)", enabled: true },
    ],
    history: [
      { task: "Regional Node Sync", date: "Oct 24, 14:21", status: "success" },
      { task: "Buffer Overflow Recovery", date: "Oct 23, 06:00", status: "success" },
      { task: "Pipeline Warm-up", date: "Oct 22, 12:00", status: "success" },
    ],
  },
  "V-001-X": {
    id: "V-001-X", name: "Nova_Prime", agentCode: "0x1A9E7...F2", icon: "warning",
    status: "critical", statusLabel: "Critical", role: "Neural Pruning Engine",
    model: "Claude 3 Opus", thinkingLevel: "Medium",
    coreDirective: "Execute precision neural pruning across tertiary hidden layers. Maintain classification head accuracy above 97% while reducing inference latency on ARM-based edge devices.",
    assignedProject: "Neural Sync Engine", uptime: "2d 14h 8m", latency: "ERR",
    computeLoad: 98, reliability: 62.1,
    skills: [
      { name: "Neural Pruning", enabled: true },
      { name: "Weight Optimization", enabled: true },
      { name: "Model Compression", enabled: false },
      { name: "Edge Deployment", enabled: false },
    ],
    history: [
      { task: "Memory Leak Detection", date: "Oct 24, 14:20", status: "fail" },
      { task: "Layer 14 Pruning Cycle", date: "Oct 24, 14:15", status: "fail" },
      { task: "Baseline Calibration", date: "Oct 23, 22:00", status: "success" },
    ],
  },
  "O-442-M": {
    id: "O-442-M", name: "Orion_7", agentCode: "0x8C4F0...D7", icon: "model_training",
    status: "active", statusLabel: "Active Status", role: "LLM Fine-tuning Specialist",
    model: "Claude 3.5 Sonnet", thinkingLevel: "High",
    coreDirective: "Fine-tune domain-specific language models on proprietary research corpora. Optimize for low perplexity while maintaining generalization across document types.",
    assignedProject: "Marketing Automation", uptime: "7d 2h 45m", latency: "89ms",
    computeLoad: 45, reliability: 99.2,
    skills: [
      { name: "Fine-tuning", enabled: true },
      { name: "Document Ingestion", enabled: true },
      { name: "Embedding Generation", enabled: true },
      { name: "Model Evaluation", enabled: true },
    ],
    history: [
      { task: "Epoch 3 Training", date: "Oct 24, 14:22", status: "success" },
      { task: "Checkpoint Save", date: "Oct 24, 14:18", status: "success" },
      { task: "Corpus Preprocessing", date: "Oct 23, 08:00", status: "success" },
    ],
  },
  "S-119-Z": {
    id: "S-119-Z", name: "Sentinel_V", agentCode: "0x3E2A9...B8", icon: "security",
    status: "patrolling", statusLabel: "Patrolling", role: "API Gateway Security Monitor",
    model: "Claude 3 Opus", thinkingLevel: "Normal",
    coreDirective: "Continuously monitor all external API gateway traffic for anomalous injection patterns, rate limit violations, and unauthorized access attempts. Zero false-negative tolerance.",
    assignedProject: "Neural Sync Engine", uptime: "60d 0h 0m", latency: "8ms",
    computeLoad: 12, reliability: 99.99,
    skills: [
      { name: "Threat Detection", enabled: true },
      { name: "Injection Analysis", enabled: true },
      { name: "Rate Limiting", enabled: true },
      { name: "Anomaly Flagging", enabled: true },
    ],
    history: [
      { task: "Routine Scan #4208", date: "Oct 24, 14:15", status: "success" },
      { task: "IP Block: 203.0.113.42", date: "Oct 24, 13:45", status: "success" },
      { task: "Gateway Certificate Renewal", date: "Oct 20, 00:00", status: "success" },
    ],
  },
};

export const systemLog: SystemLogEntry[] = [
  { timestamp: "14:20:01", level: "success", message: "Agent TX-702 completed subnet-optimization-task in \"Neural Sync Engine\"" },
  { timestamp: "14:19:42", level: "info", message: "Scaling resources for \"Marketing Automation\" +4 instances" },
  { timestamp: "14:18:55", level: "warning", message: "Latency spike detected in EU-West-1 cluster; failover protocol standby" },
  { timestamp: "14:15:20", level: "cleanup", message: "Archived logs for \"Legacy Scraper V2\" moved to deep storage" },
];

// ========================================
// Project Detail Data
// ========================================

export const projectDetails: Record<string, ProjectDetail> = {
  "proj-mkt-auto": {
    id: "proj-mkt-auto",
    name: "Marketing Automation",
    status: "live",
    projectId: "PRJ-MA-2024-0X",
    priority: "01_CRITICAL",
    workflowCount: 8,
    description:
      "Autonomous multi-agent orchestration designed for high-frequency cross-channel campaigns. Nova Protocol leverages specialized models for semantic brand alignment, dynamic budget allocation, and real-time narrative adaptation across global markets. Currently executing phase 04 of the 'Omni-Presence' roadmap.",
    metrics: {
      activeAgents: { current: 14, max: 20 },
      openTasks: 42,
      taskTrend: 12,
      completedTasks7d: 189,
      completedChart: [18, 24, 32, 28, 22, 35, 30],
      tokenCost: { total: 142.84, dailyAvg: 18.42 },
    },
    agents: [
      { agentId: "SIG-04", name: "Sigma-04", role: "Strategic Handoff Lead", status: "working", load: "24.2 t/s" },
      { agentId: "DEL-09", name: "Delta-9", role: "Creative Asset Synthesis", status: "idle", load: "0.0 t/s" },
      { agentId: "PSI-AL", name: "Psi-Alpha", role: "Semantic Integrity Monitor", status: "error", load: "ERR_CRIT" },
    ],
    events: [
      { timestamp: "2024.05.24 | 14:22:09", type: "task_completed", title: "Task Finalized", description: "[Sigma-04] Completed sub-routine \"Asset_Vetting_X2\". Integrity score: 0.98." },
      { timestamp: "2024.05.24 | 14:18:55", type: "handoff", title: "Agent Handoff", description: "Narrative context migrated from [Delta-9] to [Sigma-04]. Payload: 420kb." },
      { timestamp: "2024.05.24 | 13:50:12", type: "anomaly", title: "Anomaly Detected", description: "[Psi-Alpha] flagged semantic drift in \"Channel_C\" output. Manual audit required." },
      { timestamp: "2024.05.24 | 13:12:00", type: "routine", title: "Routine Sync", description: "Global knowledge graph updated. 12,400 new vectors ingested." },
    ],
  },
  "proj-codebase": {
    id: "proj-codebase",
    name: "Codebase Maintenance",
    status: "paused",
    projectId: "PRJ-CB-2024-02",
    priority: "02_HIGH",
    workflowCount: 3,
    description:
      "Automated code quality enforcement and dependency management across 14 repositories. Handles vulnerability scanning, dependency updates, dead code elimination, and test coverage monitoring.",
    metrics: {
      activeAgents: { current: 0, max: 8 },
      openTasks: 12,
      taskTrend: -5,
      completedTasks7d: 0,
      completedChart: [8, 12, 6, 0, 0, 0, 0],
      tokenCost: { total: 0, dailyAvg: 0 },
    },
    agents: [
      { agentId: "COD-01", name: "CodeScan-1", role: "Vulnerability Analysis", status: "idle", load: "0.0 t/s" },
      { agentId: "COD-02", name: "DepBot-2", role: "Dependency Management", status: "idle", load: "0.0 t/s" },
    ],
    events: [
      { timestamp: "2024.05.10 | 09:00:00", type: "routine", title: "System Paused", description: "All agents suspended by admin. Reason: resource reallocation." },
    ],
  },
  "proj-neural-sync": {
    id: "proj-neural-sync",
    name: "Neural Sync Engine",
    status: "live",
    projectId: "PRJ-NS-2024-03",
    priority: "01_CRITICAL",
    workflowCount: 12,
    description:
      "High-throughput neural synchronization pipeline coordinating 64 parallel agent instances for real-time data ingestion, pattern recognition, and distributed model inference across multi-region clusters.",
    metrics: {
      activeAgents: { current: 64, max: 64 },
      openTasks: 156,
      taskTrend: 28,
      completedTasks7d: 1024,
      completedChart: [120, 145, 160, 138, 155, 148, 158],
      tokenCost: { total: 892.16, dailyAvg: 127.45 },
    },
    agents: [
      { agentId: "NSE-01", name: "SyncMaster", role: "Orchestration Lead", status: "working", load: "98.4 t/s" },
      { agentId: "NSE-02", name: "IngestPrime", role: "Data Pipeline Head", status: "working", load: "64.1 t/s" },
      { agentId: "NSE-03", name: "PatternWeave", role: "Recognition Engine", status: "working", load: "42.8 t/s" },
    ],
    events: [
      { timestamp: "2024.05.24 | 14:20:01", type: "task_completed", title: "Batch Complete", description: "[SyncMaster] Processed 2,400 inference requests. Avg latency: 12ms." },
      { timestamp: "2024.05.24 | 14:15:30", type: "routine", title: "Scaling Event", description: "Auto-scaled from 58 to 64 instances. Load threshold: 85%." },
    ],
  },
  "proj-legacy-scraper": {
    id: "proj-legacy-scraper",
    name: "Legacy Scraper V2",
    status: "archived",
    projectId: "PRJ-LS-2023-07",
    priority: "04_LOW",
    workflowCount: 0,
    description:
      "Decommissioned web scraping pipeline. All data has been migrated to the new ingestion system. Retained for audit purposes only.",
    metrics: {
      activeAgents: { current: 0, max: 0 },
      openTasks: 0,
      taskTrend: 0,
      completedTasks7d: 0,
      completedChart: [0, 0, 0, 0, 0, 0, 0],
      tokenCost: { total: 0, dailyAvg: 0 },
    },
    agents: [],
    events: [
      { timestamp: "2024.01.12 | 16:00:00", type: "routine", title: "Project Archived", description: "All resources deallocated. Final audit completed." },
    ],
  },
};

// ========================================
// Task Board Data
// ========================================

export const boardColumns: BoardColumn[] = [
  {
    id: "backlog",
    title: "Backlog",
    count: 8,
    accentColor: "outline-variant",
    tasks: [
      { id: "TASK-4021", title: "Define segmentation logic for Q4 retention campaign", priority: "low", assignedAgent: "Sigma-04" },
      { id: "TASK-4025", title: "Audit outdated email templates in Marketo sandbox", priority: "none", date: "Oct 24, 09:12" },
    ],
  },
  {
    id: "todo",
    title: "To Do",
    count: 3,
    accentColor: "secondary",
    tasks: [
      { id: "TASK-3988", title: "Optimize landing page conversion for \"Agent-X\" launch", priority: "urgent" },
    ],
  },
  {
    id: "in-progress",
    title: "In Progress",
    count: 2,
    accentColor: "tertiary",
    tasks: [
      { id: "TASK-3902", title: "Autonomous lead scoring engine deployment", priority: "high", assignedAgent: "Agent_Vulcan", progress: 64, progressLabel: "Agent Syncing" },
    ],
  },
  {
    id: "in-review",
    title: "In Review",
    count: 5,
    accentColor: "primary",
    tasks: [
      { id: "TASK-3844", title: "Brand voice alignment for social automation", priority: "none", comments: 12, attachments: 2 },
    ],
  },
  {
    id: "done",
    title: "Done",
    count: 42,
    accentColor: "outline-variant",
    dimmed: true,
    tasks: [
      { id: "TASK-3810", title: "Competitor keyword analysis for September", priority: "none" },
    ],
  },
];

export const boardAgents: BoardAgent[] = [
  { name: "VULCAN-7", status: "working", activity: "SCRAPING_DATA" },
  { name: "ORION-X", status: "idle", activity: "IDLE" },
  { name: "NOVA_9", status: "error", activity: "RECONNECTING" },
];

// ========================================
// Task Detail Data
// ========================================

export const taskDetails: Record<string, TaskDetail> = {
  "TASK-4021": {
    id: "TASK-4021",
    title: "Define segmentation logic for Q4 retention campaign",
    status: "backlog",
    statusLabel: "Backlog",
    description: [
      "Build the segmentation framework for Q4 retention targeting. Identify high-churn-risk cohorts using behavioral signals from the last 90 days and map them to personalized re-engagement flows.",
      "Cross-reference with the existing LTV model outputs. Ensure compatibility with the Marketo integration layer for automated campaign triggers.",
    ],
    priority: "Low",
    priorityColor: "outline",
    assignedAgent: { name: "Sigma-04", role: "Strategic Handoff Lead" },
    handoffAgent: null,
    workspace: "Marketing Automation / Retention",
    useGitWorktree: false,
    branch: null,
    gitWorktreePath: null,
    deadline: "Nov 15, 2024",
    attachments: [
      {
        id: "attachment-task-4012-1",
        name: "cohort_analysis_q3.pdf",
        size: "1.8 MB",
        type: "PDF Document",
        icon: "description",
        isImage: false,
        contentUrl: "#",
      },
    ],
    executionLog: [
      { icon: "add_circle", title: "Task created", description: "by System Orchestrator.", timeAgo: "3 days ago" },
    ],
  },
  "TASK-3988": {
    id: "TASK-3988",
    title: "Optimize landing page conversion for \"Agent-X\" launch",
    status: "todo",
    statusLabel: "To Do",
    description: [
      "Redesign the primary CTA section of the Agent-X product landing page. Current conversion rate sits at 2.1% — target is 4.5% by launch date.",
      "Run A/B tests on headline copy variations. Coordinate with the asset synthesis agent for generating visual alternatives. Ensure mobile-first approach with sub-3s load time.",
    ],
    priority: "Urgent",
    priorityColor: "error",
    assignedAgent: { name: "Delta-9", role: "Creative Asset Synthesis" },
    handoffAgent: null,
    workspace: "Marketing Automation / Campaigns",
    useGitWorktree: false,
    branch: null,
    gitWorktreePath: null,
    deadline: "Oct 28, 2024",
    attachments: [
      {
        id: "attachment-task-3988-1",
        name: "landing_wireframes_v2.fig",
        size: "4.2 MB",
        type: "Figma File",
        icon: "design_services",
        isImage: false,
        contentUrl: "#",
      },
      {
        id: "attachment-task-3988-2",
        name: "conversion_benchmark.csv",
        size: "312 KB",
        type: "Data File",
        icon: "data_object",
        isImage: false,
        contentUrl: "#",
      },
    ],
    executionLog: [
      { icon: "flag", title: "Priority escalated", description: "to Urgent by project lead.", timeAgo: "1 hour ago" },
      { icon: "sync", title: "Delta-9 assigned", description: "Resources allocated to Campaigns workspace.", timeAgo: "6 hours ago" },
      { icon: "add_circle", title: "Task created", description: "by System Orchestrator.", timeAgo: "2 days ago" },
    ],
  },
  "TASK-3902": {
    id: "TASK-3902",
    title: "Autonomous lead scoring engine deployment",
    status: "in_progress",
    statusLabel: "In Progress",
    description: [
      "Deploy the v3 lead scoring model to production. The engine uses a gradient-boosted ensemble trained on 18 months of conversion data to predict lead quality with 94% accuracy.",
      "Current sync progress at 64%. Agent Vulcan is handling the model weight distribution across edge nodes. Monitor for latency spikes during the rollout window.",
    ],
    priority: "Critical Path",
    priorityColor: "error",
    assignedAgent: { name: "Agent Vulcan", role: "Deployment & Orchestration" },
    handoffAgent: null,
    workspace: "Marketing Automation / Lead Ops",
    useGitWorktree: false,
    branch: null,
    gitWorktreePath: null,
    deadline: "Oct 24, 2024",
    attachments: [
      {
        id: "attachment-task-3902-1",
        name: "model_weights_v3.bin",
        size: "128 MB",
        type: "Binary Model",
        icon: "memory",
        isImage: false,
        contentUrl: "#",
      },
      {
        id: "attachment-task-3902-2",
        name: "deployment_runbook.md",
        size: "24 KB",
        type: "Markdown",
        icon: "description",
        isImage: false,
        contentUrl: "#",
      },
    ],
    executionLog: [
      { icon: "history", title: "Sync at 64%", description: "Weight distribution across 12 edge nodes in progress.", timeAgo: "20 min ago" },
      { icon: "sync", title: "Agent Vulcan assigned", description: "Resources allocated to Lead Ops workspace.", timeAgo: "5 hours ago" },
      { icon: "add_circle", title: "Task created", description: "by System Orchestrator.", timeAgo: "12 hours ago" },
    ],
  },
  "TASK-4025": {
    id: "TASK-4025",
    title: "Audit outdated email templates in Marketo sandbox",
    status: "backlog",
    statusLabel: "Backlog",
    description: [
      "Review all email templates in the Marketo sandbox environment. Identify templates that haven't been updated in 6+ months and flag those using deprecated merge fields.",
      "Generate a cleanup report with recommendations for archival vs. refresh. Coordinate with brand compliance before any deletions.",
    ],
    priority: "Medium",
    priorityColor: "secondary",
    assignedAgent: { name: "Unassigned", role: "Pending allocation" },
    handoffAgent: null,
    workspace: "Marketing Automation / Email Ops",
    useGitWorktree: false,
    branch: null,
    gitWorktreePath: null,
    deadline: "Dec 01, 2024",
    attachments: [],
    executionLog: [
      { icon: "add_circle", title: "Task created", description: "by System Orchestrator.", timeAgo: "5 days ago" },
    ],
  },
  "TASK-3844": {
    id: "TASK-3844",
    title: "Brand voice alignment for social automation",
    status: "in_review",
    statusLabel: "In Review",
    description: [
      "Validate that all automated social media posts generated by the content pipeline align with the updated brand voice guidelines (v4.2). Review tone, terminology, and visual style across 3 platforms.",
      "12 review comments pending resolution. 2 attachments with marked-up examples require sign-off from the brand team.",
    ],
    priority: "High",
    priorityColor: "tertiary",
    assignedAgent: { name: "Psi-Alpha", role: "Semantic Integrity Monitor" },
    handoffAgent: null,
    workspace: "Marketing Automation / Social",
    useGitWorktree: false,
    branch: null,
    gitWorktreePath: null,
    deadline: "Oct 30, 2024",
    attachments: [
      {
        id: "attachment-task-3844-1",
        name: "brand_voice_v4.2.pdf",
        size: "3.1 MB",
        type: "PDF Document",
        icon: "description",
        isImage: false,
        contentUrl: "#",
      },
      {
        id: "attachment-task-3844-2",
        name: "social_samples_marked.zip",
        size: "8.7 MB",
        type: "Archive",
        icon: "folder_zip",
        isImage: false,
        contentUrl: "#",
      },
    ],
    executionLog: [
      { icon: "rate_review", title: "Review started", description: "12 comments added by Psi-Alpha.", timeAgo: "4 hours ago" },
      { icon: "sync", title: "Psi-Alpha assigned", description: "Resources allocated to Social workspace.", timeAgo: "1 day ago" },
      { icon: "add_circle", title: "Task created", description: "by System Orchestrator.", timeAgo: "5 days ago" },
    ],
  },
  "TASK-3810": {
    id: "TASK-3810",
    title: "Competitor keyword analysis for September",
    status: "done",
    statusLabel: "Done",
    description: [
      "Completed analysis of competitor keyword strategies for September across 14 competitor domains. Identified 230 new keyword opportunities with combined monthly search volume of 45K.",
    ],
    priority: "Completed",
    priorityColor: "outline",
    assignedAgent: { name: "Sigma-04", role: "Strategic Handoff Lead" },
    handoffAgent: null,
    workspace: "Marketing Automation / SEO",
    useGitWorktree: false,
    branch: null,
    gitWorktreePath: null,
    deadline: "Sep 30, 2024",
    attachments: [
      {
        id: "attachment-task-3810-1",
        name: "keyword_report_sept.xlsx",
        size: "2.1 MB",
        type: "Spreadsheet",
        icon: "table_chart",
        isImage: false,
        contentUrl: "#",
      },
    ],
    executionLog: [
      { icon: "check_circle", title: "Task completed", description: "All deliverables reviewed and approved.", timeAgo: "2 weeks ago" },
      { icon: "history", title: "Analysis finalized", description: "230 keyword opportunities catalogued.", timeAgo: "2 weeks ago" },
      { icon: "add_circle", title: "Task created", description: "by System Orchestrator.", timeAgo: "4 weeks ago" },
    ],
  },
};
