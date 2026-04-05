# API Reference -- Overview

The Nova API is a RESTful JSON API served by Fastify. All endpoints are prefixed with `/api`.

## Base URL

```
http://<host>:<port>/api
```

Default: `http://localhost:4000/api`

## Authentication

Most endpoints require a valid session token. Provide it via one of:

- **Header**: `x-nova-session-token: <token>`
- **Cookie**: `nova_session=<token>`

Public endpoints that do not require authentication:
- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `POST /api/auth/google`
- `GET /api/auth/session`
- `POST /api/auth/signout`
- `GET /api/health`

The agent-runtime callback endpoints (`/api/agent-runtime/*`) use a separate Bearer token scheme -- see the section below.

## Content Type

All request and response bodies use `application/json`, except file upload endpoints which accept `multipart/form-data`.

## Error Format

All errors return a consistent JSON envelope:

```json
{
  "error": {
    "code": "not_found",
    "message": "Descriptive error message.",
    "details": null
  }
}
```

### Error Codes

| HTTP Status | Code                  | Description                                   |
| ----------- | --------------------- | --------------------------------------------- |
| 400         | `bad_request`         | Invalid input or validation failure.           |
| 401         | `unauthorized`        | Missing or invalid session, or expired.        |
| 404         | `not_found`           | Resource or route not found.                   |
| 409         | `conflict`            | Duplicate resource (e.g., email already used). |
| 503         | `service_unavailable` | Runtime or dependency unavailable.             |
| 500         | `internal_error`      | Unexpected server error.                       |

The `details` field is optional and may contain additional context (e.g., Zod validation errors).

## Common Patterns

### UUID Parameters

Resource IDs in URL parameters are UUIDs and validated with `z.string().uuid()`. Invalid UUIDs return `400 bad_request`.

### Timestamps

All timestamps are ISO 8601 strings (e.g., `"2025-01-15T10:30:00.000Z"`).

### List Endpoints

List endpoints return JSON arrays directly (not wrapped in an envelope). They do not support pagination in the current implementation.

### Delete Endpoints

Successful deletes return `204 No Content` with an empty body.

### Partial Updates (PATCH)

PATCH endpoints accept partial objects. Only provided fields are updated; omitted fields retain their current values.

## Agent Runtime API

The `/api/agent-runtime/*` endpoints are designed for runtime agents to call back into Nova during task execution. They use Bearer token authentication instead of session tokens:

```
Authorization: Bearer <run-bridge-token>
```

Run bridge tokens are generated when a task run starts and are scoped to a specific task and run. They expire after 15 minutes.

## Endpoint Groups

- [Authentication Endpoints](./auth-endpoints.md)
- [Project Endpoints](./project-endpoints.md)
- [Agent Endpoints](./agent-endpoints.md)
- [Task Endpoints](./task-endpoints.md)

### Additional Endpoints (documented inline)

#### Health

| Method | Path                  | Description                |
| ------ | --------------------- | -------------------------- |
| GET    | `/api/health`         | App health check (public). |
| GET    | `/api/runtime/health` | Runtime health status.     |
| POST   | `/api/runtime/setup`  | Run runtime setup.         |
| POST   | `/api/runtime/restart` | Restart runtime.          |

#### Runtimes

| Method | Path                                | Description                          |
| ------ | ----------------------------------- | ------------------------------------ |
| GET    | `/api/runtimes`                     | List all runtime summaries.          |
| GET    | `/api/runtimes/openclaw/config`     | Get OpenClaw configuration.          |
| GET    | `/api/runtimes/openclaw/catalog`    | Get OpenClaw model catalog.          |
| POST   | `/api/runtimes/openclaw/config/test`| Test an OpenClaw configuration.      |
| PATCH  | `/api/runtimes/openclaw/config`     | Update OpenClaw configuration.       |
| PATCH  | `/api/runtimes/openclaw/enabled`    | Enable or disable OpenClaw.          |
| GET    | `/api/runtimes/codex/config`        | Get Codex configuration.             |
| GET    | `/api/runtimes/codex/catalog`       | Get Codex model catalog.             |
| POST   | `/api/runtimes/codex/config/test`   | Test a Codex configuration.          |
| PATCH  | `/api/runtimes/codex/config`        | Update Codex configuration.          |
| PATCH  | `/api/runtimes/codex/enabled`       | Enable or disable Codex.             |
| GET    | `/api/runtimes/claude/config`       | Get Claude Code configuration.       |
| GET    | `/api/runtimes/claude/catalog`      | Get Claude Code model catalog.       |
| POST   | `/api/runtimes/claude/config/test`  | Test a Claude Code configuration.    |
| PATCH  | `/api/runtimes/claude/config`       | Update Claude Code configuration.    |
| PATCH  | `/api/runtimes/claude/enabled`      | Enable or disable Claude Code.       |

#### Runs

| Method | Path                     | Description                  |
| ------ | ------------------------ | ---------------------------- |
| GET    | `/api/runs/:runId`       | Get a single run by ID.      |
| GET    | `/api/runs/:runId/events`| Get all events for a run.    |
| GET    | `/api/runs/:runId/artifacts` | Get all artifacts for a run. |

#### Dashboard and Monitor

| Method | Path                          | Description                              |
| ------ | ----------------------------- | ---------------------------------------- |
| GET    | `/api/dashboard/stats`        | Aggregate dashboard statistics.          |
| GET    | `/api/dashboard/working`      | Currently working runs.                  |
| GET    | `/api/dashboard/activity`     | Recent activity feed.                    |
| GET    | `/api/dashboard/attention`    | Tasks needing attention.                 |
| GET    | `/api/monitor/summary`        | Runtime-level summary.                   |
| GET    | `/api/monitor/active-runs`    | All currently active runs.               |
| GET    | `/api/monitor/recent-failures`| Recently failed runs.                    |

#### Agent Runtime Callbacks

| Method | Path                                           | Auth           | Description                  |
| ------ | ---------------------------------------------- | -------------- | ---------------------------- |
| POST   | `/api/agent-runtime/tasks/:taskId/comments`    | Bearer token   | Agent posts a comment.       |
| POST   | `/api/agent-runtime/tasks/:taskId/checkpoints` | Bearer token   | Agent reports a checkpoint.  |
| POST   | `/api/agent-runtime/tasks/:taskId/artifacts`   | Bearer token   | Agent registers an artifact. |

#### System

| Method | Path                          | Description                    |
| ------ | ----------------------------- | ------------------------------ |
| POST   | `/api/system/select-directory`| Open native directory picker.  |
