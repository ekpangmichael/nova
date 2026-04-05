# Data Flow

This document describes how requests and data move through the Nova system,
covering the HTTP proxy pipeline, WebSocket real-time flow, and server-side
rendering data fetching.

## Request Lifecycle: Browser to Backend

Nova's frontend (`@nova/web`) never communicates directly with the Fastify
backend. All API traffic is routed through a Next.js catch-all API route that
acts as a reverse proxy.

### The Proxy Route

The proxy lives at:

```
apps/web/src/app/api/backend/[...path]/route.ts
```

It handles GET, POST, PATCH, and DELETE requests. The browser makes requests to
`/api/backend/<path>`, and the proxy forwards them to the Fastify server at
`http://127.0.0.1:4010/api/<path>` (or a configured `NOVA_BACKEND_URL`).

### Full Request Path

```
Browser
  |
  |  fetch("/api/backend/projects")
  |
  v
Next.js Dev Server (port 3000)
  |
  |  Catch-all route: /api/backend/[...path]/route.ts
  |  - Reads session cookie (nova_session)
  |  - Forwards as x-nova-session-token header
  |  - Proxies request body for POST/PATCH/PUT
  |
  v
Fastify Server (port 4010)
  |
  |  preHandler hook:
  |  - Reads x-nova-session-token header (or cookie)
  |  - Validates session via AuthService
  |  - Attaches authSession to request
  |
  |  Route handler:
  |  - Calls NovaService methods
  |  - NovaService queries/mutates SQLite via Drizzle
  |  - For run operations, delegates to RuntimeManager
  |
  v
Response flows back through the same path
  |
  v
Browser receives JSON response
```

### Proxy Fallback Behavior

The proxy tries multiple backend base URLs in sequence:

1. `NOVA_BACKEND_URL` environment variable (if set)
2. `http://127.0.0.1:4010/api`
3. `http://127.0.0.1:4000/api`

If a backend returns a 404 with a "Route not found" message, the proxy tries
the next URL. If all backends are unreachable, it returns a 503 with a
`backend_unavailable` error code.

### Authentication Flow

```
Browser
  |
  |  POST /api/backend/auth/login  { email, password }
  |
  v
Proxy --> Fastify /api/auth/login
  |
  |  AuthService validates credentials
  |  Creates session in user_sessions table
  |  Returns session token
  |
  v
Proxy returns response
  |
  v
Browser stores token as nova_session cookie
  |
  |  Subsequent requests include cookie automatically
  |
  v
Proxy reads cookie, forwards as x-nova-session-token header
  |
  v
Fastify preHandler validates token on every request
  (except /api/auth and /api/health which are public)
```

## WebSocket Real-Time Flow

Nova uses WebSocket connections to push real-time updates from the server to all
connected dashboard clients.

### Connection Setup

```
Browser
  |
  |  new WebSocket("ws://localhost:4010/ws")
  |  Sends nova_session cookie or x-nova-session-token header
  |
  v
Fastify WebSocket endpoint (/ws)
  |
  |  Validates session token
  |  Registers socket with WebsocketHub
  |
  v
WebsocketHub.handleConnection(socket)
  |
  |  Adds socket to #connections Set
  |  Registers close handler to remove on disconnect
```

### Event Broadcasting

When a mutation occurs in the control plane, the responsible service method
broadcasts an event through the WebsocketHub:

```
NovaService.updateTask()
  |
  |  Mutates database
  |
  |  websocketHub.broadcast("task.updated", { ... })
  |
  v
WebsocketHub
  |
  |  Wraps payload in WebsocketEnvelope:
  |  {
  |    type: "task.updated",
  |    payload: { ... },
  |    sentAt: "2026-04-03T..."
  |  }
  |
  |  JSON.stringify and send to all open connections
  |
  v
All connected browsers receive the event
  |
  v
Client-side handler processes the event
  (update UI state, show notification, etc.)
```

### WebSocket Event Types

| Event Type         | Trigger                                     |
|--------------------|---------------------------------------------|
| `project.updated`  | Project metadata changed                    |
| `task.created`     | New task added                              |
| `task.updated`     | Task status, assignment, or details changed |
| `run.created`      | New run started                             |
| `run.updated`      | Run status changed                          |
| `run.event`        | Streaming event from runtime (message delta, tool use, etc.) |
| `agent.updated`    | Agent status changed                        |
| `runtime.health`   | Runtime health status changed               |

### Run Event Streaming

When a run is active, the server subscribes to the runtime adapter's event
stream and relays each event to the database and WebSocket:

```
RuntimeAdapter.subscribeRun(sessionKey, onEvent)
  |
  |  Runtime process emits events:
  |    run.accepted
  |    run.started
  |    message.delta  (streaming text)
  |    tool.started
  |    tool.completed
  |    message.completed
  |    artifact.created
  |    usage
  |    run.completed | run.failed | run.aborted
  |
  v
onEvent callback in NovaService
  |
  +---> Insert into runEvents table (seq, type, payload)
  |
  +---> websocketHub.broadcast("run.event", { runId, event })
  |
  +---> On terminal events (completed/failed/aborted):
        +---> Update taskRuns status and timing
        +---> Update agent status (idle/error)
        +---> Broadcast "run.updated" and "agent.updated"
```

## SSR Data Fetching

Next.js 16 server components fetch data at render time. In Nova, this means
server components call the backend API during SSR, not from the browser.

### Server Component Data Path

```
Browser navigates to /projects/abc123
  |
  v
Next.js server renders the page
  |
  |  Server component calls:
  |    fetch("http://127.0.0.1:4010/api/projects/abc123")
  |    (or through the internal proxy route)
  |
  v
Fastify returns project data
  |
  v
Server component renders HTML with data
  |
  v
Browser receives fully rendered page
  |
  v
Client components hydrate
  |  - Set up WebSocket connection for real-time updates
  |  - Initialize client-side state
```

### Client-Side Data Fetching

Client components that need fresh data (or data not available at SSR time) use
the `/api/backend/` proxy route from the browser:

```
Client component mounts
  |
  |  fetch("/api/backend/tasks?projectId=abc123")
  |
  v
Next.js proxy --> Fastify --> SQLite --> Response
  |
  v
Component updates with response data
```

## Mutation Flow Example: Starting a Run

This end-to-end example shows how starting a task run flows through the system:

```
1. User clicks "Start" on task card
   |
2. Browser: POST /api/backend/runs  { taskId: "...", agentId: "..." }
   |
3. Proxy forwards to Fastify: POST /api/runs
   |
4. NovaService.startRun()
   |  a. Validate task is assignable
   |  b. Create taskRuns record (status: "requested")
   |  c. Broadcast "run.created" via WebSocket
   |  d. Update task status to "in_progress"
   |  e. Broadcast "task.updated" via WebSocket
   |  f. Get runtime adapter for agent's runtimeKind
   |  g. Call adapter.startRun({ taskId, runId, prompt, ... })
   |  h. Adapter spawns CLI process in Execution Target
   |  i. Call adapter.subscribeRun() for event streaming
   |
5. Runtime process executes, emitting events
   |  Each event:
   |  a. Persisted to runEvents table
   |  b. Broadcast as "run.event" via WebSocket
   |
6. All connected dashboards receive events in real time
   |  UI updates: task card shows progress, log streams output
   |
7. Run completes (or fails)
   |  a. Terminal event persisted
   |  b. taskRuns record updated (status, endedAt, summary)
   |  c. Agent status set back to "idle" (or "error")
   |  d. "run.updated" and "agent.updated" broadcast
   |
8. Dashboard reflects final state
```
