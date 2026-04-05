# Schema Reference

This document describes every table in the Nova database, including column definitions, types, constraints, and relationships. All tables are defined in `packages/db/src/schema.ts` using Drizzle ORM's SQLite dialect.

## Conventions

- **Primary keys** are `text NOT NULL` columns holding application-generated UUIDs.
- **Timestamps** are stored as ISO 8601 strings in `text` columns.
- **Foreign keys** use `ON DELETE CASCADE` unless the relationship should prevent deletion (`ON DELETE RESTRICT`).
- **Type-narrowed columns** use Drizzle's `.$type<T>()` to constrain `text` columns to specific union types from `@nova/shared`.

---

## settings

Single-row table holding global application configuration. The primary key is always a fixed value.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NOT NULL | -- | Primary key (fixed value) |
| `mode` | text | NOT NULL | -- | Application mode. Always `"local"`. |
| `runtime_mode` | text | NOT NULL | `'mock'` | Active runtime mode: `"mock"` or `"openclaw"` |
| `openclaw_enabled` | integer (boolean) | NOT NULL | `true` | Whether the OpenClaw runtime is enabled |
| `openclaw_profile` | text | NOT NULL | -- | OpenClaw CLI profile name |
| `openclaw_binary_path` | text | NOT NULL | -- | Filesystem path to the OpenClaw binary |
| `openclaw_config_path` | text | NOT NULL | `''` | Path to the OpenClaw configuration file |
| `openclaw_state_dir` | text | NOT NULL | `''` | Path to the OpenClaw state directory |
| `codex_enabled` | integer (boolean) | NOT NULL | `true` | Whether the Codex runtime is enabled |
| `codex_binary_path` | text | NOT NULL | `'codex'` | Filesystem path to the Codex CLI binary |
| `codex_config_path` | text | NOT NULL | `''` | Path to the Codex configuration file |
| `codex_state_dir` | text | NOT NULL | `''` | Path to the Codex state directory |
| `codex_default_model` | text | YES | -- | Default model ID for Codex runs |
| `claude_enabled` | integer (boolean) | NOT NULL | `true` | Whether the Claude Code runtime is enabled |
| `claude_binary_path` | text | NOT NULL | `'claude'` | Filesystem path to the Claude Code CLI binary |
| `claude_config_path` | text | NOT NULL | `''` | Path to the Claude Code configuration file |
| `claude_state_dir` | text | NOT NULL | `''` | Path to the Claude Code state directory |
| `claude_default_model` | text | YES | -- | Default model ID for Claude Code runs |
| `gateway_url` | text | YES | -- | WebSocket URL for the OpenClaw gateway |
| `gateway_auth_mode` | text | NOT NULL | -- | Gateway authentication mode |
| `gateway_token_encrypted` | text | YES | -- | Encrypted gateway token |
| `app_data_dir` | text | NOT NULL | -- | Application data directory path |
| `created_at` | text | NOT NULL | -- | Row creation timestamp |
| `updated_at` | text | NOT NULL | -- | Last update timestamp |

**Indexes**: None beyond the primary key.

---

## users

Registered user accounts with email/password or Google OAuth credentials.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NOT NULL | -- | Primary key (UUID) |
| `email` | text | NOT NULL | -- | User email address |
| `display_name` | text | NOT NULL | -- | Display name shown in the UI |
| `password_hash` | text | NOT NULL | -- | Bcrypt or argon2 password hash |
| `google_sub` | text | YES | -- | Google OAuth subject identifier |
| `last_signed_in_at` | text | YES | -- | Timestamp of last successful sign-in |
| `created_at` | text | NOT NULL | -- | Row creation timestamp |
| `updated_at` | text | NOT NULL | -- | Last update timestamp |

**Indexes**:
- `users_email_unique` -- Unique index on `email`
- `users_google_sub_unique` -- Unique index on `google_sub`

---

## userSessions

Session tokens for authenticated users. Each row represents one active login session.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NOT NULL | -- | Primary key (UUID) |
| `user_id` | text | NOT NULL | -- | FK to `users.id` (CASCADE on delete) |
| `session_token_hash` | text | NOT NULL | -- | Hash of the session token |
| `expires_at` | text | NOT NULL | -- | Session expiration timestamp |
| `created_at` | text | NOT NULL | -- | Row creation timestamp |
| `updated_at` | text | NOT NULL | -- | Last update timestamp |

