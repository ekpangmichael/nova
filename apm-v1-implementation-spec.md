
# Agent Project Manager v1 — Implementation Specification

Version: 1.1  
Audience: implementation agent / engineering team  
Status: approved for v1 build; milestones 0-4 backend slice implemented  
Product mode: local-first web app, optionally deployable later as a private server install

---

## 1. Purpose

This document is the implementation contract for **Agent Project Manager v1**.

The goal is to build a **local-first web application** for managing AI agents, tasks, projects, live runs, and native OpenClaw automations. The app must feel like a project manager for agents, not just a thin wrapper around OpenClaw.

This spec intentionally narrows scope so an implementation agent can start immediately without needing to reinterpret product intent.

### Current repo reality

The current repository already contains the first backend vertical slice:

- `apps/server`: Fastify server with `/api` routes, `/ws`, runtime health, monitor endpoints, and task run lifecycle
- `apps/web`: Next.js 16 frontend prototype
- `packages/shared`: canonical shared enums and DTOs
- `packages/db`: Drizzle schema, client, and generated migrations
- `packages/runtime-adapter`: runtime adapter interfaces, mock adapter, and OpenClaw skeleton

Implemented scope to date:
- milestones 0-4 only
- SQLite persistence
- projects, agents, project-agent assignments
- agent home sync
- tasks, comments, attachments
- start / stream / stop runs
- monitor summaries and active-run views

Still deferred:
- automations
- retry / reassign flows
- real OpenClaw execution beyond process-manager and adapter skeletons

---

## 2. v1 decisions locked

These decisions are **not** open for interpretation in v1.

### 2.1 Runtime split
- **This app owns the product/control plane.**
- **OpenClaw owns the runtime/automation plane.**

The app is responsible for:
- projects
- tasks
- boards
- comments
- attachments metadata
- agent records
- activity views
- run history
- dashboards
- local persistence
- UI
- runtime abstraction layer

OpenClaw is responsible for:
- agent execution
- sessions
- transcripts
- tools
- model/provider abstraction
- per-agent home/workspace
- bootstrap memory files
- automation/cron execution
- live runtime events
- optional sandboxing

### 2.2 Terminology
The word **workspace** is too overloaded and must not be used generically in code or UI.

Use these terms instead:

- **Agent Home**  
  The real OpenClaw workspace for an agent. Persistent. Runtime-owned.

- **Project Root**  
  The default relative path under an agent home where that project’s files live.

- **Execution Target**  
  The relative path under the assigned agent home where a task should run.

- **Automation**  
  A first-class UI entity in this app that maps to a native OpenClaw cron job.

### 2.3 OpenClaw-native rule
For v1 native OpenClaw execution:
- every project root must resolve inside the assigned agent’s home
- every task execution target must resolve inside the assigned agent’s home
- tasks do **not** change the agent’s real OpenClaw home
- tasks only change the **target path inside that home**

### 2.4 Cron rule
Cron is **not** part of the task system in v1.

Recurring tickets/templates are out of scope for v1.

Instead:
- automations are separate entities in the app
- each automation maps 1:1 to an OpenClaw cron job
- the app displays and manages those jobs, runs, logs, and status

### 2.5 Auth rule
v1 is **single-user local mode**.
- No multi-user RBAC.
- No team permissions.
- No hosted SaaS assumptions.
- The same architecture may later support server deployment, but v1 ships as local-first single-user.

### 2.6 Agent concurrency rule
v1 agent concurrency is fixed at **1 active task per agent**.
- do not implement multi-task concurrency per agent in v1
- queueing is simple: if the agent is busy, new task start is rejected unless user stops the current run

### 2.7 Runtime portability rule
A runtime adapter abstraction must exist from the beginning. In the current repo, the delivered implementation is:

- `MockRuntimeAdapter` for normal development and tests
- `OpenClawNativeAdapter` skeleton for health/setup boundaries only

Planned later:
- OpenClaw ACP runtime adapter
- Claude Code runtime adapter
- Codex runtime adapter
- custom runtime adapter

---

## 3. Product scope

## 3.1 In scope
- local-first web app
- one backend process
- one frontend web app
- SQLite database
- local file storage for attachments/app data
- OpenClaw integration
- projects
- agents
- project-agent assignments
- tasks
- comments
- attachments
- kanban board
- task detail page
- agent detail/config page
- automation list/detail page
- live monitoring dashboard
- run history and logs
- start / stop / retry / reassign
- OpenClaw process bootstrap and health checks
- generated OpenClaw agent-home files
- project roots inside each agent home
- task execution targets inside each agent home
- basic usage/cost counters if runtime emits usage
- app-owned websocket for frontend realtime updates

### 3.1.1 Currently implemented subset

The current repo implements the first subset of the scope above:

- one backend process
- SQLite in WAL mode
- local file storage for attachments and app data
- projects
- agents
- project-agent assignments
- tasks
- comments
- attachments
- run history and logs
- start / stop
- OpenClaw process bootstrap and health checks
- generated agent-home files
- project roots inside each agent home
- execution targets inside each agent home
- app-owned websocket updates
- monitor summary, active runs, and recent failures endpoints

