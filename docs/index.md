---
layout: home

hero:
  name: Nova
  text: Local-first agent management
  tagline: Create projects, configure AI agents, assign tasks, and monitor execution -- all from a single dashboard on your machine.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/
    - theme: alt
      text: Architecture
      link: /architecture/

features:
  - title: Multi-Runtime Support
    details: Run agents on OpenClaw, Claude Code, Codex, or your own custom runtime. Swap backends without changing your workflow.
  - title: Kanban Boards
    details: Drag-and-drop task management with status columns, priorities, labels, due dates, and agent assignments.
  - title: Real-Time Monitoring
    details: Live dashboard with active run counts, agent statuses, recent failures, and a unified activity feed over WebSocket.
  - title: Execution Logs
    details: Full event stream per run -- message deltas, tool invocations, artifacts, usage metrics, and errors -- all persisted and replayable.
---

## Key Features

### Multi-Runtime Support

Nova is not locked to a single AI provider. The runtime adapter layer supports multiple execution backends:

| Runtime           | Kind              | Description                                      |
| ----------------- | ----------------- | ------------------------------------------------ |
| OpenClaw Native   | `openclaw-native` | Direct integration with the OpenClaw CLI          |
| OpenClaw ACP      | `openclaw-acp`    | OpenClaw via the Agent Communication Protocol     |
| Claude Code       | `claude-code`     | Anthropic Claude Code CLI as an execution runtime |
| Codex             | `codex`           | OpenAI Codex CLI as an execution runtime          |
| Custom            | `custom`          | Bring-your-own runtime adapter                    |

Each runtime can be enabled or disabled independently. Nova auto-detects installed binaries and configuration files at startup.

### Kanban Boards

Every project gets a kanban board with columns mapped to task statuses: Backlog, To Do, In Progress, In Review, Done, Failed, Blocked, Paused, and Canceled. Tasks support drag-and-drop reordering and status transitions. Each task carries priority levels (critical, high, medium, low), labels, due dates, time estimates, and agent assignments.

### Real-Time Monitoring

A live dashboard displays:

- Active run counts and agent status breakdowns (idle, working, paused, error, offline).
- Recent failures with failure reasons and links to the originating task.
- An activity feed covering runs, comments, and assignments.
- Items requiring attention (failed runs, blocked tasks, agent errors).

WebSocket events broadcast state changes across connected clients so the UI stays current without polling.

### Comment Threads with @mentions

Tasks support threaded comments from three author types: users, agents, and the system. Comments are sourced from ticket users, agent mirrors, agent API calls, or system events. This creates a unified conversation log linking human instructions and agent responses on every task.

### Execution Logs

Each task run records a full event stream: run acceptance, start, message deltas, tool invocations, artifact creation, usage metrics, warnings, errors, and completion or failure. The event log is persisted per-attempt so you can replay or audit any run.

### Browser Notifications

The web frontend includes a browser notification manager that alerts you to important state changes (run completions, failures, items needing attention) even when the Nova tab is not focused.

### Additional Capabilities

- **Project seeding** -- initialize a project from a Git repository or start from scratch.
- **Agent provisioning** -- configure agent identity, persona, system instructions, tools, memory, and heartbeat text per agent.
- **Task dependencies** -- define prerequisite relationships between tasks.
- **File attachments** -- attach files to tasks with SHA-256 integrity checks.
- **Run artifacts** -- runs can produce output files classified as input, output, modified, or other.
- **Git context** -- tasks can track a Git repository root, branch name, and branch URL.

---

## Architecture at a Glance

Nova is a monorepo managed with pnpm workspaces. The two main applications are a Fastify 5 API server and a Next.js 16 web frontend. Shared packages provide domain types, the database schema, a UI component library, and the runtime adapter interface.

```
nova/
  apps/
    server/    -- Fastify 5 REST + WebSocket API
    web/       -- Next.js 16 frontend with Tailwind CSS 4
  packages/
    shared/    -- Domain constants, types, and contracts
    db/        -- Drizzle ORM schema and SQLite persistence
    runtime-adapter/ -- RuntimeAdapter interface and types
    ui/        -- Shared UI component library
```

Data is stored locally in SQLite via Drizzle ORM. There is no external database dependency -- Nova is designed to run entirely on your machine.

---

## Next Steps

Head to the [Getting Started](./getting-started/index.md) guide to set up Nova on your machine.
