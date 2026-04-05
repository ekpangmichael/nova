# Nova Architecture Overview

Nova is a local-first control plane for managing autonomous AI coding agents. It
provides a web dashboard and API server that orchestrate one or more AI runtimes
-- each of which can execute tasks inside isolated working directories on the
developer's own machine.

The system is split into two logical planes:

```
+---------------------------------------------------------------+
|                        CONTROL PLANE                          |
|                                                               |
|  +---------------------------+   +-------------------------+  |
|  |       @nova/web           |   |     @nova/server        |  |
|  |   Next.js 16 frontend     |   |   Fastify 5 API + WS    |  |
|  |   React 19 + Tailwind 4   |   |   Drizzle ORM + SQLite   |  |
|  +------------+--------------+   +--------+--------+--------+  |
|               |  /api/backend/*           |        |           |
|               +-------proxy-------------->|        |           |
|                                           |        |           |
+-------------------------------------------|--------|----------+
                                            |        |
                            RuntimeAdapter  |        | WebSocket /ws
                            interface       |        |
+-------------------------------------------|--------|----------+
|                       EXECUTION PLANE     |        |           |
|                                           v        |           |
|  +-------------------+  +----------------+  +------+--------+ |
|  | OpenClaw Native   |  | Claude Code    |  | Codex         | |
|  | (openclaw-native) |  | (claude-code)  |  | (codex)       | |
|  +-------------------+  +----------------+  +---------------+ |
|                                                               |
|  Each runtime manages processes on the local machine,         |
|  executing tasks inside per-task Execution Target dirs.       |
+---------------------------------------------------------------+
```

## Monorepo Structure

Nova is a pnpm workspace monorepo. Every package is written in TypeScript and
compiled to ESM.

```
nova/
  apps/
    web/            @nova/web         Next.js 16 dashboard
    server/         @nova/server      Fastify 5 API server
  packages/
    shared/         @nova/shared      Domain constants, types, enums
    db/             @nova/db          Drizzle ORM schema + migrations (SQLite)
    runtime-adapter/ @nova/runtime-adapter  RuntimeAdapter interface contract
```

### Dependency Graph

```
@nova/web -----> (HTTP proxy) -----> @nova/server
                                        |
                                        +---> @nova/db
                                        |       |
                                        |       +---> @nova/shared
                                        |
                                        +---> @nova/runtime-adapter
                                                |
                                                +---> @nova/shared
```

`@nova/web` does not directly depend on any backend packages. It communicates
exclusively through the HTTP proxy route and a WebSocket connection.

`@nova/server` depends on all three packages: `@nova/db` for persistence,
`@nova/runtime-adapter` for the runtime boundary, and `@nova/shared` for domain
constants and record types.

`@nova/shared` is the leaf package with zero internal dependencies. It defines
all domain enums (task statuses, runtime kinds, etc.), record types, and
WebSocket envelope shapes.

## Two-Plane Separation

### Control Plane

The control plane is responsible for:

- **Project and agent management** -- CRUD for projects, agents, assignments,
  and tasks.
- **Task lifecycle** -- Status transitions through backlog, todo, in_progress,
  in_review, done, failed, blocked, paused, and canceled.
- **Run orchestration** -- Starting, streaming, and stopping runs by delegating
  to the appropriate runtime adapter.
- **Persistence** -- All state is stored in a local SQLite database via Drizzle
  ORM.
- **Real-time updates** -- WebSocket hub broadcasts events (task changes, run
  progress, agent status) to all connected dashboard clients.
- **Authentication** -- Session-based auth with cookie or header token.

### Execution Plane

The execution plane is the set of AI runtimes that actually perform coding work.
Nova does not embed any AI model itself. Instead, it delegates to external CLI
tools through the `RuntimeAdapter` interface.

Currently supported runtime kinds:

| Kind              | Adapter                   | CLI Binary    |
|-------------------|---------------------------|---------------|
| `openclaw-native` | `OpenClawNativeAdapter`   | `openclaw`    |
| `claude-code`     | `ClaudeRuntimeAdapter`    | `claude`      |
| `codex`           | `CodexRuntimeAdapter`     | `codex`       |

A `MockRuntimeAdapter` is also available for development and testing. When the
server's `RUNTIME_MODE` is set to `mock`, the OpenClaw slot uses the mock
adapter.

Each runtime adapter implements the full `RuntimeAdapter` interface defined in
`@nova/runtime-adapter`, which covers agent provisioning, workspace syncing, run
lifecycle (start/stop/stream), and session history.

## API Surface

The Fastify server mounts all routes under `/api`:

| Route Group   | Purpose                                    |
|---------------|--------------------------------------------|
| `/api/auth`   | Login, session management                  |
| `/api/health` | Server health check                        |
| `/api/runtimes` | Runtime listing, catalog, health          |
| `/api/system` | Global settings                            |
| `/api/projects` | Project CRUD                              |
| `/api/agents` | Agent CRUD and runtime provisioning         |
| `/api/tasks`  | Task CRUD, status transitions, attachments  |
| `/api/runs`   | Run start, stop, stream, events             |
| `/api/monitor` | Dashboard aggregate stats                  |

WebSocket events are broadcast on `/ws` to all authenticated connections.

## Further Reading

- [Design Philosophy](./design-philosophy.md)
- [Domain Model](./domain-model.md)
- [Data Flow](./data-flow.md)
- [Technology Stack](./technology-stack.md)