## 3.2 Out of scope
- team auth / RBAC
- public cloud multi-tenancy
- recurring task templates
- true pause/resume checkpoints
- approvals workflow
- human approval gates
- agent-to-agent handoff logic
- mobile UI
- rich billing
- external trigger marketplace
- cloud storage workspaces
- arbitrary external directories for OpenClaw-native mode
- multiple active tasks per agent
- direct browser access to OpenClaw Gateway
- editable plugin marketplace
- import/export beyond simple JSON backup

---

## 4. Target user experience

The user runs one local app, opens it in the browser, and sees:

- a project list
- a kanban board of tasks per project
- agents with status and current work
- live task runs with execution logs
- automations backed by OpenClaw cron
- the ability to configure agent homes using OpenClaw-native files
- project roots and task targets that point to directories inside the agent’s home

The user should not need to understand OpenClaw internals to use the app, but power users should still recognize native OpenClaw concepts.

---

## 5. Recommended tech stack

Lock this stack unless there is a strong reason not to.

### 5.1 Monorepo
- package manager: `pnpm`
- language: `TypeScript`
- repo layout:
  - `apps/web`
  - `apps/server`
  - `packages/shared`
  - `packages/runtime-adapter`
  - `packages/db`
  - `packages/ui`

### 5.2 Frontend
- React
- Next.js 16
- existing prototype routing/data patterns remain in place for now
- frontend migration is allowed later if there is a strong reason
- Zustand for small local UI state where already useful
- Tailwind CSS
- shadcn/ui or equivalent headless component primitives

### 5.3 Backend
- Fastify
- Zod for validation
- Drizzle ORM
- SQLite (WAL mode) for local mode
- node `ws` or Fastify websocket plugin for realtime updates
- controlled subprocess calls to `openclaw`

Implementation note:
- the current repo uses file-backed SQLite through `@libsql/client`
- this preserves the SQLite model while avoiding native build friction in the local environment

### 5.4 Files
- local disk storage under app data directory
- do not use S3 in v1

### 5.5 Testing
- Vitest
- Playwright for end-to-end browser tests
- integration test suite with a mocked runtime adapter
- optional smoke suite against a real OpenClaw installation

---

## 6. Architecture overview

```text
Browser UI
  -> App Server (REST + WS)
      -> SQLite
      -> App files / attachments
      -> Runtime Manager
          -> OpenClaw Process Manager
          -> OpenClaw Native Adapter
              -> Gateway HTTP (/v1/chat/completions, history SSE)
              -> Gateway WS / CLI control surfaces
              -> Agent Home files
              -> Cron jobs
```

### 6.1 Main architectural principle
The browser **never talks directly to OpenClaw**.

The app server is the only holder of:
- OpenClaw gateway URL
- gateway auth token/password
- process control
- local file system orchestration

### 6.2 Process ownership
The app server should be able to:
- detect whether OpenClaw is installed
- detect whether a dedicated app profile exists
- create/manage the dedicated profile if missing
- start the gateway if needed
- verify health
- stop/restart only when necessary

### 6.3 Local-first deployment
Default runtime topology on one machine:
- browser app on `http://127.0.0.1:<app-port>`
- app server on localhost
- OpenClaw Gateway on localhost
- SQLite on local disk
- attachments on local disk
- agent homes on local disk via OpenClaw profile

---

## 7. Core concepts and implementation rules

## 7.1 Agent Home
Each agent has one real OpenClaw home directory.

The app must expose editable fields that compile into native OpenClaw home files:
- `AGENTS.md`
- `SOUL.md`
- `USER.md`
- `IDENTITY.md`
- `TOOLS.md`
- optional `HEARTBEAT.md`
- optional `MEMORY.md`
- optional `skills/`

The app may also create its own app-owned folder inside the home:

```text
.apm/
  tasks/
  runs/
  inputs/
  outputs/
  cache/
```

### Rules
- Never store app DB state only inside the agent home.
- Agent home files are runtime context, not the canonical app database.
- The database is the canonical source of product state.
- The app mirrors selected DB fields into agent home files.

## 7.2 Project Root
Each project has one default target root string, for example:
- `projects/marketing-automation`
- `projects/backend-platform`
- `projects/research/q1`

This is a **relative path**, not an absolute path.

When an agent is assigned to a project:
- the backend ensures the project root exists inside that agent’s home
- if the project has a seed git URL, the backend clones it there if missing
- if the project has no seed repo, create the directory

Example resolution:

```text
agent.homePath = /Users/michael/.openclaw/workspace-content-writer
project.projectRoot = projects/marketing-automation
resolved path = /Users/michael/.openclaw/workspace-content-writer/projects/marketing-automation
```

## 7.3 Execution Target
A task has an optional execution target override.
- store it as a relative path string
- validate it is under the assigned agent’s home
- if missing, use the project root

Examples:
- `projects/marketing-automation`
- `projects/marketing-automation/blog/posts`
- `projects/backend-platform/services/api`

## 7.4 Agent assignment
A task must always have:
- exactly one assigned agent
- exactly one resolved execution target
- zero or more attachments
- zero or one active run at a time

## 7.5 Task vs Run
A task is a product object.
A run is one attempt to execute a task.

Rules:
- one task may have many runs
- retry = new run on same task
- reassign = new run on same task but different agent
- stop = terminal state for current run; task may remain open
- resume is out of scope as true checkpointing; do not implement

## 7.6 Automation
An automation is an app-level object that maps to a native OpenClaw cron job.

Automations are not tasks.
Automations are not converted into tickets in v1.
Automations have their own list/detail/log screens.

