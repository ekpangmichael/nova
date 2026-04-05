# @nova/shared

**Package**: `packages/shared`
**Entry point**: `packages/shared/src/index.ts`

This package is the single source of truth for all domain constants, enum arrays, record types, and shared contracts used by both the frontend and backend.

## Application Constant

```typescript
export const APP_NAME = "Nova";
```

## Workspace Layout

Defines the canonical directory structure of the monorepo:

```typescript
export const WORKSPACE_LAYOUT = {
  web: "apps/web",
  server: "apps/server",
  shared: "packages/shared",
  db: "packages/db",
  runtimeAdapter: "packages/runtime-adapter",
  ui: "packages/ui",
} as const;
```

## Enum Arrays and Types

All enums are defined as `const` arrays with derived TypeScript union types. This pattern allows runtime validation (e.g., with Zod) while providing compile-time type safety.

### Project Status

```
"active" | "paused" | "archived"
```

### Agent Status

```
"idle" | "working" | "paused" | "error" | "offline"
```

### Task Status

```
"backlog" | "todo" | "in_progress" | "in_review" | "done" | "failed" | "blocked" | "paused" | "canceled"
```

### Run Status

```
"requested" | "preparing" | "starting" | "running" | "completed" | "failed" | "aborted"
```

### Task Priority

```
"critical" | "high" | "medium" | "low"
```

### Project Seed Type

```
"none" | "git"
```

### Sandbox Mode

```
"off" | "docker" | "other"
```

### Runtime Kind

```
"openclaw-native" | "openclaw-acp" | "claude-code" | "codex" | "custom"
```

### Thinking Level

```
"off" | "minimal" | "low" | "medium" | "high" | "xhigh"
```

### Comment Author Type

```
"user" | "agent" | "system"
```

### Task Comment Source

```
"ticket_user" | "agent_mirror" | "agent_api" | "system"
```

### Artifact Kind

```
"input" | "output" | "modified" | "other"
```

### Runtime Health State

```
"missing_binary" | "starting" | "healthy" | "degraded" | "error"
```

### WebSocket Event Type

```
"project.updated" | "task.created" | "task.updated" | "run.created" | "run.updated" | "run.event" | "agent.updated" | "runtime.health"
```

## JSON Utility Types

```typescript
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };
```

## Record Types

These represent the canonical shape of persisted entities. They map closely to the database schema.

### SettingsRecord

Global application settings including runtime binary paths, config paths, state directories, gateway configuration, and model defaults for OpenClaw, Codex, and Claude.

### ProjectRecord

Core project fields: `id`, `slug`, `name`, `description`, `status`, `projectRoot`, `seedType`, `seedUrl`, `tags`, timestamps.

### AgentRecord

Agent configuration: identity fields (`name`, `slug`, `avatar`, `role`), directive fields (`systemInstructions`, `personaText`, `userContextText`, `identityText`, `toolsText`, `heartbeatText`, `memoryText`), runtime binding (`runtimeKind`, `runtimeAgentId`, `agentHomePath`, `runtimeStatePath`, `modelProvider`, `modelName`, `modelOverrideAllowed`, `sandboxMode`, `defaultThinkingLevel`), and status fields.

### TaskRecord

Task fields: `id`, `taskNumber`, `projectId`, `title`, `description`, `status`, `priority`, `assignedAgentId`, `executionTargetOverride`, `resolvedExecutionTarget`, git context (`gitRepoRoot`, `gitBranchName`, `gitBranchUrl`), `dueAt`, `estimatedMinutes`, `labels`, `createdBy`, timestamps.

### TaskCommentRecord

Comment on a task: `authorType`, `authorId`, `authorLabel`, `source`, `externalMessageId`, `body`.

### TaskAttachmentRecord

File attachment: `fileName`, `mimeType`, `relativeStoragePath`, `sha256`, `sizeBytes`.

### TaskRunRecord

Execution run: `attemptNumber`, `agentId`, `runtimeKind`, `runtimeSessionKey`, `runtimeRunId`, `status`, timing fields, `failureReason`, `finalSummary`, `usage`.

### RunEventRecord

Streaming event within a run: `seq`, `eventType`, `payload`.

### RunArtifactRecord

File artifact produced by a run: `path`, `kind`, `label`, `summary`, `mimeType`, `sha256`, `sizeBytes`.

## View / DTO Types

These types represent aggregated or computed views used by API responses.

### ProjectActivityItem

Activity feed item for a project: `type` (comment/run/assignment), `title`, `message`.

### RuntimeHealth

Runtime health check result: `status`, `mode`, `profile`, paths, `binaryVersion`, `details` array.

### MonitorSummary

System-wide monitoring snapshot: runtime health, project/agent/task/run counts, agent status breakdown.

### DashboardStats

Lightweight dashboard counters: project counts, agent counts, open tasks, completed this week.

### DashboardWorkingRun

Active run with nested log entries for the dashboard's "Currently working" section.

### DashboardActivityItem

Activity feed item with actor label, status classification, and optional navigation href.

### DashboardAttentionItem

Issue requiring attention: `kind` (failed_run/blocked_task/agent_error), `severity`, action label.

### ActiveRunView / RecentFailureView

Monitor-specific views for active runs and recent failures.

### WebsocketEnvelope

Generic envelope for all WebSocket messages: `type`, `payload`, `sentAt`.
