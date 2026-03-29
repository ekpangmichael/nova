# Agent Project Manager v1 — Revised Architecture & Product RFC

## 1. Summary

This RFC revises the v1 architecture to match the intended OpenClaw-native model more closely.

The product is a **local-first web app** that can also be deployed as a private server install. The app is the **project-management control plane**. OpenClaw is the **runtime and automation plane**.

The biggest clarification is this:

- **Agent Home** = the runtime-owned persistent agent workspace.
- **Execution Target** = the folder/repo/path the agent should work on for a specific project or task.

In OpenClaw-native mode, the Agent Home should map directly to the real OpenClaw agent workspace. The execution target is then a **path inside that agent home** for v1.

This is the most important correction to the earlier RFC.

### Implementation update

The current repo now implements the first backend slice on this model:

- Fastify backend in `apps/server`
- Next.js 16 frontend in `apps/web`
- SQLite persistence through Drizzle
- shared domain types in `packages/shared`
- runtime adapter boundary in `packages/runtime-adapter`
- mock-first runtime execution with an OpenClaw-native skeleton

Current delivered scope is milestones 0-4 only:
- backend scaffold and boot
- projects, agents, assignments
- agent-home sync files
- tasks, comments, attachments
- start / stream / stop runs
- monitor and websocket events

Automations remain part of the target architecture in this RFC, but they are intentionally deferred past the current slice.

---

## 2. Design goals

### Primary goals

- Use OpenClaw as-is wherever it already solves the problem well.
- Avoid rebuilding runtime features that OpenClaw already provides.
- Keep the product model stable even if the runtime changes later.
- Make the UI feel like a project manager for AI agents, not just a wrapper around OpenClaw.
- Preserve room for future runtimes such as Codex CLI, Claude Code CLI, and ACP-backed runtimes.

### Non-goals for v1

- Hostile multi-tenant SaaS on one shared runtime.
- Full workflow engine / BPMN.
- Perfect runtime portability across all runtimes.
- True checkpoint-based pause/resume.
- Universal arbitrary filesystem targeting for every runtime.

---

## 3. Revised mental model

There are **four** separate concepts that must not be conflated.

### 3.1 Logical Agent

A product-level entity visible in the UI.

It has:
- name
- avatar
- role
- project memberships
- default model/provider preference
- UI labels and analytics
- allowed execution targets
- status derived from active runs

A Logical Agent is what the user manages.

### 3.2 Runtime Agent

A runtime-specific execution identity.

In OpenClaw-native mode, this is a real OpenClaw `agentId` with:
- its own agent workspace
- its own agentDir
- its own auth store
- its own sessions
- its own tools/sandbox policy
- its own model defaults

For v1, **one Logical Agent maps to one Runtime Agent** in OpenClaw-native mode.

### 3.3 Agent Home

The agent’s persistent runtime-owned home.

In OpenClaw-native mode, Agent Home maps directly to the OpenClaw agent workspace and contains the bootstrap/memory files such as:
- `AGENTS.md`
- `SOUL.md`
- `IDENTITY.md`
- `USER.md`
- `TOOLS.md`
- `MEMORY.md`
- `memory/YYYY-MM-DD.md`
- optional `HEARTBEAT.md`
- optional `skills/`

This is where the agent’s long-lived “mind” lives.

### 3.4 Execution Target

The directory or repo a project or task wants the agent to operate on.

Examples:
- a project repo root
- `/projects/marketing/site/`
- `/projects/backend/repo/services/api`
- a reports folder
- a task-specific subdirectory

This is **not** the same thing as Agent Home.

---

## 4. Core rule for v1

### 4.1 OpenClaw-native rule

For **OpenClaw-native runtime**, v1 should require:

> Every project default execution target and every task execution target must resolve to a path **inside the assigned agent’s OpenClaw workspace**.

This keeps the model aligned with OpenClaw instead of fighting it.