**Indexes**:
- `user_sessions_token_hash_unique` -- Unique index on `session_token_hash`
- `user_sessions_user_expiry_idx` -- Composite index on `(user_id, expires_at)`

**Foreign keys**:
- `user_id` references `users(id)` ON DELETE CASCADE

---

## projects

Top-level containers that group tasks and agents.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NOT NULL | -- | Primary key (UUID) |
| `slug` | text | NOT NULL | -- | URL-safe unique identifier |
| `name` | text | NOT NULL | -- | Human-readable project name |
| `description` | text | NOT NULL | -- | Project description |
| `status` | text | NOT NULL | -- | `ProjectStatus`: `"active"`, `"paused"`, `"archived"` |
| `project_root` | text | NOT NULL | -- | Relative path to the project root within an agent workspace |
| `seed_type` | text | NOT NULL | -- | `ProjectSeedType`: `"none"` or `"git"` |
| `seed_url` | text | YES | -- | Git clone URL when `seed_type` is `"git"` |
| `tags_json` | text | YES | -- | JSON array of tag strings |
| `created_at` | text | NOT NULL | -- | Row creation timestamp |
| `updated_at` | text | NOT NULL | -- | Last update timestamp |

**Indexes**:
- `projects_slug_unique` -- Unique index on `slug`

---

## agents

AI agent definitions. Each agent is bound to a specific runtime and has its own workspace on disk.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NOT NULL | -- | Primary key (UUID) |
| `slug` | text | NOT NULL | -- | URL-safe unique identifier |
| `name` | text | NOT NULL | -- | Agent display name |
| `avatar` | text | YES | -- | Avatar URL or emoji |
| `role` | text | NOT NULL | -- | Agent role description |
| `system_instructions` | text | NOT NULL | -- | System prompt given to the agent |
| `persona_text` | text | YES | -- | Agent persona definition |
| `user_context_text` | text | YES | -- | User context provided to the agent |
| `identity_text` | text | YES | -- | Agent identity file contents |
| `tools_text` | text | YES | -- | Tool configuration text |
| `heartbeat_text` | text | YES | -- | Heartbeat configuration |
| `memory_text` | text | YES | -- | Memory/context retention text |
| `runtime_kind` | text | NOT NULL | -- | `RuntimeKind`: `"openclaw-native"`, `"openclaw-acp"`, `"claude-code"`, `"codex"`, `"custom"` |
| `runtime_agent_id` | text | NOT NULL | -- | Identifier of the agent within its runtime |
| `agent_home_path` | text | NOT NULL | -- | Filesystem path to the agent's workspace |
| `runtime_state_path` | text | NOT NULL | `''` | Filesystem path to runtime-specific state |
| `model_provider` | text | YES | -- | Model provider identifier |
| `model_name` | text | YES | -- | Model name or ID |
| `model_override_allowed` | integer (boolean) | NOT NULL | `true` | Whether the model can be overridden per-run |
| `sandbox_mode` | text | NOT NULL | -- | `SandboxMode`: `"off"`, `"docker"`, `"other"` |
| `default_thinking_level` | text | NOT NULL | `'medium'` | `ThinkingLevel`: `"off"`, `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"` |
| `status` | text | NOT NULL | -- | `AgentStatus`: `"idle"`, `"working"`, `"paused"`, `"error"`, `"offline"` |
| `current_task_id` | text | YES | -- | ID of the task currently being worked on |
| `last_seen_at` | text | YES | -- | Last heartbeat or activity timestamp |
| `created_at` | text | NOT NULL | -- | Row creation timestamp |
| `updated_at` | text | NOT NULL | -- | Last update timestamp |

**Indexes**:
- `agents_slug_unique` -- Unique index on `slug`
- `agents_runtime_runtime_agent_id_unique` -- Unique composite index on `(runtime_kind, runtime_agent_id)`

---

## projectAgents

Many-to-many join table linking projects to the agents assigned to work on them.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NOT NULL | -- | Primary key (UUID) |
| `project_id` | text | NOT NULL | -- | FK to `projects.id` (CASCADE on delete) |
| `agent_id` | text | NOT NULL | -- | FK to `agents.id` (CASCADE on delete) |
| `created_at` | text | NOT NULL | -- | Row creation timestamp |

**Indexes**:
- `project_agents_project_agent_unique` -- Unique composite index on `(project_id, agent_id)`

