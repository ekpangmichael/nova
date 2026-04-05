# Domain Model

Nova's domain model is built around four core concepts that separate the
product-level identity of an agent from its runtime-level execution context.
Understanding these four concepts is essential for working with the codebase.

## The Four Core Concepts

```
+-------------------+        +-------------------+
|  Logical Agent    |        |  Agent Home       |
|  (product entity) | 1----1 |  (persistent dir) |
+--------+----------+        +-------------------+
         |
         | assigned to projects, tasks
         |
+--------+----------+        +-------------------+
|  Execution Target | N----1 |  Runtime Agent     |
|  (task work dir)  |        |  (runtime identity)|
+-------------------+        +-------------------+
```

### 1. Logical Agent

The Logical Agent is the product-level entity that users interact with through
the Nova dashboard. It has a name, avatar, role, system instructions, and
configuration. It is stored in the `agents` table and referenced by its `id`
throughout the control plane.

Key fields on the Logical Agent:

| Field                 | Purpose                                          |
|-----------------------|--------------------------------------------------|
| `id`                  | Primary key (UUID)                               |
| `slug`                | URL-safe unique identifier                       |
| `name`               | Display name (e.g., "Backend Engineer")           |
| `role`                | Short role description                           |
| `systemInstructions`  | Base prompt sent to the runtime on every run     |
| `personaText`         | Optional persona layer for the agent's behavior  |
| `runtimeKind`         | Which runtime this agent uses (e.g., `openclaw-native`) |
| `runtimeAgentId`      | Foreign key into the runtime's own agent registry |
| `agentHomePath`       | Absolute path to the Agent Home directory        |
| `runtimeStatePath`    | Path to the runtime's per-agent state directory  |
| `status`              | Current operational status (idle, working, paused, error, offline) |
| `currentTaskId`       | The task the agent is currently working on       |

A Logical Agent is assigned to one or more projects through the `projectAgents`
join table. When a task is created, it is assigned to a specific Logical Agent.

### 2. Agent Home

The Agent Home is a persistent directory on the local file system where an
agent's configuration, identity files, and runtime state live. It is the
agent's "home base" that persists across tasks and runs.

The Agent Home path is stored on the Logical Agent as `agentHomePath`. The
control plane writes workspace files into this directory via the runtime
adapter's `syncAgentWorkspace` method, which pushes instruction files,
persona definitions, tool configurations, and other agent-level resources.

The Agent Home directory structure is runtime-specific. For example, OpenClaw
agents may have an `AGENTS.md` and `.openclaw/` subdirectory, while Claude
Code agents may have a `CLAUDE.md` and `.claude/` subdirectory.

The term "Agent Home" is the canonical product term. Do not use "workspace" as
a generic substitute.

### 3. Execution Target

The Execution Target is a per-task working directory where the actual coding
work happens. When a run starts, the runtime receives the Execution Target path
and performs all file operations (reading code, writing changes, running tools)
inside that directory.

Execution Targets are resolved from two sources:

- **Default resolution.** Derived from the project's `projectRoot` combined
  with the agent's configuration. Stored on the task as
  `resolvedExecutionTarget`.
- **Override.** A task may specify an `executionTargetOverride` to point at a
  different directory (e.g., a specific subdirectory or a separate repository).

Each runtime adapter declares an `executionTargetMode` capability that
determines how it relates to the Execution Target:

| Mode                 | Behavior                                        |
|----------------------|-------------------------------------------------|
| `inside-agent-home`  | The Execution Target is a subdirectory of the Agent Home |
| `runtime-cwd`        | The runtime process is launched with the Execution Target as its cwd |
| `external`           | The runtime is given the path but manages access itself |

Tasks also track git context when applicable:

| Field              | Purpose                                           |
|--------------------|---------------------------------------------------|
| `gitRepoRoot`      | Root of the git repository containing the target  |
| `gitBranchName`    | Branch created or used for this task              |
| `gitBranchUrl`     | URL to the branch (for linking to a remote)       |

### 4. Runtime Agent

The Runtime Agent is the identity that a specific runtime uses to track an
agent. It is distinct from the Logical Agent -- the Logical Agent is Nova's
concept, while the Runtime Agent is the runtime's concept.

When a Logical Agent is created in Nova, the control plane calls
`provisionAgent` on the appropriate runtime adapter, which creates or registers
the agent in the runtime's own registry. The runtime returns a
`runtimeAgentId`, which Nova stores on the Logical Agent record.

The Runtime Agent typically has:

- A working directory (the Agent Home, seen from the runtime's perspective)
- A state directory (where the runtime persists its own conversation history,
  tool state, etc.)
- An optional default model selection
- Sandbox configuration

The `runtimeAgentId` is unique per runtime kind. The database enforces a unique
constraint on `(runtimeKind, runtimeAgentId)` to prevent two Logical Agents
from sharing the same Runtime Agent identity.

## How They Relate

```
User creates a Logical Agent
  |
  +--> Nova calls runtimeAdapter.provisionAgent()
  |      |
  |      +--> Runtime creates a Runtime Agent
  |      |    with its own workspace at Agent Home
  |      |
  |      +--> Returns runtimeAgentId
  |
  +--> Nova stores the runtimeAgentId on the Logical Agent
  |
  +--> Nova calls runtimeAdapter.syncAgentWorkspace()
         |
         +--> Writes instruction files into the Agent Home

User creates a Task and assigns it to the Logical Agent
  |
  +--> Nova resolves the Execution Target from the project root
  |
  +--> Nova calls runtimeAdapter.ensureProjectRoot()
  |      |
  |      +--> Sets up the project directory (git clone, etc.)
  |
  +--> Nova calls runtimeAdapter.startRun()
         |
         +--> Runtime launches a process in the Execution Target
         |    using the Runtime Agent identity
         |
         +--> Events stream back through subscribeRun()
```

## Supporting Entities

Beyond the four core concepts, the domain model includes several supporting
entities:

### Projects

Projects group related tasks and agents. A project has a `projectRoot`
directory and can be seeded from a git repository. Agents are assigned to
projects through the `projectAgents` join table.

### Tasks

Tasks are the unit of work. Each task belongs to a project, is assigned to an
agent, and tracks its lifecycle through statuses: backlog, todo, in_progress,
in_review, done, failed, blocked, paused, canceled.

Tasks have priority levels (critical, high, medium, low), support dependencies
through the `taskDependencies` table, and can carry file attachments and
threaded comments.

### Runs

A run represents a single execution attempt for a task. Runs track the runtime
kind, session key, status, timing, failure reasons, and a final summary. Each
run can have multiple sequential events (stored in `runEvents`) and produce
artifacts (stored in `runArtifacts`).

Run statuses progress through: requested, preparing, starting, running,
completed, failed, aborted.

### Comments

Task comments support three author types (user, agent, system) and four sources
(ticket_user, agent_mirror, agent_api, system). Comments from agent runs are
linked through `taskRunId` for traceability.

### Settings

A singleton settings record stores global configuration: runtime binary paths,
config paths, state directories, gateway settings, and app data directory. This
is how Nova persists runtime discovery results across restarts.