---

## 8. Runtime abstraction

Create a runtime adapter package now even though only one adapter ships.

### 8.1 Interface
```ts
export type RuntimeKind =
  | 'openclaw-native'
  | 'openclaw-acp'
  | 'claude-code'
  | 'codex'
  | 'custom';

export interface RuntimeCapabilities {
  kind: RuntimeKind;
  executionTargetMode: 'inside-agent-home' | 'runtime-cwd' | 'external';
  supportsStreaming: boolean;
  supportsStop: boolean;
  supportsRetry: boolean;
  supportsPause: boolean;
  supportsResume: boolean;
  supportsAutomations: boolean;
  supportsUsageMetrics: boolean;
}

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
  type:
    | 'run.accepted'
    | 'run.started'
    | 'message.delta'
    | 'message.completed'
    | 'tool.started'
    | 'tool.completed'
    | 'artifact.created'
    | 'usage'
    | 'warning'
    | 'error'
    | 'run.completed'
    | 'run.failed'
    | 'run.aborted';
  at: string;
  data: Record<string, unknown>;
}

export interface RuntimeAdapter {
  kind: RuntimeKind;
  getCapabilities(): Promise<RuntimeCapabilities>;
  ensureRuntimeReady(): Promise<void>;
  ensureAgentHome(agentId: string): Promise<void>;
  ensureProjectRoot(agentId: string, projectRoot: string, seed?: ProjectSeed | null): Promise<void>;
  startRun(input: StartRunInput): Promise<StartRunResult>;
  stopRun(runtimeSessionKey: string): Promise<void>;
  subscribeRun(runtimeSessionKey: string, onEvent: (event: RuntimeEvent) => void): Promise<() => Promise<void>>;
  listAutomations(agentId?: string): Promise<RuntimeAutomation[]>;
  createAutomation(input: CreateRuntimeAutomationInput): Promise<RuntimeAutomation>;
  updateAutomation(id: string, patch: UpdateRuntimeAutomationInput): Promise<RuntimeAutomation>;
  deleteAutomation(id: string): Promise<void>;
  runAutomationNow(id: string): Promise<{ runtimeRunId?: string | null }>;
  getAutomationRuns(id: string): Promise<RuntimeAutomationRun[]>;
}
```

### 8.2 v1 implementation
Implement now:
- `MockRuntimeAdapter`
- `OpenClawNativeAdapter` skeleton for health/setup boundaries

Stub but do not implement:
- `OpenClawAcpAdapter`
- `ClaudeCodeAdapter`
- `CodexAdapter`

---

## 9. OpenClaw native adapter design

## 9.1 Dedicated profile
The app uses a dedicated OpenClaw profile, e.g. `apm`.

The adapter must:
- set `OPENCLAW_PROFILE=apm` when launching commands
- keep runtime state isolated from the user’s personal/default OpenClaw setup
- manage one generated config for this profile

## 9.2 Installation assumptions
v1 assumes:
- `openclaw` binary is installed and available in `PATH`
- user has already installed providers/credentials as needed, or the app offers simple setup instructions
- app does not bundle OpenClaw

On app startup:
1. verify `openclaw --version`
2. verify gateway can be started
3. verify profile-specific workspace paths exist or can be created

## 9.3 Config generation
The app owns a generated config file for the dedicated profile.

The generated config must at minimum enable:
- gateway auth
- local bind
- chat completions endpoint
- optionally responses endpoint
- any required cron support
- any required sandbox settings

The app writes the generated config and applies/restarts only when needed.

Do not expose full raw config editing in v1.
Instead expose structured fields in the app UI and compile them into config.

## 9.4 Agent mapping
In v1:
- one app agent = one OpenClaw runtime agent

Store:
- `app agent id`
- `runtime kind = openclaw-native`
- `runtime agent id`
- `agent home path`
- `model default`
- `tools profile`
- `sandbox mode`
- `sandbox scope`

## 9.5 Agent home compilation
Given app agent settings, generate/update:
- `AGENTS.md` from system instructions + task execution guidance
- `SOUL.md` from persona/tone fields
- `IDENTITY.md` from display name, avatar reference, summary
- `USER.md` from user/operator context
- `TOOLS.md` from enabled tool policy summary
- `HEARTBEAT.md` optional if user configured it
- `MEMORY.md` optional
- custom skill files under `skills/`

## 9.6 Project root creation
When an agent is linked to a project:
- resolve `<agent home>/<projectRoot>`
- ensure path exists
- if `project.seedType = git`, clone repo if path missing
- if path exists and is a git repo, do not reclone
- optionally offer pull/sync action later, but not required for v1

## 9.7 Run startup transport
Use OpenClaw OpenAI-compatible HTTP as the primary start transport.

Preferred endpoint:
- `POST /v1/chat/completions`

Required request shape:
- `Authorization: Bearer <gateway token>`
- `model: "openclaw/<runtimeAgentId>"`
- `x-openclaw-session-key: <app-generated-session-key>`
- optional `x-openclaw-model`
- `stream: true`

The app controls the session key.
Format:
- default `apm:task:<runId>`

## 9.8 Run monitoring transport
Primary:
- `GET /sessions/{sessionKey}/history?includeTools=1&follow=1`

Fallback:
- gateway websocket subscription if implemented in adapter

The adapter must normalize runtime transcript/tool updates into app-owned run events.

