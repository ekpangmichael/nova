# Project Endpoints

All project endpoints require session-based authentication.

Source: `apps/server/src/routes/projects.ts`

---

## List Projects

```
GET /api/projects
```

Returns all projects ordered by creation date. Each project includes computed agent and task counts.

**Response** `200 OK`

```json
[
  {
    "id": "uuid",
    "slug": "my-project",
    "name": "My Project",
    "description": "Project description text.",
    "status": "active",
    "projectRoot": "/absolute/path/to/project",
    "seedType": "none",
    "seedUrl": null,
    "tags": ["frontend", "v2"],
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z",
    "assignedAgentCount": 2,
    "openTaskCount": 5,
    "backlogTaskCount": 3
  }
]
```

---

## Create Project

```
POST /api/projects
```

Creates a new project. The slug is auto-generated from the name if not provided.

**Request Body**

| Field         | Type     | Required | Description                            |
| ------------- | -------- | -------- | -------------------------------------- |
| `name`        | string   | Yes      | Project display name (min 1 char).     |
| `description` | string   | No       | Project description.                   |
| `slug`        | string   | No       | URL-safe slug. Auto-generated if omitted. |
| `status`      | string   | No       | `active` (default), `paused`, `archived`. |
| `projectRoot` | string   | Yes      | Absolute filesystem path (min 1 char). |
| `seedType`    | string   | No       | `none` (default) or `git`.             |
| `seedUrl`     | string   | No       | Git clone URL (when seedType is `git`).|
| `tags`        | string[] | No       | Array of label strings.                |

**Response** `200 OK`

Returns the created project object (same shape as list item).

**Errors**

- `400 bad_request` -- Invalid input or slug could not be generated.

---

## Get Project

```
GET /api/projects/:projectId
```

Returns a single project by ID with assigned agent IDs and task counts.

**URL Parameters**

| Parameter   | Type | Description      |
| ----------- | ---- | ---------------- |
| `projectId` | UUID | The project ID.  |

**Response** `200 OK`

```json
{
  "id": "uuid",
  "slug": "my-project",
  "name": "My Project",
  "description": "...",
  "status": "active",
  "projectRoot": "/path/to/project",
  "seedType": "none",
  "seedUrl": null,
  "tags": [],
  "createdAt": "...",
  "updatedAt": "...",
  "assignedAgentIds": ["agent-uuid-1", "agent-uuid-2"],
  "openTaskCount": 5,
  "backlogTaskCount": 3
}
```

**Errors**

- `404 not_found` -- Project does not exist.

---

## Update Project

```
PATCH /api/projects/:projectId
```

Partially updates a project. Only provided fields are changed. If `projectRoot` is changed, all assigned agents' workspace symlinks are updated.

**URL Parameters**

| Parameter   | Type | Description      |
| ----------- | ---- | ---------------- |
| `projectId` | UUID | The project ID.  |

**Request Body**

All fields from the create schema, all optional. Same types and constraints.

**Response** `200 OK`

Returns the updated project object.

**Errors**

- `404 not_found` -- Project does not exist.
- `400 bad_request` -- Invalid input.

---

## Delete Project

```
DELETE /api/projects/:projectId
```

Deletes a project and all associated data: stops active runs, removes tasks, cleans up attachments and run directories, resets agent state.

**URL Parameters**

| Parameter   | Type | Description      |
| ----------- | ---- | ---------------- |
| `projectId` | UUID | The project ID.  |

**Response** `204 No Content`

**Errors**

- `404 not_found` -- Project does not exist.

---

## Assign Agent to Project

```
POST /api/projects/:projectId/agents/:agentId
```

Creates an assignment between a project and an agent. Sets up the agent's workspace with the project root via the runtime adapter.

**URL Parameters**

| Parameter   | Type | Description      |
| ----------- | ---- | ---------------- |
| `projectId` | UUID | The project ID.  |
| `agentId`   | UUID | The agent ID.    |

**Response** `200 OK`

Returns the updated agent object.

**Errors**

- `404 not_found` -- Project or agent does not exist.
- `409 conflict` -- Agent is already assigned to this project.

---

## Unassign Agent from Project

```
DELETE /api/projects/:projectId/agents/:agentId
```

Removes the project-agent assignment.

**URL Parameters**

| Parameter   | Type | Description      |
| ----------- | ---- | ---------------- |
| `projectId` | UUID | The project ID.  |
| `agentId`   | UUID | The agent ID.    |

**Response** `204 No Content`

**Errors**

- `404 not_found` -- Assignment does not exist.

---

## Get Project Activity

```
GET /api/projects/:projectId/activity
```

Returns recent activity items for a project, including task creations, status changes, run events, and comments.

**URL Parameters**

| Parameter   | Type | Description      |
| ----------- | ---- | ---------------- |
| `projectId` | UUID | The project ID.  |

**Response** `200 OK`

Returns an array of `ProjectActivityItem` objects.

---

## Get Project Tasks

```
GET /api/projects/:projectId/tasks
```

Returns all tasks belonging to a project with agent name, latest run status, and comment count.

**URL Parameters**

| Parameter   | Type | Description      |
| ----------- | ---- | ---------------- |
| `projectId` | UUID | The project ID.  |

**Response** `200 OK`

Returns an array of task objects with additional context fields.
