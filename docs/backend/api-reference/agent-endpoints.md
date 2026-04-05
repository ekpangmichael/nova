# Agent Endpoints

All agent endpoints require session-based authentication.

Source: `apps/server/src/routes/agents.ts`

---

## List Agents

```
GET /api/agents
```

Returns all agents ordered by creation date.

**Response** `200 OK`

```json
[
  {
    "id": "uuid",
    "slug": "frontend-agent",
    "name": "Frontend Agent",
    "role": "Frontend development",
    "avatar": null,
    "status": "idle",
    "systemInstructions": "You are a frontend engineer...",
    "runtimeKind": "openclaw-native",
    "defaultModelId": null,
    "defaultThinkingLevel": "medium",
    "sandboxMode": "off",
    "currentTaskId": null,
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  }
]
```

---

## Create Agent

```
POST /api/agents
```

Creates a new agent and sets up its home directory on disk.

**Request Body**

| Field                | Type    | Required | Description                                      |
| -------------------- | ------- | -------- | ------------------------------------------------ |
| `name`               | string  | Yes      | Agent display name (min 1 char).                 |
| `role`               | string  | Yes      | Short role description (min 1 char).             |
| `slug`               | string  | No       | URL-safe slug. Auto-generated from name.         |
| `avatar`             | string  | No       | Avatar image URL (nullable).                     |
| `systemInstructions` | string  | No       | Base system prompt for the agent.                |
| `personaText`        | string  | No       | Optional persona prompt section (nullable).      |
| `userContextText`    | string  | No       | Optional user-context prompt section (nullable). |
| `identityText`       | string  | No       | Optional identity prompt section (nullable).     |
| `toolsText`          | string  | No       | Optional tools prompt section (nullable).        |
| `heartbeatText`      | string  | No       | Optional heartbeat prompt section (nullable).    |
| `memoryText`         | string  | No       | Optional memory prompt section (nullable).       |
| `runtime`            | object  | No       | Runtime configuration (see below).               |

**Runtime Object**

| Field                  | Type    | Required | Description                                                    |
| ---------------------- | ------- | -------- | -------------------------------------------------------------- |
| `kind`                 | string  | No       | `openclaw-native` (default), `codex`, or `claude-code`.        |
| `runtimeAgentId`       | string  | No       | Runtime-specific agent ID.                                     |
| `workspacePath`        | string  | No       | Custom workspace path.                                         |
| `runtimeStatePath`     | string  | No       | Custom state path.                                             |
| `defaultModelId`       | string  | No       | Model ID for runs (nullable).                                  |
| `modelOverrideAllowed` | boolean | No       | Whether model can be overridden per-run.                       |
| `sandboxMode`          | string  | No       | `off`, `docker`, or `other`.                                   |
| `defaultThinkingLevel` | string  | No       | `off`, `minimal`, `low`, `medium`, `high`, or `xhigh`.        |

**Response** `200 OK`

Returns the created agent object.

**Errors**

- `400 bad_request` -- Invalid input.

---

## Get Agent

```
GET /api/agents/:agentId
```

Returns a single agent by ID with full configuration details.

**URL Parameters**

| Parameter | Type | Description    |
| --------- | ---- | -------------- |
| `agentId` | UUID | The agent ID.  |

**Response** `200 OK`

Returns the agent object.

**Errors**

- `404 not_found` -- Agent does not exist.

---

## Update Agent

```
PATCH /api/agents/:agentId
```

Partially updates an agent. Supports updating all fields including runtime configuration and status.

**URL Parameters**

| Parameter | Type | Description    |
| --------- | ---- | -------------- |
| `agentId` | UUID | The agent ID.  |

**Request Body**

All fields from the create schema, all optional. Additionally:

| Field    | Type   | Description                                          |
| -------- | ------ | ---------------------------------------------------- |
| `status` | string | `idle`, `working`, `paused`, `error`, or `offline`.  |

The `runtime` object fields are also all optional in patch mode.

**Response** `200 OK`

Returns the updated agent object.

**Errors**

- `404 not_found` -- Agent does not exist.
- `400 bad_request` -- Invalid input.

---

## Delete Agent

```
DELETE /api/agents/:agentId
```

Deletes an agent and cascades: stops active runs, removes the agent home directory, cleans up project assignments and tasks.

**URL Parameters**

| Parameter | Type | Description    |
| --------- | ---- | -------------- |
| `agentId` | UUID | The agent ID.  |

**Response** `204 No Content`

**Errors**

- `404 not_found` -- Agent does not exist.

---

## Sync Agent Home

```
POST /api/agents/:agentId/sync-home
```

Re-synchronizes the agent's home directory by ensuring all assigned project roots are present and up to date.

**URL Parameters**

| Parameter | Type | Description    |
| --------- | ---- | -------------- |
| `agentId` | UUID | The agent ID.  |

**Response** `200 OK`

Returns the updated agent object.

**Errors**

- `404 not_found` -- Agent does not exist.

---

## Get Agent Tasks

```
GET /api/agents/:agentId/tasks
```

Returns all tasks assigned to a specific agent.

**URL Parameters**

| Parameter | Type | Description    |
| --------- | ---- | -------------- |
| `agentId` | UUID | The agent ID.  |

**Response** `200 OK`

Returns an array of task objects.

---

## Get Agent Runs

```
GET /api/agents/:agentId/runs
```

Returns all runs for a specific agent, ordered by most recent first.

**URL Parameters**

| Parameter | Type | Description    |
| --------- | ---- | -------------- |
| `agentId` | UUID | The agent ID.  |

**Response** `200 OK`

Returns an array of run objects.