## 9.9 Stop transport
Preferred:
- gateway websocket control or supported abort control for the session

Fallback:
- CLI command if necessary

The adapter contract only requires `stopRun()`. The implementation detail may use:
- Gateway control methods
- `/stop` routing
- CLI fallback

## 9.10 Automation transport
For v1, automation management may use one of these approaches:
1. Gateway control surface (`cron.*`) if straightforward to implement
2. CLI bridge using `openclaw cron ... --json`

Allowed v1 compromise:
- use CLI as the initial automation management bridge
- keep it behind `OpenClawNativeAdapter` so the rest of the app is unaware

---

## 10. Modules to implement

## 10.1 App shell
Responsibilities:
- boot app
- health checks
- settings load
- websocket connect
- global navigation

Views:
- `/`
- `/projects`
- `/projects/:projectId`
- `/tasks/:taskId`
- `/agents`
- `/agents/:agentId`
- `/automations`
- `/automations/:automationId`
- `/monitor`
- `/settings`

## 10.2 Projects module
Features:
- create project
- edit project
- archive project
- set project root
- optional seed git URL
- assign agents to project
- show project board
- show project activity feed

## 10.3 Agents module
Features:
- create agent
- edit agent
- archive/disable agent
- assign to projects
- configure model default
- configure instructions/persona
- configure tool summary
- configure heartbeat/memory text
- inspect agent home metadata
- show current status
- show task/run history
- show linked automations

## 10.4 Tasks module
Features:
- create task
- edit task
- set project
- set assigned agent
- set execution target override
- upload attachments
- add comments
- start
- stop
- retry
- reassign
- move status across board
- show execution log
- show artifacts/changed files summary
- show run history

## 10.5 Automations module
Features:
- create automation
- edit automation
- enable/disable
- delete
- run now
- show cron expression / schedule
- choose agent
- choose session mode
- choose delivery mode
- show recent run history
- show last status

## 10.6 Monitoring module
Features:
- currently running agents
- currently running tasks
- elapsed time
- last event time
- recent failures
- recent automation runs
- per-agent status
- per-project active counts

## 10.7 Settings module
Features:
- detect OpenClaw installation
- configure app data path
- show runtime health
- show gateway URL
- show active profile
- rotate/reload runtime
- export/import JSON backup (optional but recommended)
- provider setup links / instructions

---

## 11. Data model

Use Drizzle schema. Use UUIDs for all app-owned IDs.

## 11.1 Tables

### `settings`
Single-row settings table.

Columns:
- `id`
- `mode` (`local`)
- `openclaw_profile`
- `openclaw_binary_path`
- `gateway_url`
- `gateway_auth_mode`
- `gateway_token_encrypted`
- `app_data_dir`
- `created_at`
- `updated_at`

### `projects`
Columns:
- `id`
- `slug`
- `name`
- `description`
- `status` (`active`, `paused`, `archived`)
- `project_root` (relative path string)
- `seed_type` (`none`, `git`)
- `seed_url` nullable
- `tags_json` nullable
- `created_at`
- `updated_at`

Constraints:
- unique `slug`

### `agents`
Columns:
- `id`
- `slug`
- `name`
- `avatar` nullable
- `role`
- `system_instructions`
- `persona_text` nullable
- `user_context_text` nullable
- `identity_text` nullable
- `tools_text` nullable
- `heartbeat_text` nullable
- `memory_text` nullable
- `runtime_kind` default `openclaw-native`
- `runtime_agent_id`
- `agent_home_path`
- `model_provider` nullable
- `model_name` nullable
- `model_override_allowed` boolean default true
- `sandbox_mode` (`off`, `docker`, `other`)
- `status` (`idle`, `working`, `paused`, `error`, `offline`)
- `current_task_id` nullable
- `last_seen_at` nullable
- `created_at`
- `updated_at`

Constraints:
- unique `slug`
- unique `runtime_agent_id`

### `project_agents`
Columns:
- `id`
- `project_id`
- `agent_id`
- `created_at`

Constraints:
- unique `(project_id, agent_id)`

### `tasks`
Columns:
- `id`
- `task_number` integer autoincrement per project if desired
- `project_id`
- `title`
- `description`
- `status` (`backlog`, `todo`, `in_progress`, `in_review`, `done`, `failed`, `blocked`, `paused`, `canceled`)
- `priority` (`critical`, `high`, `medium`, `low`)
- `assigned_agent_id`
- `execution_target_override` nullable
- `resolved_execution_target`
- `due_at` nullable
- `estimated_minutes` nullable
- `labels_json` nullable
- `created_by` default `local-user`
- `created_at`
- `updated_at`

Indexes:
- `(project_id, status)`
- `(assigned_agent_id, status)`

### `task_dependencies`
Columns:
- `id`
- `task_id`
- `depends_on_task_id`
- `created_at`

Constraints:
- unique `(task_id, depends_on_task_id)`

### `task_comments`
Columns:
- `id`
- `task_id`
- `author_type` (`user`, `agent`, `system`)
- `author_id` nullable
- `body`
- `created_at`

### `task_attachments`
Columns:
- `id`
- `task_id`
- `file_name`
- `mime_type`
- `relative_storage_path`
- `sha256`
- `size_bytes`
- `created_at`