**Foreign keys**:
- `project_id` references `projects(id)` ON DELETE CASCADE
- `agent_id` references `agents(id)` ON DELETE CASCADE

---

## tasks

Work items within a project, each assigned to an agent.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NOT NULL | -- | Primary key (UUID) |
| `task_number` | integer | NOT NULL | -- | Auto-assigned sequential number within the project |
| `project_id` | text | NOT NULL | -- | FK to `projects.id` (CASCADE on delete) |
| `title` | text | NOT NULL | -- | Task title |
| `description` | text | NOT NULL | -- | Full task description / prompt |
| `status` | text | NOT NULL | -- | `TaskStatus`: `"backlog"`, `"todo"`, `"in_progress"`, `"in_review"`, `"done"`, `"failed"`, `"blocked"`, `"paused"`, `"canceled"` |
| `priority` | text | NOT NULL | -- | `TaskPriority`: `"critical"`, `"high"`, `"medium"`, `"low"` |
| `assigned_agent_id` | text | NOT NULL | -- | FK to `agents.id` (RESTRICT on delete) |
| `execution_target_override` | text | YES | -- | Override path for execution, if different from project root |
| `resolved_execution_target` | text | NOT NULL | -- | Final resolved execution target path |
| `git_repo_root` | text | YES | -- | Git repository root path for this task |
| `git_branch_name` | text | YES | -- | Git branch name created for this task |
| `git_branch_url` | text | YES | -- | URL to the git branch (e.g., GitHub link) |
| `due_at` | text | YES | -- | Due date timestamp |
| `estimated_minutes` | integer | YES | -- | Estimated duration in minutes |
| `labels_json` | text | YES | -- | JSON array of label strings |
| `created_by` | text | NOT NULL | -- | Identifier of the user who created the task |
| `created_at` | text | NOT NULL | -- | Row creation timestamp |
| `updated_at` | text | NOT NULL | -- | Last update timestamp |

**Indexes**:
- `tasks_project_status_idx` -- Composite index on `(project_id, status)`
- `tasks_agent_status_idx` -- Composite index on `(assigned_agent_id, status)`

**Foreign keys**:
- `project_id` references `projects(id)` ON DELETE CASCADE
- `assigned_agent_id` references `agents(id)` ON DELETE RESTRICT

---

## taskDependencies

Directed dependency edges between tasks. A task cannot start until all tasks it depends on are complete.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NOT NULL | -- | Primary key (UUID) |
| `task_id` | text | NOT NULL | -- | FK to `tasks.id` -- the dependent task (CASCADE on delete) |
| `depends_on_task_id` | text | NOT NULL | -- | FK to `tasks.id` -- the prerequisite task (CASCADE on delete) |
| `created_at` | text | NOT NULL | -- | Row creation timestamp |

**Indexes**:
- `task_dependencies_unique` -- Unique composite index on `(task_id, depends_on_task_id)`

**Foreign keys**:
- `task_id` references `tasks(id)` ON DELETE CASCADE
- `depends_on_task_id` references `tasks(id)` ON DELETE CASCADE

---

## taskComments

Comments on tasks, authored by humans, agents, or the system.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NOT NULL | -- | Primary key (UUID) |
| `task_id` | text | NOT NULL | -- | FK to `tasks.id` (CASCADE on delete) |
| `task_run_id` | text | YES | -- | FK to `taskRuns.id` (SET NULL on delete). Links comment to a specific run. |
| `author_type` | text | NOT NULL | -- | `CommentAuthorType`: `"user"`, `"agent"`, `"system"` |
| `author_id` | text | YES | -- | User or agent ID of the author |
| `source` | text | NOT NULL | `'ticket_user'` | `TaskCommentSource`: `"ticket_user"`, `"agent_mirror"`, `"agent_api"`, `"system"` |
| `external_message_id` | text | YES | -- | Unique message ID from the runtime, used for deduplication |
| `body` | text | NOT NULL | -- | Comment body text |
| `created_at` | text | NOT NULL | -- | Row creation timestamp |

**Indexes**:
- `task_comments_task_created_idx` -- Composite index on `(task_id, created_at)`
- `task_comments_run_source_external_unique` -- Unique composite index on `(task_run_id, source, external_message_id)`

**Foreign keys**:
- `task_id` references `tasks(id)` ON DELETE CASCADE
- `task_run_id` references `taskRuns(id)` ON DELETE SET NULL

