# Task Endpoints

All task endpoints require session-based authentication.

Source: `apps/server/src/routes/tasks.ts`

---

## Create Task

```
POST /api/tasks
```

Creates a new task within a project, assigned to a specific agent. The `createdBy` field is automatically set from the authenticated user's display name if not explicitly provided.

**Request Body**

| Field                      | Type     | Required | Description                                                                                          |
| -------------------------- | -------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `projectId`                | UUID     | Yes      | Parent project ID.                                                                                   |
| `title`                    | string   | Yes      | Task title (min 1 char).                                                                             |
| `description`              | string   | No       | Task description text.                                                                               |
| `status`                   | string   | No       | Initial status. Default: `backlog`. See status values below.                                         |
| `priority`                 | string   | No       | `critical`, `high`, `medium`, or `low`.                                                              |
| `assignedAgentId`          | UUID     | Yes      | Agent to assign this task to.                                                                        |
| `executionTargetOverride`  | string   | No       | Alternate working directory for execution (nullable).                                                |
| `dueAt`                    | string   | No       | ISO 8601 due date (nullable).                                                                        |
| `estimatedMinutes`         | integer  | No       | Time estimate in minutes (positive integer, nullable).                                               |
| `labels`                   | string[] | No       | Array of label strings.                                                                              |
| `createdBy`                | string   | No       | Creator display name. Auto-set from session if omitted.                                              |

**Task Status Values**

`backlog`, `todo`, `in_progress`, `in_review`, `done`, `failed`, `blocked`, `paused`, `canceled`

**Response** `200 OK`

Returns the created task object.

**Errors**

- `400 bad_request` -- Invalid input.
- `404 not_found` -- Project or agent does not exist.

---

## Get Task

```
GET /api/tasks/:taskId
```

Returns a single task by ID, including project name, agent name, git context (branch name and URL), and associated metadata.

**URL Parameters**

| Parameter | Type | Description   |
| --------- | ---- | ------------- |
| `taskId`  | UUID | The task ID.  |

**Response** `200 OK`

```json
{
  "id": "uuid",
  "projectId": "uuid",
  "projectName": "My Project",
  "title": "Fix the login bug",
  "description": "Users cannot log in when...",
  "status": "in_progress",
  "priority": "high",
  "assignedAgentId": "uuid",
  "agentName": "Backend Agent",
  "executionTargetOverride": null,
  "dueAt": null,
  "estimatedMinutes": 30,
  "labels": ["bugfix"],
  "createdBy": "User Name",
  "branchName": "nova/fix-the-login-bug-abc123",
  "branchUrl": "https://github.com/org/repo/tree/nova/fix-the-login-bug-abc123",
  "createdAt": "2025-01-15T10:00:00.000Z",
  "updatedAt": "2025-01-15T12:00:00.000Z"
}
```

**Errors**

- `404 not_found` -- Task does not exist.

---

## Update Task

```
PATCH /api/tasks/:taskId
```

Partially updates a task. Only provided fields are changed. The `projectId` cannot be changed after creation.

**URL Parameters**

| Parameter | Type | Description   |
| --------- | ---- | ------------- |
| `taskId`  | UUID | The task ID.  |

**Request Body**

All fields from the create schema except `projectId`, all optional.

**Response** `200 OK`

Returns the updated task object.

**Errors**

- `404 not_found` -- Task does not exist.
- `400 bad_request` -- Invalid input.

---

## Delete Task

```
DELETE /api/tasks/:taskId
```

Deletes a task and cascades: stops active runs, removes attachments, clears agent state if this was the agent's current task.

**URL Parameters**

| Parameter | Type | Description   |
| --------- | ---- | ------------- |
| `taskId`  | UUID | The task ID.  |

**Response** `204 No Content`

**Errors**

- `404 not_found` -- Task does not exist.

---

## Add Comment

```
POST /api/tasks/:taskId/comments
```

Adds a comment to a task. When `authorType` is `user` or omitted, the `authorId` is automatically set from the authenticated user's display name.