### `task_runs`
Columns:
- `id`
- `task_id`
- `attempt_number`
- `agent_id`
- `runtime_kind`
- `runtime_session_key`
- `runtime_run_id` nullable
- `status` (`requested`, `preparing`, `starting`, `running`, `completed`, `failed`, `aborted`)
- `started_at` nullable
- `ended_at` nullable
- `failure_reason` nullable
- `final_summary` nullable
- `usage_json` nullable
- `created_at`
- `updated_at`

Indexes:
- `(task_id, created_at desc)`
- `(agent_id, status)`

### `run_events`
Columns:
- `id`
- `task_run_id`
- `seq`
- `event_type`
- `payload_json`
- `created_at`

Constraints:
- unique `(task_run_id, seq)`

### `run_artifacts`
Columns:
- `id`
- `task_run_id`
- `path`
- `kind` (`input`, `output`, `modified`, `other`)
- `mime_type` nullable
- `sha256` nullable
- `size_bytes` nullable
- `created_at`

### `automations`
Columns:
- `id`
- `name`
- `description` nullable
- `agent_id`
- `enabled` boolean
- `cron_expression` nullable
- `one_shot_at` nullable
- `timezone` nullable
- `session_mode` (`main`, `isolated`, `current`, `custom`)
- `custom_session_key` nullable
- `delivery_mode` (`announce`, `none`, `webhook`)
- `delivery_channel` nullable
- `delivery_target` nullable
- `prompt`
- `light_context` boolean default false
- `runtime_automation_id`
- `last_run_at` nullable
- `last_status` nullable
- `created_at`
- `updated_at`

### `automation_runs`
Columns:
- `id`
- `automation_id`
- `runtime_run_id` nullable
- `status` (`queued`, `running`, `ok`, `skipped`, `error`)
- `started_at` nullable
- `ended_at` nullable
- `summary` nullable
- `raw_json` nullable
- `created_at`

---

## 12. File storage layout

Use one app data directory.

Suggested layout:

```text
<AppData>/
  db/
    app.db
  attachments/
    <taskId>/<attachmentId>-<fileName>
  exports/
  logs/
  temp/
```

Agent-home-generated app files may live inside the agent home:

```text
<agent home>/
  AGENTS.md
  SOUL.md
  IDENTITY.md
  USER.md
  TOOLS.md
  HEARTBEAT.md
  MEMORY.md
  skills/
  projects/
  .apm/
    runs/
      <runId>/
        TASK.md
        inputs/
        outputs/
```

### Rules
- App attachments are canonical in app data.
- Before a run starts, attachments needed for runtime may be copied or linked into `.apm/runs/<runId>/inputs/`.
- Never assume files in agent home are canonical product attachments.
- Compute sha256 for every stored attachment.

---

## 13. API contract

All API routes live under `/api`.

Return JSON only.

## 13.1 Health + runtime
- `GET /api/health`
- `GET /api/runtime/health`
- `POST /api/runtime/setup`
- `POST /api/runtime/restart`

## 13.2 Projects
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `PATCH /api/projects/:projectId`
- `POST /api/projects/:projectId/agents/:agentId`
- `DELETE /api/projects/:projectId/agents/:agentId`
- `GET /api/projects/:projectId/activity`

## 13.3 Agents
- `GET /api/agents`
- `POST /api/agents`
- `GET /api/agents/:agentId`
- `PATCH /api/agents/:agentId`
- `POST /api/agents/:agentId/sync-home`
- `GET /api/agents/:agentId/tasks`
- `GET /api/agents/:agentId/runs`

## 13.4 Tasks
- `GET /api/tasks/:taskId`
- `POST /api/tasks`
- `PATCH /api/tasks/:taskId`
- `POST /api/tasks/:taskId/comments`
- `POST /api/tasks/:taskId/attachments`
- `POST /api/tasks/:taskId/start`
- `POST /api/tasks/:taskId/stop`
- `POST /api/tasks/:taskId/retry`
- `POST /api/tasks/:taskId/reassign`
- `GET /api/tasks/:taskId/runs`
- `GET /api/tasks/:taskId/comments`

## 13.5 Runs
- `GET /api/runs/:runId`
- `GET /api/runs/:runId/events`
- `GET /api/runs/:runId/artifacts`

## 13.6 Automations
- `GET /api/automations`
- `POST /api/automations`
- `GET /api/automations/:automationId`
- `PATCH /api/automations/:automationId`
- `DELETE /api/automations/:automationId`
- `POST /api/automations/:automationId/run-now`
- `GET /api/automations/:automationId/runs`

## 13.7 Monitoring
- `GET /api/monitor/summary`
- `GET /api/monitor/active-runs`
- `GET /api/monitor/recent-failures`

## 13.8 Websocket
Single app websocket endpoint:
- `/ws`

Frontend subscribes to events:
- `project.updated`
- `task.created`
- `task.updated`
- `run.created`
- `run.updated`
- `run.event`
- `agent.updated`
- `automation.updated`
- `automation.run.updated`
- `runtime.health`

---

## 14. API validation rules

## 14.1 Path validation
For all project roots and execution targets:
- must be relative paths
- must not start with `/`
- must not contain `..`
- must normalize cleanly
- must resolve under the agent home
- reject invalid paths with 400

## 14.2 Task creation validation
- project must exist
- assigned agent must be linked to project
- resolved execution target must validate against agent home
- if dependencies are set, dependency task IDs must exist in same project

