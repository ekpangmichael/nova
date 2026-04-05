# Project Structure

Nova is organized as a monorepo managed with **pnpm workspaces**. This page describes the directory layout and the role of each package.

---

## Top-Level Layout

```
nova/
  apps/
    server/          @nova/server       -- Fastify 5 API server
    web/             @nova/web          -- Next.js 16 web frontend
  packages/
    shared/          @nova/shared       -- Domain constants and TypeScript types
    db/              @nova/db           -- Drizzle ORM schema and SQLite layer
    runtime-adapter/ @nova/runtime-adapter -- Runtime adapter interface
    ui/              @nova/ui           -- Shared UI component library
  scripts/
    dev.mjs                             -- Orchestrates the dev environment
  docs/                                 -- Project documentation
  skills/                               -- Claude Code skill definitions
  .nova-data/                           -- Local runtime data (git-ignored)
  package.json                          -- Root workspace configuration
```

---

## Applications

### `apps/server` -- `@nova/server`

The backend API. Built with **Fastify 5** and TypeScript.

| Aspect | Detail |
| ------ | ------ |
| Framework | Fastify 5 with CORS, multipart, and WebSocket plugins |
| Database | SQLite via Drizzle ORM (`@nova/db`) |
| Validation | Zod 4 |
| Dev runner | `tsx watch src/index.ts` |
| Test runner | Vitest 3 |
| Default port | 4010 (dev), 4000 (env default) |

Key directories inside `apps/server/src/`:

```
src/
  index.ts              -- Entry point; boots the Fastify app
  env.ts                -- Environment variable schema and loader
  routes/               -- Route handlers (projects, agents, tasks, runtimes, etc.)
  services/             -- Business logic (NovaService, runtime managers)
    runtime/            -- Runtime process managers and adapters per runtime kind
  lib/                  -- Shared utilities (task files, task branches, etc.)
```

Workspace dependencies: `@nova/shared`, `@nova/db`, `@nova/runtime-adapter`.

### `apps/web` -- `@nova/web`

The frontend application. Built with **Next.js 16**, **React 19**, and **Tailwind CSS 4**.

| Aspect | Detail |
| ------ | ------ |
| Framework | Next.js 16.2 |
| React | 19.2 |
| Styling | Tailwind CSS 4 with `tailwind-merge` and `clsx` |
| Drag-and-drop | `@dnd-kit/core` and `@dnd-kit/sortable` |
| Markdown rendering | `react-markdown` with `remark-gfm` |
| Linter | ESLint with `eslint-config-next` |

Key directories inside `apps/web/src/`:

```
src/
  app/                  -- Next.js App Router pages
    (dashboard)/        -- Dashboard layout group
      page.tsx          -- Home dashboard
      projects/         -- Project list, board, and task detail views
      agents/           -- Agent list, create, and edit views
      runtimes/         -- Runtime management views
      settings/         -- Application settings
  components/
    board/              -- Kanban board, columns, task cards, agent bar
    layout/             -- Sidebar, top bar, browser notification manager
    task-detail/        -- Task detail screen, comments, metadata, execution log
  lib/
    api.ts              -- API client for the Fastify backend
    mock-data.ts        -- Mock data for development
  types/
    index.ts            -- Frontend-specific type definitions
```

---

## Packages

### `packages/shared` -- `@nova/shared`

Contains domain constants and TypeScript types shared across the server and any other package that needs them.

Exports include:

- Status enumerations: `PROJECT_STATUSES`, `AGENT_STATUSES`, `TASK_STATUSES`, `RUN_STATUSES`, `TASK_PRIORITIES`.
- Runtime constants: `RUNTIME_KINDS`, `THINKING_LEVELS`, `SANDBOX_MODES`.
- Record types: `ProjectRecord`, `AgentRecord`, `TaskRecord`, `TaskRunRecord`, `RunEventRecord`, and others.
- View types: `DashboardStats`, `MonitorSummary`, `RuntimeHealth`, `ActiveRunView`.
- WebSocket envelope types for real-time event broadcasting.

No runtime dependencies. Build output is plain JavaScript with TypeScript declarations.

### `packages/db` -- `@nova/db`

Defines the SQLite database schema using **Drizzle ORM** and provides the database client.

Tables:

| Table | Purpose |
| ----- | ------- |
| `settings` | Application-wide configuration (runtime paths, gateway settings) |
| `users` | User accounts with email and optional Google SSO |
| `user_sessions` | Session tokens for authentication |
| `projects` | Projects with status, project root path, and seed configuration |
| `agents` | Agent definitions with runtime binding, model config, and persona |
| `project_agents` | Many-to-many assignment of agents to projects |
| `tasks` | Tasks with status, priority, agent assignment, and git context |
| `task_dependencies` | Prerequisite relationships between tasks |
| `task_comments` | Threaded comments from users, agents, and the system |
| `task_attachments` | File attachments with integrity hashes |
| `task_runs` | Execution attempts with runtime session tracking |
| `run_events` | Ordered event stream per run |
| `run_artifacts` | Output files produced by runs |

Dependencies: `@nova/shared`, `drizzle-orm`, `@libsql/client`.

Migration files live in `packages/db/drizzle/` and are generated with `pnpm db:generate`.

### `packages/runtime-adapter` -- `@nova/runtime-adapter`

Defines the `RuntimeAdapter` interface that all runtime backends must implement. This is the boundary between Nova's core logic and external AI execution environments.

The interface covers:

- Health checks and capability discovery.
- Agent provisioning and workspace synchronization.
- Run lifecycle: start, stop, subscribe to events, send input.
- Session history loading.

Also exports supporting types: `RuntimeEvent`, `StartRunInput`, `RuntimeCatalog`, `RuntimeSummary`, and others.

Dependencies: `@nova/shared`.

### `packages/ui` -- `@nova/ui`

A shared UI component library. Currently a minimal TypeScript package that can be imported by the web frontend or other consumers.

No workspace dependencies.

---

## Dependency Graph

```
@nova/shared
    |
    +---> @nova/runtime-adapter
    |         |
    +---> @nova/db
    |         |
    |         +---> @nova/server
    |         |
    +--------+

@nova/ui (standalone)

@nova/web (standalone, calls @nova/server over HTTP)
```

The web frontend communicates with the server over HTTP and WebSocket. It does not import server-side packages directly.

---

## Scripts Directory

The `scripts/` directory contains tooling for the development environment.

- **`dev.mjs`** -- Orchestrates the full dev stack. Handles process cleanup, port management, health-check polling, and coordinated startup of the server and web frontend. See [Development Workflow](./development-workflow.md) for details.

---

## Data Directory

The `.nova-data/` directory (git-ignored) is created at the repository root when the server first starts. It contains:

- `db/app.db` -- SQLite database file.
- `attachments/` -- Uploaded task attachment files.
- `logs/` -- Server log files.
- `temp/` -- Temporary working files.
- `agent-homes/` -- Per-agent home directories managed by runtime adapters.

Override the location with the `NOVA_APP_DATA_DIR` environment variable.
