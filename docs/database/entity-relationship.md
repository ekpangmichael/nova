# Entity Relationships

This document describes how the Nova database entities relate to each other. The schema models a project management system where AI agents execute tasks within projects.

## Relationship Summary

```
settings (singleton)

users 1---* userSessions

projects *---* agents        (via projectAgents join table)
projects 1---* tasks

agents 1---* tasks           (assigned_agent_id, RESTRICT delete)
agents 1---* taskRuns         (agent_id, RESTRICT delete)

tasks 1---* taskDependencies  (self-referencing through depends_on_task_id)
tasks 1---* taskComments
tasks 1---* taskAttachments
tasks 1---* taskRuns

taskRuns 1---* runEvents
taskRuns 1---* runArtifacts
taskRuns 1---* taskComments   (optional link, SET NULL on delete)
```

## Entity Relationship Diagram (ASCII)

```
+------------+         +----------------+         +------------+
|  settings  |         |     users      |         | userSess.  |
|  (single)  |         +----------------+         +------------+
+------------+         | id        [PK] |----+    | id    [PK] |
                       | email     [UQ] |    |    | user_id[FK]|---+
                       | google_sub[UQ] |    +---<| ...        |   |
                       +----------------+         +------------+   |
                                                                   |
                                                                   |
+----------------+     +------------------+     +----------------+ |
|   projects     |     |  projectAgents   |     |    agents      | |
+----------------+     +------------------+     +----------------+ |
| id        [PK] |-+  | id          [PK] |  +-<| id        [PK] | |
| slug       [UQ]| |  | project_id  [FK] |--+  | slug       [UQ]| |
| name       |   | +->| agent_id    [FK] |--+  | runtime_kind   | |
| status     |   |    +------------------+     | runtime_agent  | |
| project_root|  |     UQ(project_id,          | [UQ] (kind+id) | |
| seed_type  |   |        agent_id)            | status         | |
+----------------+                              +-------+--------+ |
       |                                                |          |
       | 1                                              | 1        |
       |                                                |          |
       | *                                              | *        |
+------+------------------------------------------+-----+--+      |
|                     tasks                        |        |      |
+--------------------------------------------------+        |      |
| id                     [PK]                      |        |      |
| task_number                                      |        |      |
| project_id             [FK] -> projects.id       |        |      |
| title                                            |        |      |
| description                                      |        |      |
| status                                           |        |      |
| priority                                         |        |      |
| assigned_agent_id      [FK] -> agents.id         |        |      |
| execution_target_override                        |        |      |
| resolved_execution_target                        |        |      |
| git_repo_root                                    |        |      |
| git_branch_name                                  |        |      |
+--------------------------------------------------+        |      |
       |              |              |                      |      |
       | 1            | 1            | 1                    |      |
       |              |              |                      |      |
       | *            | *            | *                    |      |
+------+----+  +------+-----+  +----+----------+           |      |
| taskDeps  |  | taskComm.  |  | taskAttach.   |           |      |
+-----------+  +------------+  +---------------+           |      |
| task_id   |  | task_id    |  | task_id       |           |      |
| depends_  |  | task_run_id|  | file_name     |           |      |
| on_task_id|  | author_type|  | mime_type     |           |      |
+-----------+  | source     |  | sha256        |           |      |
  (self-ref)   | body       |  | size_bytes    |           |      |
               +------+-----+  +---------------+           |      |
                      |                                     |      |
                      | * (optional FK)                     |      |
                      |                                     |      |
               +------+------------------------------+------+      |
               |             taskRuns                 |             |
               +--------------------------------------+             |
               | id                     [PK]          |             |
               | task_id                [FK] -> tasks  |             |
               | attempt_number                       |             |
               | agent_id              [FK] -> agents  |             |
               | runtime_kind                         |             |
               | runtime_session_key                  |             |
               | status                               |             |
               | usage_json                           |             |
               +-------+-------------------+----------+             |
                       |                   |                        |
                       | 1                 | 1                      |
                       |                   |                        |
                       | *                 | *                      |
                +------+-----+     +-------+--------+              |
                | runEvents  |     | runArtifacts   |              |
                +------------+     +----------------+              |
                | task_run_id|     | task_run_id    |              |
                | seq        |     | path           |              |
                | event_type |     | kind           |              |
                | payload_   |     | label          |              |
                |  json      |     | summary        |              |
                +------------+     +----------------+              |
```

