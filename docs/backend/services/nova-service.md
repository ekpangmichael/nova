# NovaService

`NovaService` is the core orchestration service of the Nova backend. It lives in `apps/server/src/services/NovaService.ts` and implements all business logic for projects, agents, tasks, runs, runtime configuration, and dashboard aggregations.

## Construction

```ts
new NovaService({
  db: AppDatabase;
  env: AppEnv;
  runtimeManager: RuntimeManager;
  websocketHub: WebsocketHub;
})
```

NovaService holds references to the database, environment config, runtime manager (for dispatching runs), and the websocket hub (for broadcasting state changes).

## Bootstrap

`bootstrap()` is called once during app startup. It:

1. Creates required data directories: `appDataDir`, `attachmentsDir`, `logsDir`, `tempDir`, `agentHomesDir`.
2. Ensures the settings schema has all expected columns (safe `ALTER TABLE ADD COLUMN` with duplicate-column error handling).
3. Initializes the `settings` row if it does not exist, seeding it from environment defaults.
4. If a settings row exists, applies persisted runtime configuration back to the live `AppEnv`.
5. Reconciles incomplete runs -- any runs that were in an active state when the previous process crashed are cleaned up.

## Shutdown

`close()` unsubscribes from all active run event streams.

---

## Project Operations

### listProjects()

Returns all projects ordered by creation date. Each project includes computed counts: `assignedAgentCount`, `openTaskCount`, `backlogTaskCount`.

### getProject(projectId)

Returns a single project by ID with `assignedAgentIds`, `openTaskCount`, and `backlogTaskCount`.

Throws `404 not_found` if the project does not exist.

### createProject(input)

Creates a new project. Auto-generates a slug from the name if not provided. The `projectRoot` is normalized to an absolute path. Broadcasts `project.updated` over WebSocket.

Input fields:
- `name` (required) -- Project display name.
- `description` -- Optional description.
- `slug` -- Optional URL slug (auto-generated from name if omitted).
- `status` -- `active` (default), `paused`, or `archived`.
- `projectRoot` (required) -- Absolute path on the host filesystem.
- `seedType` -- `none` (default) or `git`.
- `seedUrl` -- Git clone URL when `seedType` is `git`.
- `tags` -- Array of string labels.

### patchProject(projectId, patch)

Partially updates a project. If `projectRoot` changes, updates all assigned agents' workspace symlinks via the runtime adapter. Broadcasts `project.updated`.

### deleteProject(projectId)

Deletes a project and cascades: stops all active runs, cleans up attachment files, removes run directories, clears agent state, and broadcasts `agent.updated` for affected agents.

### assignAgentToProject(projectId, agentId)

Creates a project-agent assignment. Ensures the agent's workspace has the project root available via the runtime adapter. Throws `409 conflict` if already assigned. Broadcasts `agent.updated`.

### unassignAgentFromProject(projectId, agentId)

Removes the assignment. Broadcasts `agent.updated`.

### getProjectActivity(projectId)

Returns recent activity items for a project: task creations, status changes, run completions, and comments.

### getProjectTasks(projectId)

Returns all tasks belonging to a project with their associated agent name, latest run status, and comment count.

---

## Agent Operations

### listAgents()

Returns all agents ordered by creation date.

### getAgent(agentId)

Returns a single agent by ID with full runtime configuration details.

Throws `404 not_found` if the agent does not exist.

### createAgent(input)

Creates a new agent. Auto-generates a slug from the name. Sets up the agent's home directory on disk via the runtime adapter. Configures runtime settings (kind, model, sandbox mode, thinking level).

Input fields:
- `name` (required) -- Agent display name.
- `role` (required) -- Short role description.
- `slug` -- Optional slug.
- `avatar` -- Optional avatar URL.
- `systemInstructions` -- Base system prompt.
- `personaText`, `userContextText`, `identityText`, `toolsText`, `heartbeatText`, `memoryText` -- Optional prompt sections.
- `runtime` -- Optional runtime configuration object:
  - `kind` -- `openclaw-native` (default), `codex`, or `claude-code`.
  - `runtimeAgentId` -- Runtime-specific agent identifier.
  - `workspacePath` -- Custom workspace path.
  - `runtimeStatePath` -- Custom state path.
  - `defaultModelId` -- Model to use for runs.
  - `modelOverrideAllowed` -- Whether users can override the model per-run.
  - `sandboxMode` -- `off`, `docker`, or `other`.
  - `defaultThinkingLevel` -- `off`, `minimal`, `low`, `medium`, `high`, `xhigh`.

Broadcasts `agent.updated`.

### patchAgent(agentId, patch)

Partially updates an agent. Supports updating any field including runtime configuration. Broadcasts `agent.updated`.

### deleteAgent(agentId)

Deletes an agent and cascades: stops active runs, removes agent home directory, cleans up project assignments and tasks, broadcasts updates.

### syncAgentHome(agentId)

Re-synchronizes the agent's home directory from all assigned project roots.