---

## taskAttachments

File attachments uploaded to a task.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NOT NULL | -- | Primary key (UUID) |
| `task_id` | text | NOT NULL | -- | FK to `tasks.id` (CASCADE on delete) |
| `file_name` | text | NOT NULL | -- | Original file name |
| `mime_type` | text | NOT NULL | -- | MIME type of the file |
| `relative_storage_path` | text | NOT NULL | -- | Path relative to the app data directory |
| `sha256` | text | NOT NULL | -- | SHA-256 hash of the file contents |
| `size_bytes` | integer | NOT NULL | -- | File size in bytes |
| `created_at` | text | NOT NULL | -- | Row creation timestamp |

**Foreign keys**:
- `task_id` references `tasks(id)` ON DELETE CASCADE

---

## taskRuns

Individual execution attempts for a task. Each time a task is started (or retried), a new run row is created.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NOT NULL | -- | Primary key (UUID) |
| `task_id` | text | NOT NULL | -- | FK to `tasks.id` (CASCADE on delete) |
| `attempt_number` | integer | NOT NULL | -- | Sequential attempt counter for this task |
| `agent_id` | text | NOT NULL | -- | FK to `agents.id` (RESTRICT on delete) |
| `runtime_kind` | text | NOT NULL | -- | `RuntimeKind` that executed this run |
| `runtime_session_key` | text | NOT NULL | -- | Session key used by the runtime adapter |
| `runtime_run_id` | text | YES | -- | Runtime-specific run identifier |
| `status` | text | NOT NULL | -- | `RunStatus`: `"requested"`, `"preparing"`, `"starting"`, `"running"`, `"completed"`, `"failed"`, `"aborted"` |
| `started_at` | text | YES | -- | Timestamp when the run began |
| `ended_at` | text | YES | -- | Timestamp when the run finished |
| `failure_reason` | text | YES | -- | Human-readable failure reason |
| `final_summary` | text | YES | -- | Summary text from the runtime on completion |
| `usage_json` | text | YES | -- | JSON object with token usage data |
| `created_at` | text | NOT NULL | -- | Row creation timestamp |
| `updated_at` | text | NOT NULL | -- | Last update timestamp |

**Indexes**:
- `task_runs_task_created_idx` -- Composite index on `(task_id, created_at)`
- `task_runs_agent_status_idx` -- Composite index on `(agent_id, status)`

**Foreign keys**:
- `task_id` references `tasks(id)` ON DELETE CASCADE
- `agent_id` references `agents(id)` ON DELETE RESTRICT

---

## runEvents

Ordered stream of events produced during a task run. Each event has a sequence number unique within its run.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NOT NULL | -- | Primary key (UUID) |
| `task_run_id` | text | NOT NULL | -- | FK to `taskRuns.id` (CASCADE on delete) |
| `seq` | integer | NOT NULL | -- | Sequence number within the run |
| `event_type` | text | NOT NULL | -- | Event type string (e.g., `"run.started"`, `"message.delta"`) |
| `payload_json` | text | NOT NULL | -- | JSON-encoded event payload |
| `created_at` | text | NOT NULL | -- | Row creation timestamp |

**Indexes**:
- `run_events_run_seq_unique` -- Unique composite index on `(task_run_id, seq)`

**Foreign keys**:
- `task_run_id` references `taskRuns(id)` ON DELETE CASCADE

---

## runArtifacts

Files produced or modified during a task run.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | text | NOT NULL | -- | Primary key (UUID) |
| `task_run_id` | text | NOT NULL | -- | FK to `taskRuns.id` (CASCADE on delete) |
| `path` | text | NOT NULL | -- | Filesystem path of the artifact |
| `kind` | text | NOT NULL | -- | `ArtifactKind`: `"input"`, `"output"`, `"modified"`, `"other"` |
| `label` | text | YES | -- | Human-readable label for the artifact |
| `summary` | text | YES | -- | Short description of the artifact |
| `mime_type` | text | YES | -- | MIME type of the artifact file |
| `sha256` | text | YES | -- | SHA-256 hash of the artifact contents |
| `size_bytes` | integer | YES | -- | Artifact file size in bytes |
| `created_at` | text | NOT NULL | -- | Row creation timestamp |

**Foreign keys**:
- `task_run_id` references `taskRuns(id)` ON DELETE CASCADE
