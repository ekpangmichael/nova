# Real-time Updates

Nova uses a **WebSocket connection** to the Fastify backend for live updates. The backend broadcasts events on the `/ws` endpoint, and the frontend subscribes to them for real-time UI updates and browser notifications.

## WebSocket Protocol

### Connection URL

Resolved by `resolveBackendWebsocketUrl()` in `lib/api.ts`:

- Base: `NOVA_BACKEND_URL` (defaults to `http://127.0.0.1:4010/api`).
- Strips `/api` suffix, replaces protocol with `ws:` or `wss:`, appends `/ws`.
- In the browser, uses `window.location.hostname` so the WebSocket connects to the same host serving the page.

### Message Format

All messages follow the `WebsocketEnvelope` structure:

```typescript
type WebsocketEnvelope = {
  type: string;     // Event type identifier
  payload: unknown; // Event-specific data
  sentAt: string;   // ISO 8601 timestamp
};
```

### Event Types

Defined in `@nova/shared`:

| Event | Description |
|---|---|
| `project.updated` | A project's properties changed. |
| `task.created` | A new task was created. |
| `task.updated` | A task's status, assignment, or metadata changed. |
| `run.created` | A new task run was initiated. |
| `run.updated` | A run's status changed (started, completed, failed, aborted). |
| `run.event` | A streaming event from an active run (message delta, tool call, etc.). |
| `agent.updated` | An agent's status or configuration changed. |
| `runtime.health` | The runtime health state changed. |

## Browser Notification Manager

**Component**: `BrowserNotificationManager`
**File**: `apps/web/src/components/layout/browser-notification-manager.tsx`

A client component mounted inside the dashboard layout. It runs invisibly and:

1. Opens a WebSocket connection to the backend.
2. Listens for `run.updated` and `task.updated` events.
3. Sends browser notifications when configured events occur.

### Notification Triggers

Browser notifications are sent based on user preferences (configured in Settings):

- **Task completed** -- When a run status changes to `completed`.
- **Errors** -- When a run status changes to `failed`.

### Notification Content

Each notification includes:
- Title: Agent name and task title.
- Body: Status-specific message (success or failure reason).
- Click handler: Navigates to the relevant task detail page.

### Preferences

Notification preferences are stored in `localStorage` via `lib/browser-notifications.ts`:

- `taskCompleted` -- Show notifications when tasks finish successfully.
- `errors` -- Show notifications on task failures.

The Settings page at `/settings` provides toggles for these preferences and handles the browser's Notification permission request.

## Task Detail Streaming

**Component**: `TaskDetailScreen`
**File**: `apps/web/src/components/task-detail/task-detail-screen.tsx`

The task detail page opens its own WebSocket connection to receive live updates for the displayed task:

1. Listens for `task.updated` events matching the current task ID and refreshes the task data.
2. Listens for `run.updated` events matching the current task's active run and updates run status.
3. Listens for `run.event` events and appends them to the execution log in real time.
4. Polls for new run events when a run status changes to ensure no events are missed.

This provides a live view of agent execution, with log entries appearing as they are produced by the runtime.

## Reconnection

WebSocket connections use the browser's native `WebSocket` API with manual reconnection logic. When the connection drops, components re-establish the connection on the next relevant lifecycle event (component mount or data refresh).
