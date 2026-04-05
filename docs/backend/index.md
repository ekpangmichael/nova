# Nova Backend Overview

The Nova backend is a Fastify 5 HTTP server that orchestrates AI agent runtimes, manages projects and tasks, and provides real-time updates over WebSocket. It lives in `apps/server/` and is written in TypeScript.

## Architecture

```
apps/server/src/
  app.ts              -- App factory (createApp)
  env.ts              -- Environment loading and runtime path resolution
  routes/
    api.ts            -- Top-level route registration
    auth.ts           -- Authentication endpoints
    projects.ts       -- Project CRUD
    agents.ts         -- Agent CRUD
    tasks.ts          -- Task CRUD and lifecycle
    runs.ts           -- Run inspection
    runtimes.ts       -- Runtime configuration
    monitor.ts        -- Dashboard and monitor aggregation
    health.ts         -- Health and runtime control
    system.ts         -- System utilities
    agent-runtime.ts  -- Agent-to-server callback API (bearer token auth)
  services/
    AuthService.ts    -- Session-based authentication
    NovaService.ts    -- Core orchestration (projects, agents, tasks, runs)
    types.ts          -- AppServices type definition
    runtime/
      RuntimeManager.ts       -- Adapter routing for runtimes
      MockRuntimeAdapter.ts   -- Mock adapter for development
      OpenClawNativeAdapter.ts
      OpenClawProcessManager.ts
      CodexRuntimeAdapter.ts
      CodexProcessManager.ts
      ClaudeRuntimeAdapter.ts
      ClaudeProcessManager.ts
    websocket/
      WebsocketHub.ts -- Real-time broadcast over /ws
  lib/
    errors.ts         -- ApiError class and factory functions
    http.ts           -- Zod parse helpers
    passwords.ts      -- scrypt password hashing
    session-tokens.ts -- Session token generation and hashing
    paths.ts          -- Path normalization utilities
    task-file.ts      -- Task file and runtime prompt generation
    task-branch.ts    -- Git branch naming for tasks
    task-state.ts     -- Task status transition logic
    utils.ts          -- ID generation, slugification, timestamps
```

## Technology Stack

| Layer           | Technology                          |
| --------------- | ----------------------------------- |
| HTTP framework  | Fastify 5                           |
| Database        | SQLite via better-sqlite3 + Drizzle |
| Validation      | Zod                                 |
| WebSocket       | @fastify/websocket (ws)             |
| File upload     | @fastify/multipart                  |
| CORS            | @fastify/cors                       |

## Plugin System

The server uses the Fastify plugin architecture. All API routes are registered under the `/api` prefix through a single top-level plugin (`apiRoutes` in `routes/api.ts`). Each route module is a `FastifyPluginAsync` that gets registered into the app:

- `authRoutes` -- `/api/auth/*`
- `healthRoutes` -- `/api/health`, `/api/runtime/*`
- `runtimeRoutes` -- `/api/runtimes/*`
- `systemRoutes` -- `/api/system/*`
- `agentRuntimeRoutes` -- `/api/agent-runtime/*`
- `projectRoutes` -- `/api/projects/*`
- `agentRoutes` -- `/api/agents/*`
- `taskRoutes` -- `/api/tasks/*`
- `runRoutes` -- `/api/runs/*`
- `monitorRoutes` -- `/api/dashboard/*`, `/api/monitor/*`

## Service Layer

All business logic is concentrated in service classes. Route handlers are thin: they validate input with Zod and delegate to services. The services are:

- **AuthService** -- User sign-up, sign-in (password and Google OAuth), session management.
- **NovaService** -- The core orchestration service. Handles projects, agents, tasks, runs, dashboard aggregations, and runtime configuration persistence.
- **RuntimeManager** -- Routes runtime calls to the correct adapter (mock, OpenClaw, Codex, Claude Code).
- **WebsocketHub** -- Manages WebSocket connections and broadcasts events to all connected clients.

Services are instantiated in `createApp()` and made available on every request through the `app.services` Fastify decorator.

## Authentication

All routes under `/api` require session-based authentication except for public paths (`/api/auth/*` and `/api/health`). Authentication is provided via:

- A `nova_session` cookie, or
- An `x-nova-session-token` HTTP header.

See [Authentication](./authentication.md) for full details.

## Error Format

All API errors follow a consistent JSON envelope:

```json
{
  "error": {
    "code": "not_found",
    "message": "Route not found.",
    "details": null
  }
}
```

Standard error codes: `bad_request` (400), `unauthorized` (401), `not_found` (404), `conflict` (409), `service_unavailable` (503), `internal_error` (500).

## Real-time Events

The server exposes a WebSocket endpoint at `/ws` that broadcasts events to all connected clients in a typed envelope format. See [WebSocket Hub](./services/websocket-hub.md) for details.

## Related Documentation

- [App Factory](./app-factory.md)
- [Authentication](./authentication.md)
- [NovaService](./services/nova-service.md)
- [RuntimeManager](./services/runtime-manager.md)
- [WebSocket Hub](./services/websocket-hub.md)
- [API Reference](./api-reference/index.md)