## 14.3 Task start validation
Before starting:
- task status must not be `done` or `canceled`
- no active run for task
- agent status must be `idle`
- dependency tasks must be `done`
- attachments must exist on disk
- runtime health must be `ok`

## 14.4 Automation validation
- exactly one of `cron_expression` or `one_shot_at`
- agent must exist
- prompt required
- timezone required for recurring jobs
- `custom_session_key` required if `session_mode = custom`

---

## 15. Run execution lifecycle

## 15.1 Start sequence
When `POST /api/tasks/:taskId/start` is called:

1. load task, project, agent, attachments
2. validate task can start
3. ensure agent home exists
4. ensure project root exists inside agent home
5. resolve execution target
6. stage run folder at `<agent home>/.apm/runs/<runId>/`
7. write `TASK.md`
8. copy attachments to run input folder if needed
9. create `task_runs` row with `status = preparing`
10. call runtime adapter `startRun()`
11. update run with session key / runtime run id
12. set run `status = running`
13. set task `status = in_progress`
14. set agent `status = working`, `current_task_id = task.id`
15. open runtime subscription
16. persist normalized run events
17. broadcast websocket updates to UI
18. on completion/failure, finalize run/task/agent state

## 15.2 TASK.md format
Write a deterministic task instructions file:

```md
# Task
Task ID: <taskId>
Run ID: <runId>
Project: <projectName>
Agent: <agentName>

## Goal
<task title>

## Description
<task description>

## Execution Target
<resolved relative path>

## Acceptance Criteria
- Complete the requested work inside the execution target
- Summarize files changed
- Report blockers clearly
- Do not touch files outside the execution target unless explicitly required

## Attachments
- <file 1>
- <file 2>

## Extra Instructions
<any task-specific instructions from user comments or fields>

## Required Final Output
Return:
1. a concise summary
2. changed files list
3. blockers or follow-up notes
```

The runtime prompt sent to OpenClaw should be short and stable, for example:

```text
Execute the task described in .apm/runs/<runId>/TASK.md.
First inspect the execution target and listed inputs.
Keep all work inside the execution target unless the task explicitly requires otherwise.
End with the required final output format.
```

## 15.3 Stop sequence
When `POST /api/tasks/:taskId/stop` is called:
1. load active run
2. call runtime adapter `stopRun(sessionKey)`
3. mark run `aborted`
4. set task status to `paused`
5. set agent status to `idle`
6. clear `current_task_id`
7. emit websocket updates

## 15.4 Retry sequence
When `POST /api/tasks/:taskId/retry` is called:
1. verify last run is terminal (`failed` or `aborted`)
2. create new run with incremented attempt
3. reuse same agent and execution target unless overridden
4. start as a fresh run

## 15.5 Reassign sequence
When `POST /api/tasks/:taskId/reassign` is called:
1. user supplies new agent ID
2. validate new agent is linked to same project
3. resolve target under new agent home
4. create new run for same task under new agent
5. old run remains in history
6. task continues with same task ID but new assigned agent

---

## 16. Runtime event normalization

The app must normalize runtime transcript events into app event types.

Suggested mapping:

- runtime accepted -> `run.accepted`
- first assistant output or first tool call -> `run.started`
- text delta -> `message.delta`
- final assistant message -> `message.completed`
- tool begin -> `tool.started`
- tool result -> `tool.completed`
- usage metadata -> `usage`
- runtime warning -> `warning`
- runtime error -> `error`
- terminal success -> `run.completed`
- terminal failure -> `run.failed`
- abort acknowledged -> `run.aborted`

Rules:
- `run_events.seq` must be monotonically increasing per run
- always store raw payload JSON
- derive UI projections from normalized events, not by parsing transcript on every page load

---

## 17. Task state machine

## 17.1 Task statuses
Use these statuses exactly:

- `backlog`
- `todo`
- `in_progress`
- `in_review`
- `done`
- `failed`
- `blocked`
- `paused`
- `canceled`

### Allowed automatic transitions
- `todo -> in_progress` on successful start
- `in_progress -> done` when run completes successfully and user has not chosen manual review mode
- `in_progress -> failed` when run fails
- `in_progress -> paused` when stopped
- `failed -> todo` on retry preparation
- `paused -> todo` if user manually resets

### Allowed manual transitions
- any non-terminal to `canceled`
- `done <-> in_review` by user
- `backlog <-> todo`
- `failed -> todo`
- `paused -> todo`
- `blocked -> todo`

## 17.2 Run statuses
Use these exactly:
- `requested`
- `preparing`
- `starting`
- `running`
- `completed`
- `failed`
- `aborted`

---

## 18. Automations / cron spec

## 18.1 Why automations are separate
Automations are native OpenClaw cron wrappers. They are not tickets and do not appear on the kanban board.

## 18.2 Automation fields
In the UI an automation must allow:
- name
- description
- assigned agent
- prompt
- schedule type:
  - recurring cron expression
  - one-shot datetime
- timezone
- session mode:
  - main
  - isolated
  - current
  - custom
- delivery mode:
  - announce
  - none
  - webhook (hidden/disabled in initial UI unless easy to support)
- light context toggle
- enabled toggle

## 18.3 Automation detail page
Must show:
- config
- enabled/disabled
- last run status
- next scheduled time if known
- recent runs
- raw runtime automation id
- actions:
  - enable
  - disable
  - run now
  - edit
  - delete

