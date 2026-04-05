---
layout: home

hero:
  name: Nova
  text: Local-first management for coding agents
  tagline: Run OpenClaw, Codex, and Claude Code from one dashboard. Track projects, tasks, execution logs, and follow-ups — all on your machine.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/
    - theme: alt
      text: Runtime Setup
      link: /getting-started/runtime-setup

features:
  - title: Local-First by Design
    details: Projects, tasks, logs, attachments, and runtime configs stay on your machine. No hosted services, no cloud sync, no data leaving your network.
  - title: Multi-Runtime Execution
    details: Switch between OpenClaw, Codex CLI, and Claude Code CLI per agent. Same task board, same workflow, different runtimes.
  - title: Structured Task Flow
    details: Kanban boards, file attachments, threaded comments, agent mentions, execution branches, and full run history in one place.
  - title: Replayable Execution Logs
    details: Every run records streaming output, tool calls, failure reasons, summaries, and usage metrics. Audit any past run in full detail.
---

## What is Nova

Nova is a local management platform for AI coding agents. It provides a web dashboard and API server that let you:

- Organize work into **projects** and **kanban tasks**
- Configure **agents** backed by different AI runtimes
- **Execute tasks** through OpenClaw, Codex, or Claude Code
- Track every run with **structured execution logs**
- Persist context across sessions in **local SQLite storage**

Nova runs entirely on your machine. There are no external dependencies, no hosted accounts, and no data leaving your network.

## What works today

- Project and task management with kanban boards
- Agent creation, editing, and runtime configuration
- Task execution through OpenClaw, Codex CLI, and Claude Code CLI
- File attachments on tasks and comments
- Threaded comments with `@agent` routing
- Execution logs with streaming output and run history
- Browser notifications for completions, failures, and blocked tasks
- Local auth with email/password or Google sign-in

## Runtimes

| Runtime | Status | Auth | Models |
| --- | --- | --- | --- |
| OpenClaw | Supported | Local OpenClaw profile | From your local install |
| Codex | Supported | ChatGPT login | Curated model list |
| Claude Code | Supported | Anthropic login | Curated model list |

Start with the [Runtime Setup](/getting-started/runtime-setup) guide to configure your first runtime.

## Architecture at a glance

Nova is a monorepo with two apps and several shared packages:

```
nova/
  apps/
    server/    Fastify 5 REST + WebSocket API
    web/       Next.js 16 dashboard with Tailwind CSS 4
  packages/
    shared/    Domain types and contracts
    db/        Drizzle ORM schema (SQLite)
    runtime-adapter/  Adapter interface and types
    ui/        Shared component library
```

All data is stored in local SQLite. No external database required.

## Next step

Head to the [Getting Started](/getting-started/) guide to install Nova and run your first agent.
