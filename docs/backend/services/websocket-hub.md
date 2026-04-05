# WebSocket Hub

`WebsocketHub` manages real-time communication between the Nova backend and connected clients. It lives in `apps/server/src/services/websocket/WebsocketHub.ts`.

## Endpoint

```
ws://<host>:<port>/ws
```

The WebSocket endpoint is registered directly on the Fastify app (outside the `/api` prefix) in `app.ts`. It requires authentication -- the connection is rejected with close code `1008` if no valid session token is provided.

Authentication is read from:
1. The `x-nova-session-token` header on the upgrade request, or
2. The `nova_session` cookie.

In the `test` environment, authentication is bypassed.

## Connection Management

The hub maintains a `Set<WebSocket>` of all active connections. When a new WebSocket connects, it is added to the set. When the socket closes, it is automatically removed via the `close` event listener.

## Broadcasting

### broadcast(type, payload)

```ts
broadcast<TPayload>(type: WebsocketEventType, payload: TPayload): void
```

Sends a message to all connected clients whose socket is in the `OPEN` state. Messages that cannot be delivered (because the socket is closing or closed) are silently dropped.

## Envelope Format

Every message sent over the WebSocket follows the `WebsocketEnvelope` format:

```json
{
  "type": "task.updated",
  "payload": { ... },
  "sentAt": "2025-01-15T10:30:00.000Z"
}
```

| Field     | Type   | Description                                         |
| --------- | ------ | --------------------------------------------------- |
| `type`    | string | One of the `WebsocketEventType` values (see below). |
| `payload` | object | Event-specific data.                                |
| `sentAt`  | string | ISO 8601 timestamp of when the message was sent.    |

## Event Types

The following event types are defined in `@nova/shared`:

| Event Type        | Trigger                                                      | Payload                        |
| ----------------- | ------------------------------------------------------------ | ------------------------------ |
| `project.updated` | Project created, updated, or deleted.                        | Full project object.           |
| `task.created`    | New task created.                                            | Full task object.              |
| `task.updated`    | Task status, metadata, or comments changed.                  | Full task object.              |
| `run.created`     | New run started for a task.                                  | Full run object.               |
| `run.updated`     | Run status changed (completed, failed, stopped).             | Full run object.               |
| `run.event`       | Streaming event from a runtime (log line, checkpoint, etc.). | Run event record.              |
| `agent.updated`   | Agent created, updated, deleted, or status changed.          | Full agent object.             |
| `runtime.health`  | Runtime health status changed.                               | Runtime health object.         |

## Usage in NovaService

`NovaService` calls `websocketHub.broadcast()` throughout its operations to keep clients in sync:

- After creating or updating a project.
- After creating, updating, or deleting a task.
- When a run starts, completes, fails, or stops.
- When run events stream in from a runtime adapter.
- When agent status changes (idle to working, error, etc.).
- After runtime configuration changes that affect health.

This allows the frontend to receive real-time updates without polling.