### getAgentTasks(agentId)

Returns all tasks assigned to an agent.

### getAgentRuns(agentId)

Returns all runs for an agent, ordered by most recent first.

---

## Task Operations

### createTask(input)

Creates a new task within a project assigned to a specific agent. Auto-generates an ID. Optionally sets up git branch context (branch name and URL). Broadcasts `task.created`.

Input fields:
- `projectId` (required) -- Parent project UUID.
- `title` (required) -- Task title.
- `description` -- Optional description text.
- `status` -- Initial status (defaults to `backlog`). One of: `backlog`, `todo`, `in_progress`, `in_review`, `done`, `failed`, `blocked`, `paused`, `canceled`.
- `priority` -- `critical`, `high`, `medium`, or `low`.
- `assignedAgentId` (required) -- Agent UUID.
- `executionTargetOverride` -- Optional alternate working directory.
- `dueAt` -- Optional ISO 8601 due date.
- `estimatedMinutes` -- Optional time estimate.
- `labels` -- Array of string labels.
- `createdBy` -- Display name of the creator (auto-set from auth session).

### getTask(taskId)

Returns a task by ID including project name, agent name, git context (branch name/URL), and associated data.

### patchTask(taskId, patch)

Partially updates a task. Broadcasts `task.updated`.

### deleteTask(taskId)

Deletes a task and cascades: stops active runs, removes attachment files, clears agent state if this was the agent's current task.

### addTaskComment(taskId, input)

Adds a comment to a task. Comments have an `authorType` (`user`, `agent`, `system`) and a `body`. User comments auto-set the `authorId` from the authenticated session. Broadcasts `task.updated`.

### getTaskComments(taskId)

Returns all comments on a task ordered by creation date.

### saveTaskAttachment(input)

Saves an uploaded file to the attachments directory under `{taskId}/{uuid}/{fileName}`. Returns the attachment record.

### getTaskRuns(taskId)

Returns all runs for a task, ordered by most recent first.

---

## Run Lifecycle

### startTask(taskId)

Starts execution of a task:

1. Validates the task is in a startable state.
2. Creates a `taskRuns` record with status `starting`.
3. Generates a runtime prompt from the task description, system instructions, and agent configuration.
4. Calls the appropriate runtime adapter to start the run.
5. Subscribes to the runtime's event stream.
6. Processes incoming events: logs, status changes, checkpoints, artifacts.
7. Updates the task and agent status to `in_progress`.
8. Broadcasts `run.created`, `task.updated`, and `agent.updated`.

### stopTask(taskId)

Stops execution of a running task:

1. Finds the active run for the task.
2. Calls the runtime adapter's `stopRun()`.
3. Waits for the event stream to drain.
4. Updates the run status to `stopped`.
5. Resets the task status to `todo` and the agent status to `idle`.
6. Broadcasts `run.updated`, `task.updated`, and `agent.updated`.

---

## Runtime Configuration

NovaService persists runtime settings (binary paths, state directories, config paths, default models) in the `settings` table. It provides methods for each supported runtime:

### OpenClaw
- `getOpenClawConfig()` -- Returns current config, detected config, and health.
- `testOpenClawConfig(input)` -- Probes a config without saving.
- `updateOpenClawConfig(input)` -- Persists config and reconfigures.
- `setOpenClawEnabled(enabled)` -- Enables or disables the runtime.

### Codex
- `getCodexConfig()`, `getCodexCatalog()`, `testCodexConfig(input)`, `updateCodexConfig(input)`, `setCodexEnabled(enabled)`.

### Claude Code
- `getClaudeConfig()`, `getClaudeCatalog()`, `testClaudeConfig(input)`, `updateClaudeConfig(input)`, `setClaudeEnabled(enabled)`.

### General
- `setupRuntime()` -- Runs the OpenClaw runtime setup process.
- `restartRuntime()` -- Restarts the OpenClaw process manager.

All runtime config changes broadcast `runtime.health` over WebSocket.

---

## Dashboard Aggregations

### getDashboardStats()

Returns summary counts: total projects, total agents, open tasks, completed tasks (last 7 days), failed tasks (last 7 days).

### getDashboardWorkingRuns(limit?)

Returns the most recent active runs with agent and task details. Default limit: 3.

### getDashboardActivity(limit?)

Returns recent activity items across all projects. Default limit: 6.

### getDashboardAttention(limit?)

Returns tasks that need attention: failed, blocked, or stale tasks. Default limit: 5.

---

## Monitor Endpoints

### getMonitorSummary()

Returns a runtime-level summary: agent count, project count, task breakdown by status, recent failure count.

### getMonitorActiveRuns()

Returns all currently active runs with their agent and task context.

### getMonitorRecentFailures()

Returns recently failed runs for investigation.

---

## Health

### getAppHealth()

Returns overall server health including runtime health status.

### getRuntimeHealth()

Delegates to `RuntimeManager.getHealth()` for the OpenClaw runtime health.
