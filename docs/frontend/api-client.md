# API Client

All backend communication flows through `apps/web/src/lib/api.ts`. This module provides type-safe wrappers around every backend endpoint and handles the SSR vs. client-side fetch distinction transparently.

## Core Function: `requestJson<T>()`

```typescript
async function requestJson<T>(path: string, init?: RequestInit): Promise<T>
```

This is the single fetch helper used by every exported API function. It handles:

1. **URL resolution** -- Prepends the appropriate base URL depending on execution context.
2. **Auth forwarding** -- On the server, reads the `nova_session` cookie from `next/headers` and attaches it as `x-nova-session-token`. On the client, the browser sends cookies automatically to the proxy route.
3. **Error handling** -- Non-OK responses are parsed and thrown as `ApiError` instances with `status`, `code`, and `details` fields.
4. **Empty responses** -- 204 status or empty body returns `undefined`.

## SSR vs. Client-Side Fetching

The module detects its execution context using `typeof window === "undefined"`.

### Server-Side Rendering (SSR)

When running on the server (inside async server components), `requestJson` calls the backend directly:

- **Base URL**: `NOVA_BACKEND_URL` or `NEXT_PUBLIC_API_BASE_URL`, defaulting to `http://127.0.0.1:4010/api`.
- **Auth**: Imports `cookies()` from `next/headers`, reads `nova_session`, and sends it as the `x-nova-session-token` header.
- **Caching**: All requests use `cache: "no-store"` to guarantee fresh data on every render.

### Client-Side

When running in the browser, `requestJson` routes through the Next.js proxy:

- **Base URL**: `NEXT_PUBLIC_API_BASE_URL`, defaulting to `/api/backend`.
- **Auth**: The browser sends the `nova_session` cookie with the request automatically. The proxy route extracts it and forwards it to the backend.

## Proxy Route: `/api/backend/[...path]`

Located at `apps/web/src/app/api/backend/[...path]/route.ts`, this catch-all route handler proxies `GET`, `POST`, `PATCH`, and `DELETE` requests to the Fastify backend.

**Behavior**:

- Tries multiple backend base URLs in order: `NOVA_BACKEND_URL`, then `http://127.0.0.1:4010/api`, then `http://127.0.0.1:4000/api`.
- Forwards the `accept`, `content-type` headers and the `nova_session` cookie (as `x-nova-session-token`).
- If a 404 response looks like a Fastify "Route not found" error, the proxy tries the next backend URL.
- If all backends are unreachable, returns a 503 `backend_unavailable` error.

## Error Handling

The `ApiError` class extends `Error` and carries structured error information:

```typescript
class ApiError extends Error {
  status: number;    // HTTP status code
  code: string;      // Machine-readable error code (e.g., "api_error")
  details: unknown;  // Optional structured details from the backend
}
```

All exported API functions propagate `ApiError` to the caller. Server components typically catch these and render inline error messages.

## Exported API Functions

### Projects

| Function | Method | Path |
|---|---|---|
| `getProjects()` | GET | `/projects` |
| `getProject(id)` | GET | `/projects/:id` |
| `getProjectActivity(id)` | GET | `/projects/:id/activity` |
| `getProjectTasks(id)` | GET | `/projects/:id/tasks` |
| `createProject(input)` | POST | `/projects` |
| `patchProject(id, input)` | PATCH | `/projects/:id` |
| `deleteProject(id)` | DELETE | `/projects/:id` |
| `assignAgentToProject(projectId, agentId)` | POST | `/projects/:id/agents/:agentId` |

### Agents

| Function | Method | Path |
|---|---|---|
| `getAgents()` | GET | `/agents` |
| `getAgent(id)` | GET | `/agents/:id` |
| `createAgent(input)` | POST | `/agents` |
| `patchAgent(id, input)` | PATCH | `/agents/:id` |
| `deleteAgent(id)` | DELETE | `/agents/:id` |

### Tasks

| Function | Method | Path |
|---|---|---|
| `getTask(id)` | GET | `/tasks/:id` |
| `createTask(input)` | POST | `/tasks` |
| `patchTask(id, input)` | PATCH | `/tasks/:id` |
| `deleteTask(id)` | DELETE | `/tasks/:id` |
| `addTaskComment(taskId, input)` | POST | `/tasks/:id/comments` |
| `startTask(id)` | POST | `/tasks/:id/start` |
| `stopTask(id)` | POST | `/tasks/:id/stop` |

### Runs

| Function | Method | Path |
|---|---|---|
| `getRunEvents(runId)` | GET | `/runs/:id/events` |
| `getRunArtifacts(runId)` | GET | `/runs/:id/artifacts` |

### Attachments

| Function | Method | Path |
|---|---|---|
| `uploadTaskAttachment(taskId, file)` | POST (multipart) | `/tasks/:id/attachments` |

### Runtimes

| Function | Method | Path |
|---|---|---|
| `getRuntimes()` | GET | `/runtimes` |
| `getOpenClawCatalog()` | GET | `/runtimes/openclaw/catalog` |
| `getCodexCatalog()` | GET | `/runtimes/codex/catalog` |
| `getClaudeCatalog()` | GET | `/runtimes/claude/catalog` |
| `getOpenClawConfig()` | GET | `/runtimes/openclaw/config` |
| `getCodexConfig()` | GET | `/runtimes/codex/config` |
| `getClaudeConfig()` | GET | `/runtimes/claude/config` |
| `testOpenClawConfig(input)` | POST | `/runtimes/openclaw/config/test` |
| `testCodexConfig(input)` | POST | `/runtimes/codex/config/test` |
| `testClaudeConfig(input)` | POST | `/runtimes/claude/config/test` |
| `updateOpenClawConfig(input)` | PATCH | `/runtimes/openclaw/config` |
| `updateCodexConfig(input)` | PATCH | `/runtimes/codex/config` |
| `updateClaudeConfig(input)` | PATCH | `/runtimes/claude/config` |
| `setOpenClawEnabled(input)` | PATCH | `/runtimes/openclaw/enabled` |
| `setCodexEnabled(input)` | PATCH | `/runtimes/codex/enabled` |
| `setClaudeEnabled(input)` | PATCH | `/runtimes/claude/enabled` |

### Dashboard

| Function | Method | Path |
|---|---|---|
| `getDashboardStats()` | GET | `/dashboard/stats` |
| `getDashboardWorkingRuns()` | GET | `/dashboard/working` |
| `getDashboardActivity()` | GET | `/dashboard/activity` |
| `getDashboardAttention()` | GET | `/dashboard/attention` |

### Monitor

| Function | Method | Path |
|---|---|---|
| `getMonitorSummary()` | GET | `/monitor/summary` |

### System

| Function | Method | Path |
|---|---|---|
| `selectDirectory()` | POST | `/system/select-directory` |

## WebSocket URL Resolution

The `resolveBackendWebsocketUrl()` function builds the WebSocket connection URL:

- Starts from `NOVA_BACKEND_URL` (defaulting to `http://127.0.0.1:4010/api`).
- Strips the `/api` suffix.
- In the browser, replaces the hostname with `window.location.hostname` so the WebSocket connects to the same host as the page.
- Converts `http:` to `ws:` and `https:` to `wss:`.
- Appends `/ws`.