So the product should treat:
- Agent Home = OpenClaw workspace root
- Execution Target = relative path inside that home

### 4.2 Why this rule exists

OpenClaw uses a single agent workspace as the agent’s only working directory for file tools and workspace context. That means the clean native design is **one persistent home plus many subdirectories inside it**, not “one task arbitrarily changes the agent’s real workspace.”

### 4.3 Practical outcome

A single agent can still work on many different projects and many different task paths.

Example:

```text
/Users/michael/.openclaw/workspace-content-writer/
  AGENTS.md
  SOUL.md
  USER.md
  IDENTITY.md
  TOOLS.md
  MEMORY.md
  HEARTBEAT.md
  skills/
  memory/
  projects/
    marketing-automation/
      site/
      blog/
      assets/
    q1-reporting/
      data/
      drafts/
  .apm/
    tasks/
    runs/
    attachments/
```

Then:
- project default execution target = `projects/marketing-automation/blog`
- task execution target override = `projects/marketing-automation/blog/posts/q1-results`

The agent still has one native OpenClaw home, but tasks can operate in different subfolders.

---

## 5. Important terminology changes in the product spec

To avoid confusion, the UI and data model should rename a few things.

### Old term: Workspace
Too ambiguous.

It mixes together:
- OpenClaw’s real agent workspace
- project repo location
- task working directory

### New terms
Use these instead:

- **Agent Home** → the persistent OpenClaw workspace
- **Execution Target** → the folder/path/repo location where a task runs
- **Target Root** → the project-level default execution target
- **Target Path** → the task-level override path

### UI wording recommendation

- On the Agent page: **Agent Home**
- On the Project page: **Default Target Root**
- On the Task page: **Execution Target**

This makes the model much clearer.

---

## 6. Revised product scope for v1

### In scope

- Local-first web app
- Optional private server deployment
- Projects
- Agents
- OpenClaw-native agent homes
- Project target roots
- Task execution targets
- Kanban board
- Comments / notes
- Attachments
- Execution logs
- Start / stop / retry / reassign
- Native OpenClaw cron management UI
- Live monitoring dashboard
- Runtime abstraction layer

### Current implementation status

Already implemented in repo:
- local-first backend process
- projects
- agents
- project-agent assignments
- OpenClaw-style agent homes generated by the app
- project roots inside each agent home
- task execution targets inside each agent home
- comments and attachments
- execution logs and run history
- start / stop flow
- live monitoring endpoints
- websocket event broadcasting

Deferred from the broader RFC scope:
- retry / reassign
- native OpenClaw cron management UI
- automations
- real OpenClaw execution transport

### Out of scope

- Arbitrary external target paths for OpenClaw-native mode
- true portable pause/resume across runtimes
- public shared multi-tenant hosting
- end-user direct gateway access
- task engine built on top of cron

---

## 7. Control plane vs runtime plane

### 7.1 Your app owns

These stay in your database and backend:
- users
- auth/session for your app
- projects
- project membership
- logical agents
- task/ticket model
- kanban state
- labels
- comments
- attachments metadata
- analytics
- search/filtering
- dashboard projections
- billing/usage rollups
- runtime abstraction config

### 7.2 OpenClaw owns

These should be treated as runtime-native:
- runtime agents
- agent homes
- bootstrap files
- memory files
- sessions and transcripts
- tool execution
- model routing
- sandbox/tool policy
- native cron jobs
- channel delivery
- approvals/exec controls where used

### 7.3 Shared boundary

Your backend should be the **only** component that talks to OpenClaw directly.
The browser should never hold the OpenClaw gateway token.

---

## 8. Revised entity model

## 8.1 Projects

A Project remains a product-level container.

Fields:
- `id`
- `name`
- `description`
- `status`
- `default_target_root`
- `tags_json`
- `created_at`
- `updated_at`

Notes:
- `default_target_root` is a target path spec, not an OpenClaw workspace.
- In OpenClaw-native mode this should be stored as a **relative path inside the assigned agent home**, unless the runtime adapter says otherwise.

