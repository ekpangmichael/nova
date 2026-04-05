---
layout: home

hero:
  name: Nova
  text: Local-first orchestration for coding agents
  tagline: Run OpenClaw, Codex, and Claude Code from one local dashboard with projects, tasks, attachments, comments, and replayable execution logs.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/
    - theme: alt
      text: Runtime Setup
      link: /getting-started/runtime-setup

features:
  - title: Local-First Control Plane
    details: Nova keeps projects, tasks, logs, attachments, and runtime configuration on your machine instead of hiding them behind a hosted control plane.
  - title: Multi-Runtime Execution
    details: Use OpenClaw, Codex CLI, or Claude Code CLI from the same task workflow, with runtime-specific model catalogs and health checks.
  - title: Operator-Friendly Task Flow
    details: Combine kanban tasks, attachments, comment follow-up, `@agent` routing, execution branches, and run history in one place.
  - title: Replayable Execution Logs
    details: Every run keeps structured events, failure reasons, summaries, and runtime metadata so you can audit what happened later.
---

## What Nova is

Nova is a local orchestration workspace for coding agents. It gives you:

- a Next.js dashboard
- a Fastify API
- local SQLite persistence
- runtime adapters for OpenClaw, Codex, and Claude Code

The goal is simple: let you manage real local agent work without losing context across projects, tasks, branches, comments, and runtime sessions.

## What works today

- project and task management
- agent creation, import, editing, and runtime configuration
- task attachments and comment attachments
- runtime-backed task execution through OpenClaw, Codex CLI, and Claude Code CLI
- execution logs with terminal summaries and raw payloads
- browser notifications and local auth for the Nova web app

## What is still evolving

- first-run packaging and release workflow
- runtime ergonomics outside the core OpenClaw path
- some CLI-specific retry and long-run edge cases
- broader cross-machine and internet-facing deployment stories

## Runtime support

| Runtime | Status | Auth model | Model source |
| --- | --- | --- | --- |
| OpenClaw | Supported | Local OpenClaw profile | Your local OpenClaw install |
| Codex | Supported | Local Codex login | Curated confirmed Codex list |
| Claude Code | Supported | Local Claude Code login | Curated confirmed Claude list |

If you are evaluating Nova for actual work, start with the runtime setup guide:

- [Runtime Setup](./getting-started/runtime-setup.md)

## Comments and logs

Nova keeps a deliberate split between operator-facing comments and runtime execution logs:

- comments are for follow-up, blockers, questions, handoff, and operator intent
- execution logs are for streaming runtime output, tool activity, summaries, and failures

That split matters once you start switching agents, reusing task branches, or auditing a run after the fact.

## Next step

Head to the [Getting Started](./getting-started/index.md) guide to install Nova and configure your first runtime.