## 18.4 Automation sync
On create/update/delete:
- write to app DB first in pending state
- call runtime adapter
- on runtime success, persist runtime automation id and active status
- on runtime failure, show error and mark state unsynced

## 18.5 Automation runs
The app stores summarized run history from OpenClaw:
- queued
- running
- ok
- skipped
- error

Do not try to reconstruct full chat transcripts for automation runs in v1 unless straightforward.

---

## 19. UI specification

## 19.1 Main routes
- `/projects`
- `/projects/:projectId`
- `/tasks/:taskId`
- `/agents`
- `/agents/:agentId`
- `/automations`
- `/automations/:automationId`
- `/monitor`
- `/settings`

## 19.2 Project board
Must include:
- columns by task status
- task cards
- filters: agent, priority, label
- project agent strip
- quick add task
- open task detail drawer

Task card fields:
- title
- status
- priority
- assigned agent avatar/name
- execution target short path
- live timer if active
- failure badge if last run failed

## 19.3 Task detail
Must include:
- title and status
- description
- assigned agent selector
- project name
- execution target
- attachments list
- comments thread
- current run panel
- historical runs list
- actions:
  - start
  - stop
  - retry
  - reassign
  - change status

## 19.4 Agent detail
Must include tabs:
- Overview
- Config
- Home Files
- Task History
- Runs
- Automations

Fields/editors:
- name / avatar / role
- model default
- AGENTS instructions
- SOUL/persona text
- USER context
- TOOLS summary
- HEARTBEAT
- MEMORY
- project assignments

Read-only metadata:
- runtime agent id
- home path
- current status
- current task
- last run

## 19.5 Automations list/detail
List view:
- name
- agent
- enabled
- schedule summary
- last run status
- next run time
- actions menu

Detail view:
- full config
- recent runs
- raw runtime id
- edit/run now/enable-disable/delete

## 19.6 Monitor page
Cards or list grouped by:
- working
- idle
- errored

For working agents show:
- agent name
- current task
- project
- elapsed time
- last event
- quick stop button

Also show:
- recent failures
- recent automation runs
- runtime health badge

---

## 20. Realtime behavior

Frontend uses app websocket only.

### 20.1 Required realtime events
- task created/updated
- run started/updated/completed/failed/aborted
- new run event appended
- agent status changed
- automation run changed
- runtime health changed

### 20.2 Projection strategy
Do not stream raw OpenClaw transcript directly to the browser.
The server should:
- ingest runtime event
- persist normalized event
- emit compact websocket event to browser

The browser can request full run history on demand.

---

## 21. Security rules

## 21.1 Gateway isolation
- bind OpenClaw to localhost in v1
- do not expose Gateway directly to the browser
- store gateway token server-side only
- encrypt stored token at rest if possible

## 21.2 Path safety
- reject absolute execution target paths
- reject path traversal
- keep OpenClaw-native task targets inside agent homes

## 21.3 Tool policy
For v1, use conservative defaults.
Recommended:
- deny dangerous persistent control-plane tools on agents handling general tasks
- keep gateway control in backend, not the runtime task surface
- sandbox file-writing agents when practical

## 21.4 Attachment safety
- compute mime type
- compute sha256
- cap upload size
- disallow executable uploads from being auto-run

---

## 22. OpenClaw process manager

Implement a small service in the backend.

Responsibilities:
- verify binary present
- run `openclaw --version`
- launch gateway with dedicated profile
- detect health
- restart if config changed
- expose structured health to app UI

### 22.1 Health states
- `missing_binary`
- `starting`
- `healthy`
- `degraded`
- `error`

### 22.2 Health checks
Implement at least:
- process running check
- HTTP `/v1/models` or equivalent smoke check
- optional CLI status check

---

## 23. Suggested app directory/package structure

```text
repo/
  apps/
    server/
      src/
        index.ts
        app.ts
        routes/
        services/
          runtime/
            RuntimeManager.ts
            OpenClawProcessManager.ts
            adapters/
              OpenClawNativeAdapter.ts
          tasks/
          projects/
          agents/
          automations/
          monitor/
          attachments/
          websocket/
        db/
        lib/
    web/
      src/
        main.tsx
        routes/
        pages/
        components/
        hooks/
        stores/
  packages/
    db/
      src/schema.ts
      src/migrations/
    shared/
      src/types.ts
      src/contracts.ts
    runtime-adapter/
      src/index.ts
      src/types.ts
    ui/
      src/components/
```

---

## 24. Implementation milestones

## Milestone 0 — scaffold
Deliver:
- monorepo
- frontend shell
- backend shell
- SQLite wired
- Drizzle migrations
- websocket skeleton
- health route

Acceptance:
- app boots
- database initializes
- frontend talks to backend

## Milestone 1 — OpenClaw runtime bootstrap
Deliver:
- OpenClaw binary detection
- dedicated profile support
- process manager
- health endpoint
- adapter interface
- `OpenClawNativeAdapter` skeleton
- `/v1/models` smoke check

Acceptance:
- app can detect healthy/unhealthy runtime
- app can start/stop/restart runtime service
- settings page shows runtime health

## Milestone 2 — projects + agents
Deliver:
- projects CRUD
- agents CRUD
- project-agent assignment
- agent home compilation
- project root creation inside agent home