## 8.2 Agents

A Logical Agent remains user-facing.

Fields:
- `id`
- `name`
- `avatar`
- `role`
- `runtime_kind`
- `runtime_agent_ref`
- `default_model_provider`
- `default_model_name`
- `temperature`
- `token_budget`
- `max_concurrent_tasks`
- `status`
- `created_at`
- `updated_at`

Notes:
- `runtime_kind` examples: `openclaw-native`, `openclaw-acp-codex`, `openclaw-acp-claude`, `codex-cli-direct`, `claude-code-cli-direct`
- `runtime_agent_ref` is the runtime-specific identity such as OpenClaw `agentId`

## 8.3 Agent Homes

This is the runtime-owned persistent home definition for a Logical Agent.

Fields:
- `id`
- `agent_id`
- `runtime_kind`
- `home_path`
- `openclaw_agent_id` nullable
- `bootstrap_mode`
- `sandbox_mode`
- `sandbox_scope`
- `tool_profile`
- `enabled`
- `created_at`
- `updated_at`

For OpenClaw-native mode, `home_path` maps directly to the real OpenClaw workspace.

## 8.4 Agent Home Files

This is optional in the DB, but useful for your UI.

Fields:
- `id`
- `agent_home_id`
- `kind` (`AGENTS`, `SOUL`, `IDENTITY`, `USER`, `TOOLS`, `MEMORY`, `HEARTBEAT`, `SKILL`)
- `relative_path`
- `content_cache`
- `last_synced_at`

This lets your UI edit OpenClaw-native files while keeping OpenClaw itself the source of truth on disk.

## 8.5 Tasks

Fields:
- `id`
- `project_id`
- `title`
- `description`
- `status`
- `priority`
- `assigned_agent_id`
- `execution_target`
- `task_instructions`
- `due_at`
- `estimated_duration_minutes`
- `created_by`
- `created_at`
- `updated_at`

Notes:
- `execution_target` replaces the overloaded old `workspace` concept.
- In OpenClaw-native mode this should usually be a relative path within the agent home.

## 8.6 Automations

This is a separate entity from Tasks.

A native runtime automation should not be squeezed into the task model.

Fields:
- `id`
- `project_id` nullable
- `agent_id`
- `name`
- `kind` (`cron`)
- `runtime_kind`
- `runtime_job_ref`
- `session_target`
- `payload_kind`
- `payload_json`
- `delivery_json`
- `enabled`
- `created_at`
- `updated_at`

For OpenClaw-native mode, `runtime_job_ref` stores the OpenClaw `jobId`.

## 8.7 Task Runs

A Task Run remains product-owned and links into runtime sessions.

Fields:
- `id`
- `task_id`
- `agent_id`
- `runtime_kind`
- `runtime_session_ref`
- `runtime_run_ref` nullable
- `status`
- `execution_target_resolved`
- `started_at`
- `ended_at`
- `failure_reason`
- `final_summary`
- `usage_json`
- `created_at`

---

## 9. OpenClaw-native mapping

## 9.1 Agent page mapping

Your Agent page should become a structured editor over OpenClaw-native state.

### UI tabs
- Overview
- Identity
- Instructions
- Memory
- Skills
- Automations
- Sessions / History
- Analytics