**URL Parameters**

| Parameter | Type | Description   |
| --------- | ---- | ------------- |
| `taskId`  | UUID | The task ID.  |

**Request Body**

| Field        | Type   | Required | Description                                     |
| ------------ | ------ | -------- | ----------------------------------------------- |
| `body`       | string | Yes      | Comment text (min 1 char).                      |
| `authorType` | string | No       | `user` (default), `agent`, or `system`.         |
| `authorId`   | string | No       | Author identifier (nullable, auto-set for user).|

**Response** `200 OK`

Returns the created comment object.

**Errors**

- `404 not_found` -- Task does not exist.

---

## Get Comments

```
GET /api/tasks/:taskId/comments
```

Returns all comments on a task ordered by creation date.

**URL Parameters**

| Parameter | Type | Description   |
| --------- | ---- | ------------- |
| `taskId`  | UUID | The task ID.  |

**Response** `200 OK`

Returns an array of comment objects:

```json
[
  {
    "id": "uuid",
    "taskId": "uuid",
    "taskRunId": null,
    "authorType": "user",
    "authorId": "User Name",
    "source": "ticket_user",
    "body": "Comment text here.",
    "createdAt": "2025-01-15T10:30:00.000Z"
  }
]
```

---

## Upload Attachment

```
POST /api/tasks/:taskId/attachments
```

Uploads a file attachment to a task. The request must be a multipart form with a single file field.

**URL Parameters**

| Parameter | Type | Description   |
| --------- | ---- | ------------- |
| `taskId`  | UUID | The task ID.  |

**Request**

`Content-Type: multipart/form-data` with one file field. Maximum file size: 25 MB.

**Response** `200 OK`

Returns the attachment record:

```json
{
  "id": "uuid",
  "taskId": "uuid",
  "fileName": "screenshot.png",
  "mimeType": "image/png",
  "sizeBytes": 102400,
  "relativeStoragePath": "task-uuid/attachment-uuid/screenshot.png",
  "createdAt": "2025-01-15T11:00:00.000Z"
}
```

**Errors**

- `400 bad_request` -- No file provided in the multipart upload.
- `404 not_found` -- Task does not exist.

---

## Start Task

```
POST /api/tasks/:taskId/start
```

Starts execution of a task by dispatching it to the assigned agent's runtime. Creates a new run, generates the runtime prompt, and begins streaming events.

**URL Parameters**

| Parameter | Type | Description   |
| --------- | ---- | ------------- |
| `taskId`  | UUID | The task ID.  |

**Response** `200 OK`

Returns the created run object with status `starting`.

**Errors**

- `404 not_found` -- Task does not exist.
- `400 bad_request` -- Task is not in a startable state.
- `503 service_unavailable` -- Runtime is not available.

---

## Stop Task

```
POST /api/tasks/:taskId/stop
```

Stops execution of a running task. Terminates the runtime process, drains pending events, and resets the task status.

**URL Parameters**

| Parameter | Type | Description   |
| --------- | ---- | ------------- |
| `taskId`  | UUID | The task ID.  |

**Response** `200 OK`

Returns the updated task object with status reset to `todo`.

**Errors**

- `404 not_found` -- Task does not exist.
- `400 bad_request` -- Task has no active run to stop.

---

## Get Task Runs

```
GET /api/tasks/:taskId/runs
```

Returns all runs for a task, ordered by most recent first.

**URL Parameters**

| Parameter | Type | Description   |
| --------- | ---- | ------------- |
| `taskId`  | UUID | The task ID.  |

**Response** `200 OK`

Returns an array of run objects:

```json
[
  {
    "id": "uuid",
    "taskId": "uuid",
    "agentId": "uuid",
    "runtimeKind": "openclaw-native",
    "runtimeSessionKey": "session-key",
    "status": "completed",
    "modelId": "model-name",
    "startedAt": "2025-01-15T10:00:00.000Z",
    "endedAt": "2025-01-15T10:05:00.000Z",
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:05:00.000Z"
  }
]
```