Acceptance:
- create project
- create agent
- assign agent to project
- inspect generated agent home files
- verify project root exists under agent home

## Milestone 3 — tasks basic
Deliver:
- tasks CRUD
- comments
- attachments upload
- board view
- task detail page
- execution target validation

Acceptance:
- create task
- view task in board
- add comment
- attach file
- execution target resolves under agent home

## Milestone 4 — start/stream/stop runs
Deliver:
- run startup path
- TASK.md generation
- runtime event normalization
- live execution log
- stop action
- agent status updates
- monitor page

Acceptance:
- start a task and see live updates
- stop a task and see terminal run state
- run history persists after refresh
- monitor view shows active task correctly

## Milestone 5 — retry / reassign / failure handling
Deliver:
- retry flow
- reassign flow
- failure projections
- artifacts summary
- recent failures widget

Acceptance:
- failed run can be retried
- task can be reassigned to another project agent
- agent status resets correctly after terminal states

## Milestone 6 — automations
Deliver:
- automations CRUD
- runtime sync
- run now
- recent automation runs
- enabled/disabled actions

Acceptance:
- create recurring automation
- create one-shot automation
- run automation now
- recent runs visible in UI

## Milestone 7 — polish + hardening
Deliver:
- validation cleanup
- path safety tests
- runtime recovery after restart
- empty/loading/error states
- backup/export
- end-to-end tests

Acceptance:
- app recovers after restart
- data persists
- integration smoke tests pass

---

## 25. Acceptance criteria for v1

v1 is complete when all of the following are true:

1. User can create a project with a project root.
2. User can create an agent and see/edit its OpenClaw-style home files.
3. User can assign the agent to the project.
4. User can create a task and choose an execution target relative to the agent home.
5. User can upload attachments and add comments to the task.
6. User can start the task and see a live execution log.
7. User can stop a task.
8. User can retry a failed task.
9. User can reassign a task to another project agent.
10. User can see agent status on a live monitor screen.
11. User can create and manage native OpenClaw automations.
12. Runtime health is visible and recoverable from the settings page.
13. All task and run history survives app restart.
14. The browser never needs direct OpenClaw credentials.

---

## 26. Non-functional requirements

- local startup under 10 seconds on a typical developer machine after first setup
- UI should remain usable with 5 projects, 20 agents, 500 tasks, 100 automations
- run event ingestion must be append-only and crash-safe
- no blocking synchronous file operations on hot request paths unless tiny
- all DB writes wrapped in service-layer transactions where appropriate
- API validation on every write route
- app should tolerate OpenClaw restarts and show degraded state rather than crashing

---

## 27. Testing requirements

## 27.1 Unit tests
Must cover:
- path validation
- target resolution
- state transition guards
- run lifecycle reducers/projections
- automation validation

## 27.2 Integration tests
Must cover:
- create project + agent + task
- start run with mocked adapter
- stop run
- retry run
- reassign run
- create automation
- sync automation
- runtime health transitions

## 27.3 End-to-end tests
Must cover at least:
- boot app
- create project
- create agent
- assign agent
- create task
- start task
- view live log
- stop task

Optional:
- real OpenClaw smoke tests gated behind env flag

---

## 28. Seed data and demo mode

Include optional dev seed script:
- 2 sample projects
- 3 sample agents
- 6 sample tasks
- 2 sample automations

Purpose:
- faster UI development
- easier demo/testing

---

## 29. Implementation notes for the coding agent

1. Prefer vertical slices over abstract overengineering.
2. Implement the runtime adapter boundary early.
3. Do not try to design for every future runtime now.
4. Keep task logic and automation logic separate.
5. The database is the source of truth for product state.
6. The agent home files are runtime context mirrors, not the source of truth.
7. Use explicit path normalization everywhere.
8. Make the OpenClaw integration thin and testable.
9. Persist raw event payloads even if the first UI does not use all of them.
10. Ship Milestone 4 as the first truly valuable end-to-end slice.

---

## 30. Explicit no-go decisions

Do not implement any of the following in v1 unless later approved:
- direct browser -> gateway auth
- recurring task generation
- multi-user auth
- arbitrary absolute task paths
- one task bound to multiple agents
- agent concurrency > 1
- automatic git sync/commit/push
- marketplace/plugin installation from UI
- real pause/resume checkpoints

---

## 31. Suggested first end-to-end slice

Build this first before broadening the feature set:

1. Create project
2. Create agent
3. Generate agent home files
4. Assign agent to project
5. Create one task
6. Start run
7. Stream log
8. Stop run
9. Persist history
10. Show in monitor

That slice proves the architecture.

---

## 32. Optional appendix: example resolved paths

Example:
- agent slug: `content-writer`
- home path: `~/.openclaw/workspace-content-writer`
- project root: `projects/marketing-automation`
- task target override: `projects/marketing-automation/blog/posts/q1-results`

Resolved:
- agent home = `~/.openclaw/workspace-content-writer`
- project directory = `~/.openclaw/workspace-content-writer/projects/marketing-automation`
- task target = `~/.openclaw/workspace-content-writer/projects/marketing-automation/blog/posts/q1-results`

---

## 33. Deliverable expected from implementation agent

The implementation agent should produce:
- working monorepo
- migrations
- backend services
- frontend pages
- runtime adapter
- OpenClaw bootstrap
- tests
- README with local setup steps

This spec is sufficient to begin implementation without additional product clarification.