## Detailed Relationships

### settings (Singleton)

The `settings` table contains a single row with application-wide configuration. It has no foreign key relationships to other tables. It stores paths and credentials for all configured runtimes (OpenClaw, Codex, Claude Code).

### users -> userSessions (One-to-Many)

Each user can have multiple active sessions. When a user is deleted, all their sessions are cascade-deleted.

- `userSessions.user_id` references `users.id` (ON DELETE CASCADE)

### projects <-> agents (Many-to-Many via projectAgents)

Projects and agents are linked through the `projectAgents` join table. A project can have multiple agents assigned, and an agent can be assigned to multiple projects.

- `projectAgents.project_id` references `projects.id` (ON DELETE CASCADE)
- `projectAgents.agent_id` references `agents.id` (ON DELETE CASCADE)
- Unique constraint on `(project_id, agent_id)` prevents duplicate assignments.

### projects -> tasks (One-to-Many)

A project contains many tasks. Deleting a project cascades to all its tasks.

- `tasks.project_id` references `projects.id` (ON DELETE CASCADE)

### agents -> tasks (One-to-Many, RESTRICT)

Each task is assigned to exactly one agent. Deleting an agent is restricted if any tasks reference it, preventing orphaned task assignments.

- `tasks.assigned_agent_id` references `agents.id` (ON DELETE RESTRICT)

### tasks -> taskDependencies (Self-Referencing Many-to-Many)

Tasks can depend on other tasks. This is a self-referencing relationship through the `taskDependencies` table.

- `taskDependencies.task_id` references `tasks.id` (ON DELETE CASCADE) -- the dependent task
- `taskDependencies.depends_on_task_id` references `tasks.id` (ON DELETE CASCADE) -- the prerequisite task
- Unique constraint on `(task_id, depends_on_task_id)` prevents duplicate dependency edges.

### tasks -> taskComments (One-to-Many)

Each task can have many comments. Comments are cascade-deleted with their parent task.

- `taskComments.task_id` references `tasks.id` (ON DELETE CASCADE)
- `taskComments.task_run_id` optionally references `taskRuns.id` (ON DELETE SET NULL) to associate a comment with a specific execution run.

### tasks -> taskAttachments (One-to-Many)

Each task can have many file attachments. Attachments are cascade-deleted with their parent task.

- `taskAttachments.task_id` references `tasks.id` (ON DELETE CASCADE)

### tasks -> taskRuns (One-to-Many)

Each task can have multiple run attempts. Runs are cascade-deleted with their parent task.

- `taskRuns.task_id` references `tasks.id` (ON DELETE CASCADE)
- `taskRuns.agent_id` references `agents.id` (ON DELETE RESTRICT)

### taskRuns -> runEvents (One-to-Many)

Each run produces an ordered sequence of events. Events are cascade-deleted with their parent run.

- `runEvents.task_run_id` references `taskRuns.id` (ON DELETE CASCADE)
- Unique constraint on `(task_run_id, seq)` ensures event ordering integrity.

### taskRuns -> runArtifacts (One-to-Many)

Each run can produce multiple file artifacts. Artifacts are cascade-deleted with their parent run.

- `runArtifacts.task_run_id` references `taskRuns.id` (ON DELETE CASCADE)

## Deletion Behavior Summary

| Parent | Child | ON DELETE |
|--------|-------|-----------|
| `users` | `userSessions` | CASCADE |
| `projects` | `projectAgents` | CASCADE |
| `agents` | `projectAgents` | CASCADE |
| `projects` | `tasks` | CASCADE |
| `agents` | `tasks` | RESTRICT |
| `tasks` | `taskDependencies` (both FKs) | CASCADE |
| `tasks` | `taskComments` | CASCADE |
| `taskRuns` | `taskComments.task_run_id` | SET NULL |
| `tasks` | `taskAttachments` | CASCADE |
| `tasks` | `taskRuns` | CASCADE |
| `agents` | `taskRuns` | RESTRICT |
| `taskRuns` | `runEvents` | CASCADE |
| `taskRuns` | `runArtifacts` | CASCADE |

The `RESTRICT` policy on `agents -> tasks` and `agents -> taskRuns` ensures that an agent cannot be deleted while it still has assigned tasks or active runs. All other relationships use `CASCADE` to clean up child records automatically.
