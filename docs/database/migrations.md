# Migrations

Nova uses Drizzle ORM's built-in migration system to manage database schema changes. Migrations are forward-only SQL files applied in sequential order.

## Migration Infrastructure

### File Locations

| Path | Purpose |
|------|---------|
| `packages/db/drizzle/*.sql` | SQL migration files |
| `packages/db/drizzle/meta/_journal.json` | Migration journal tracking which migrations have been applied |
| `packages/db/src/client.ts` | Contains the `migrateDatabase()` function |
| `packages/db/src/schema.ts` | Current schema definition (source of truth for generating new migrations) |

### How Migrations Run

The `migrateDatabase()` function in `packages/db/src/client.ts` calls Drizzle's `migrate()` with the path to the migrations folder:

```typescript
export const migrateDatabase = async (db: AppDatabase) => {
  const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
  await migrate(db, { migrationsFolder });
};
```

Drizzle reads the journal file (`meta/_journal.json`) to determine which migrations have already been applied, then executes any pending migrations in order. Each migration file uses `-->statement-breakpoint` comments to separate individual SQL statements.

### Running Migrations

Migrations are applied at server startup. The Fastify server calls `migrateDatabase()` during its boot sequence. There is no separate CLI command to run migrations manually -- they are always applied automatically when the application starts.

To apply migrations after pulling new code:

```bash
# Migrations run automatically when the server starts
pnpm --filter @nova/server dev
```

## Migration History

The following migrations have been applied, listed in chronological order:

### 0000_warm_thing.sql -- Initial Schema

Creates the foundational tables for the application:

- `settings` -- Application-wide configuration (single row)
- `projects` -- Project containers with slug, name, status, project root
- `agents` -- AI agent definitions with runtime bindings
- `project_agents` -- Many-to-many join between projects and agents
- `tasks` -- Work items assigned to agents
- `task_dependencies` -- Directed dependency edges between tasks
- `task_comments` -- Comments on tasks (user, agent, or system authored)
- `task_attachments` -- File attachments on tasks
- `task_runs` -- Execution attempts for tasks
- `run_events` -- Ordered event streams within runs
- `run_artifacts` -- Files produced during runs

### 0001_openclaw_runtime_agent_fields.sql -- Runtime Agent Fields

Adds columns to support OpenClaw runtime agent configuration:

- Adds `runtime_state_path` to `agents` (defaults to agent home + `/.runtime-state`)
- Adds `default_thinking_level` to `agents` (defaults to `"medium"`)
- Replaces the simple `runtime_agent_id` unique index with a composite unique index on `(runtime_kind, runtime_agent_id)`, allowing the same agent ID across different runtimes

### 0002_task_runtime_bridge.sql -- Task-Run Comment Bridge

Extends comments and artifacts to support runtime integration:

- Adds `task_run_id` to `task_comments` -- links comments to specific runs
- Adds `source` to `task_comments` -- distinguishes between user comments, agent-mirrored messages, API comments, and system comments
- Adds `external_message_id` to `task_comments` -- deduplication key for runtime messages
- Creates index on `(task_id, created_at)` for comment ordering
- Creates unique index on `(task_run_id, source, external_message_id)` for deduplication
- Adds `label` and `summary` to `run_artifacts`

### 0003_auth.sql -- User Authentication

Introduces user account and session management:

- Creates `users` table with email, display name, password hash
- Creates `user_sessions` table with hashed session tokens and expiry
- Adds unique index on user email
- Adds unique index on session token hash
- Adds composite index on `(user_id, expires_at)` for session lookup

### 0004_auth_google.sql -- Google OAuth

Adds Google Sign-In support:

- Adds `google_sub` column to `users`
- Creates unique index on `google_sub` for OAuth subject lookup

### 0005_runtime_settings.sql -- Runtime Settings

Extends the settings table for multi-runtime configuration:

- Adds `runtime_mode` to `settings` (defaults to `"mock"`)
- Adds `openclaw_config_path` to `settings`
- Adds `openclaw_state_dir` to `settings`

### 0006_codex_runtime.sql -- Codex Runtime

Adds Codex CLI runtime settings:

- Adds `codex_binary_path` to `settings` (defaults to `"codex"`)
- Adds `codex_config_path` to `settings`
- Adds `codex_state_dir` to `settings`
- Adds `codex_default_model` to `settings`

### 0007_claude_runtime.sql -- Claude Code Runtime

Adds Claude Code CLI runtime settings:

- Adds `claude_binary_path` to `settings` (defaults to `"claude"`)
- Adds `claude_config_path` to `settings`
- Adds `claude_state_dir` to `settings`
- Adds `claude_default_model` to `settings`

### 0008_task_git_context.sql -- Task Git Context

Adds git branch tracking to tasks:

- Adds `git_repo_root` to `tasks`
- Adds `git_branch_name` to `tasks`
- Adds `git_branch_url` to `tasks`

### 0009_runtime_enabled.sql -- Runtime Enabled Flags

Adds per-runtime enable/disable toggles:

- Adds `openclaw_enabled` to `settings` (defaults to `true`)
- Adds `codex_enabled` to `settings` (defaults to `true`)
- Adds `claude_enabled` to `settings` (defaults to `true`)

## Migration Journal

The migration journal at `packages/db/drizzle/meta/_journal.json` tracks every migration with its index, version, timestamp, and tag. Drizzle uses this file to determine which migrations still need to be applied. The journal must not be edited manually.

## Creating New Migrations

To add a new migration:

1. Modify the schema in `packages/db/src/schema.ts`.
2. Generate the migration SQL using Drizzle Kit:
   ```bash
   pnpm --filter @nova/db drizzle-kit generate
   ```
3. Review the generated SQL file in `packages/db/drizzle/`.
4. The migration will be applied automatically on the next server start.

Migrations are forward-only. There is no built-in rollback mechanism. If a migration needs to be reversed, write a new migration that undoes the previous changes.