### File-backed tabs
- Identity → `IDENTITY.md`
- Instructions → `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `USER.md`
- Memory → `MEMORY.md`, daily `memory/*.md`
- Heartbeat → `HEARTBEAT.md`
- Skills → `skills/`

### Important correction
If your current UI/spec uses names like `user.env` or `identity.env`, change them to OpenClaw-native file names:
- `USER.md`
- `IDENTITY.md`

That keeps the product aligned with the runtime.

## 9.2 Project mapping

A Project is app-owned, but should reference one or more target roots.

In v1, for OpenClaw-native mode, a target root should resolve to a relative path inside the assigned agent’s home.

Examples:
- `projects/marketing/site`
- `projects/engineering/repo`
- `projects/research/competitors`

## 9.3 Task mapping

A Task is app-owned.

At execution time, the backend composes:
- agent identity and runtime selection
- execution target
- task instructions
- attachments
- status wiring
- run/session linkage

The OpenClaw session remains runtime-owned.

## 9.4 Automation mapping

An Automation should map directly to an OpenClaw cron job.

Examples:
- check email every 10 minutes
- publish a digest every morning
- poll a repo for changes every hour
- run a persistent monitoring session

Your UI should manage:
- create/edit/delete
- enable/disable
- next run / last run
- delivery mode
- logs and status

OpenClaw remains the actual scheduler and executor.

---

## 10. Runtime capability abstraction

This is the main abstraction layer that keeps you portable later.

## 10.1 Core normalized concepts

Every runtime adapter must normalize these concepts:
- Agent Identity
- Agent Home
- Execution Target
- Session
- Run
- Automation Job
- Streaming Events
- Capabilities

## 10.2 Capability model

```ts
export interface RuntimeCapabilities {
  persistentAgentHome: boolean;
  nativeBootstrapFiles: boolean;
  nativeMemoryFiles: boolean;
  nativeCron: boolean;
  nativeChannels: boolean;
  streamingTranscript: boolean;
  streamingToolEvents: boolean;
  supportsStop: boolean;
  supportsPause: boolean;
  supportsResume: boolean;
  executionTargetMode:
    | "inside-agent-home"
    | "arbitrary-path"
    | "session-cwd-override"
    | "instruction-only";
}
```

## 10.3 v1 adapters

### `openclaw-native`
- persistentAgentHome = true
- nativeBootstrapFiles = true
- nativeMemoryFiles = true
- nativeCron = true
- streamingTranscript = true
- supportsStop = true
- supportsPause = false (emulated)
- supportsResume = false (emulated)
- executionTargetMode = `inside-agent-home`

### `openclaw-acp-codex`
- persistentAgentHome = partial/runtime-dependent
- nativeCron = true (through OpenClaw host)
- streamingTranscript = true
- supportsStop = true
- executionTargetMode = `session-cwd-override`

### `openclaw-acp-claude`
- same broad shape as ACP Codex
- executionTargetMode = `session-cwd-override`

### Direct CLI runtimes (future)
- likely executionTargetMode = `arbitrary-path`
- agent home semantics become app-emulated instead of runtime-native

---

## 11. V1 decision on execution targets

This is the cleanest rule set.

### For `openclaw-native`
- `execution_target` must resolve to a path inside Agent Home
- target may be blank → use project default target root
- project default target root may be blank → use a standard path such as `projects/<slug>`

### For ACP-backed runtimes
- `execution_target` may be an arbitrary host path if the runtime supports cwd override
- adapter converts target path into runtime `cwd`

### Validation rule

When a task is assigned to an agent, validate against the runtime capability:
- if mode is `inside-agent-home`, reject external paths
- if mode is `session-cwd-override`, allow external paths subject to policy
- if mode is `instruction-only`, store target but treat it as advisory only

---

## 12. Filesystem strategy for v1

## 12.1 OpenClaw-native directory layout per agent

```text
<agent-home>/
  AGENTS.md
  SOUL.md
  IDENTITY.md
  USER.md
  TOOLS.md
  MEMORY.md
  HEARTBEAT.md
  memory/
  skills/
  projects/
    <project-slug>/
      repo/
      docs/
      outputs/
  .apm/
    tasks/
    runs/
    attachments/
    logs/
```

## 12.2 Attachments

At task start:
- stage attachments under `.apm/attachments/<task-id>/`
- include references in task context
- optionally copy task-generated deliverables into `.apm/runs/<run-id>/outputs/`

## 12.3 Shared repos across multiple agents

OpenClaw-native v1 should avoid shared mutable repos mounted across multiple agent homes.

Safer v1 options:
- one clone per agent
- one worktree per agent
- read-only mirrors for reference data

This fits isolation better.

---

## 13. Run model

## 13.1 Task execution flow

1. User starts a task.
2. Backend resolves agent and runtime adapter.
3. Backend resolves execution target.
4. Backend validates target against runtime capabilities.
5. Backend stages task context under `.apm/tasks/<task-id>/`.
6. Backend creates a `task_run` row.
7. Backend starts runtime execution.
8. Backend subscribes to live runtime events.
9. Backend projects them into `run_events`.
10. UI streams from your backend, not from OpenClaw directly.

## 13.2 Task prompt contract

For OpenClaw-native mode, the prompt should explicitly state:
- the execution target relative path
- that the agent should work only under that target unless instructed otherwise
- where attachments are staged
- expected output location

Example:

```text
Task: Write the Q1 blog post.
Execution target: projects/marketing-automation/blog
Attachments: .apm/attachments/task_123/
Output path: projects/marketing-automation/blog/drafts/q1-results.md
Rules: Stay within the execution target unless you must read from shared assets.
```

This keeps tasks specific without pretending OpenClaw has a true per-task workspace primitive.

---

## 14. OpenClaw-native automations

## 14.1 Product position

Automations are **not task recurrence templates** in v1.
They are native runtime jobs.

The product should expose them directly as first-class objects.

## 14.2 OpenClaw cron job types to support

### Main-session jobs
Use for:
- heartbeat-driven reminders
- inbox check nudges
- maintenance signals

### Isolated `agentTurn` jobs
Use for:
- standalone periodic work
- report generation
- social posting
- scheduled repo checks
- custom persistent automation sessions

## 14.3 UI model for automations

Fields:
- name
- assigned agent
- schedule
- session target (`main`, `isolated`, `session:<id>`, `current` when relevant)
- payload message
- delivery mode (`none`, `announce`, `webhook`)
- target channel / webhook
- model override optional
- light context toggle
- status
- last run
- next run
- run history

## 14.4 Logs

The app should show:
- OpenClaw cron job metadata
- last N run log lines
- last summary
- error status
- link to related session/transcript when available

---

## 15. API design

## 15.1 App API

### Agents
- `GET /agents`
- `POST /agents`
- `GET /agents/:id`
- `PATCH /agents/:id`
- `GET /agents/:id/home`
- `PUT /agents/:id/home/files/:kind`

### Projects
- `GET /projects`
- `POST /projects`
- `GET /projects/:id`
- `PATCH /projects/:id`

### Tasks
- `GET /tasks`
- `POST /tasks`
- `GET /tasks/:id`
- `PATCH /tasks/:id`
- `POST /tasks/:id/start`
- `POST /tasks/:id/stop`
- `POST /tasks/:id/retry`
- `POST /tasks/:id/reassign`

### Automations
- `GET /automations`
- `POST /automations`
- `GET /automations/:id`
- `PATCH /automations/:id`
- `POST /automations/:id/enable`
- `POST /automations/:id/disable`
- `POST /automations/:id/run-now`
- `GET /automations/:id/runs`

### Realtime
- `GET /ws`

## 15.2 Runtime adapter interface

```ts
export interface RuntimeAdapter {
  kind: string;
  capabilities(): Promise<RuntimeCapabilities>;

  ensureAgentHome(input: EnsureAgentHomeInput): Promise<EnsureAgentHomeResult>;
  readAgentHomeFile(input: ReadAgentHomeFileInput): Promise<string>;
  writeAgentHomeFile(input: WriteAgentHomeFileInput): Promise<void>;

  validateExecutionTarget(input: ValidateExecutionTargetInput): Promise<ValidationResult>;

  startTaskRun(input: StartTaskRunInput): Promise<StartTaskRunResult>;
  stopRun(input: StopRunInput): Promise<void>;
  subscribeRun(input: SubscribeRunInput): Promise<UnsubscribeFn>;

  createAutomation(input: CreateAutomationInput): Promise<CreateAutomationResult>;
  updateAutomation(input: UpdateAutomationInput): Promise<void>;
  deleteAutomation(input: DeleteAutomationInput): Promise<void>;
  runAutomationNow(input: RunAutomationNowInput): Promise<void>;
  listAutomationRuns(input: ListAutomationRunsInput): Promise<AutomationRun[]>;
}
```

---

## 16. OpenClaw adapter design

## 16.1 Agent management

The OpenClaw adapter should manage a dedicated app-owned profile and config.

Responsibilities:
- ensure Gateway is running
- reconcile `agents.list[]`
- ensure workspaces exist
- ensure bootstrap files exist
- configure sandbox/tool profiles
- map logical agents to OpenClaw `agentId`s

## 16.2 Task runs

Preferred surfaces:
- start run via `/v1/responses` or `/v1/chat/completions`
- live updates via Gateway WebSocket or session subscriptions
- transcript/history follow for logs
- abort via control-plane methods

## 16.3 Automations

Preferred surfaces:
- `cron.add`
- `cron.update`
- `cron.remove`
- `cron.list`
- `cron.status`
- `cron.run`
- `cron.runs`

The product DB stores mirrors and references, but OpenClaw is the scheduler of record.

---

## 17. Updated UX recommendations

## 17.1 Agent screen

Show two clearly separated sections.

### Agent Home
- path
- memory files
- identity/instructions tabs
- skills
- heartbeat
- native automations

### Execution Access
- allowed target roots
- default target root
- project mappings
- runtime capability notes

## 17.2 Task form

Change these fields:

- **Assigned Agent**
- **Execution Target**
- **Use project default target** toggle
- **Task Instructions**
- **Attachments**

Add runtime hint text:
- “For OpenClaw-native agents, this target must be inside the agent home.”

## 17.3 Automation screen

Separate from Tasks.

Recommended columns:
- Name
- Agent
- Session Target
- Schedule
- Delivery
- Last Run
- Next Run
- Status

---

## 18. Revised V1 decisions

These are the concrete decisions I would lock in.

### Decision 1
Use OpenClaw-native agent homes directly.

### Decision 2
Do not emulate OpenClaw bootstrap files with your own parallel format.
Instead, expose and edit the native files in your UI.

### Decision 3
Treat task/project “workspace” as **execution target path**, not as a second OpenClaw workspace abstraction.

### Decision 4
For OpenClaw-native mode, execution targets must live inside the agent home in v1.

### Decision 5
Treat OpenClaw cron as a first-class native Automation feature in your app, not as task recurrence.

### Decision 6
Keep a runtime adapter boundary from day one so you can support:
- OpenClaw native
- OpenClaw ACP + Codex
- OpenClaw ACP + Claude Code
- direct Codex CLI later
- direct Claude Code CLI later

### Decision 7
The browser never talks directly to OpenClaw Gateway.

---

## 19. What changes from the earlier RFC

The earlier RFC assumed a stricter “runtime binding per workspace” design for OpenClaw-native mode.

That is no longer the preferred v1 design.

### Old assumption
- one runtime binding = one agent + one workspace
- task workspace override implied binding changes

### Revised assumption
- one logical agent = one OpenClaw runtime agent home
- projects and tasks specify execution target paths within that home
- automations map directly to OpenClaw cron
- runtime abstraction remains for future runtimes that support true cwd override

This revised version is more faithful to your intended product and more aligned with OpenClaw itself.

---

## 20. Final recommendation

For v1, build:
- your own web app backend and UI
- OpenClaw-native agent homes
- OpenClaw-native cron automations
- task/project execution targets as paths inside agent homes
- a runtime adapter interface that leaves room for ACP and direct CLI runtimes later

This gives you:
- strong alignment with OpenClaw
- much less runtime reimplementation work
- a cleaner UI model
- a future-safe abstraction boundary
