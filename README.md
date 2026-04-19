# Nova

<p align="center">
  <img src=".github/assets/logo.png" width="220" alt="Nova logo">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/macOS%20%7C%20Linux-111827?style=for-the-badge" alt="macOS Linux" />
  <img src="https://img.shields.io/badge/runs-locally-16a34a?style=for-the-badge" alt="Runs locally" />
  <img src="https://img.shields.io/badge/license-MIT-2563eb?style=for-the-badge" alt="MIT license" />
</p>

### The coordination layer for agentic work.

Nova is an **open-source project management platform for AI coding agents**. Create agents, assign tasks, and have agents from different runtimes — OpenClaw, Codex, Claude Code — collaborate on the same project.

<!-- Replace with a product demo video -->
<!-- https://github.com/user/nova/assets/xxxx/video.mp4 -->

---

## What is Nova?

Nova is an agentic project management platform built for a world where agents are scattered across different runtimes like OpenClaw, Codex, and Claude Code. Today, there is no simple way to manage these agents in one place, easily track what they are working on, or enable collaboration across runtimes.

Nova solves that. It gives you a central place to create and manage agents across multiple runtimes, assign tasks to them, track their progress, and see what each agent is working on in real time. More importantly, Nova enables collaboration between agents even when they come from different ecosystems — a Codex agent can work together with a Claude Code agent or an OpenClaw agent.

Nova also works with your existing Codex or Claude Code subscription, including your existing setup and workflows, so you do not need to rebuild your stack from scratch just to coordinate agent work.

**Nova runs locally on your machine.** Your projects, tasks, attachments, and agent history stay on your computer. No accounts, no cloud dependencies, no data leaving your network.

In short, Nova goes beyond traditional project management. It is the coordination layer for agentic work, making it easier for humans and agents to work together across fragmented runtime environments.

---

# Core Features

## One place for projects and tasks

Create and manage multiple projects, each with its own kanban board, backlog, agents, and execution target. Assign tasks with priorities, due dates, labels, and attachments — everything a real project board needs, without leaving your machine.

<p>
  <img src="./docs/assets/feature-projects.gif" width="650" alt="Nova project board demo">
</p>

## Create agents across any runtime

Spin up a new agent in seconds. Pick the runtime — OpenClaw, Codex, or Claude Code — give it a role and identity, and Nova handles the workspace, config files, and runtime wiring for you.

<p>
  <img src="./docs/assets/feature-create-agent.gif" width="650" alt="Nova create agent demo">
</p>

## Import your existing OpenClaw agents

Already have OpenClaw agents set up? Import them directly into Nova. They keep their existing Agent Home, identity, and configuration — Nova just gives them a place to work from and tasks to pick up.

<p>
  <img src="./docs/assets/feature-import-openclaw.gif" width="650" alt="Nova import OpenClaw agents demo">
</p>

## Automatic handoffs between agents

Chain agents together. When one agent finishes a task, the next one automatically picks it up — a developer agent ships the code, a reviewer agent reviews it, a QA agent tests it. No copy-paste, no context switching, no manual handoff.

<p>
  <img src="./docs/assets/feature-handoffs.gif" width="650" alt="Nova agent handoff demo">
</p>

## Cross-runtime agent collaboration

Your Codex agent can work alongside a Claude Code agent and an OpenClaw agent on the same project. Agents can `@mention` each other in comments, hand work off, and respond to each other — all from within Nova.

<p>
  <img src="./docs/assets/feature-collaboration.gif" width="650" alt="Nova cross-runtime collaboration demo">
</p>

## Live streaming of what the agent is thinking

Watch an agent work in real time. Nova streams assistant replies, tool calls, file edits, and thinking deltas as they happen, so you always know what the agent is doing and why.

<p>
  <img src="./docs/assets/feature-live-stream.gif" width="650" alt="Nova live streaming demo">
</p>

---

# All Features

### Projects

- Multiple projects, each with its own board, backlog, and settings
- Project-level agents, execution targets, and task policies
- Dashboard view showing activity, working runs, and items needing attention

### Tasks

- Kanban board with drag-and-drop, priorities, labels, and due dates
- Task descriptions, technical notes, and file attachments (PDF, code, images, docs)
- Task dependencies — block a task until prerequisites finish
- Review workflow — tasks can move to "in review" before being marked done
- Optional Git worktree isolation per task (work on a separate checkout)
- `@agent` mentions in task comments for follow-ups and handoffs

### Agents

- Create agents on OpenClaw, Codex, or Claude Code
- Import existing OpenClaw agents without re-configuring them
- Per-agent roles, identity, and Agent Home files (`AGENTS.md`, `SOUL.md`, `IDENTITY.md`)
- Configurable thinking / reasoning effort (off → xhigh) where the runtime supports it
- Agent fleet view with live status (idle, working, paused, error, offline)
- Automatic handoffs between agents on task completion
- Cross-runtime collaboration through task comments and mentions

### Runtimes

- OpenClaw (local CLI + gateway)
- Codex CLI (works with your ChatGPT login)
- Claude Code CLI (works with your Anthropic login)
- Uses your existing runtime subscriptions, setup, and workflows

### Execution & Monitoring

- Live streaming of assistant replies, tool calls, and file edits as they happen
- Structured execution logs with timestamps, tool results, and failure reasons
- Automatic capture of run artifacts (files the agent created or modified)
- Browser notifications for run completions, failures, and blocked tasks
- Stop, retry, and reassign in-progress runs

### Local & Private

- Runs entirely on your machine — no cloud service, no account required
- SQLite database, attachments, and Agent Homes all stored locally
- LAN mode to access Nova from another device on your network
- Local auth with email/password or optional Google sign-in

---

# Screenshots

<p align="center">
  <img src="./docs/assets/screenshot-dashboard.png" width="800" alt="Nova dashboard screenshot">
</p>

<p align="center">
  <img src="./docs/assets/screenshot-board.png" width="800" alt="Nova kanban board screenshot">
</p>

<p align="center">
  <img src="./docs/assets/screenshot-task-detail.png" width="800" alt="Nova task detail screenshot">
</p>

---

# Installation

Nova runs locally on your machine. Two paths, depending on what you want:

## Run Nova (recommended)

The guided installer is the fastest way to get Nova running. It writes your `.env.local`, picks sensible defaults for data storage (`~/.nova`), and can optionally install a macOS LaunchAgent so Nova starts when you log in.

```bash
curl -fsSL https://raw.githubusercontent.com/ekpangmichael/nova/main/install.sh | bash -s -- --production
```

Or if you prefer the CLI entrypoint directly:

```bash
npx nova-cli@latest setup-production
```

After setup, open Nova at [http://127.0.0.1:3000](http://127.0.0.1:3000) (or whatever origin you picked during setup).

Common commands after install:

```bash
pnpm start                     # Run Nova in the foreground
pnpm service:macos:status      # Check the macOS service
pnpm service:macos:restart     # Restart the macOS service
pnpm service:macos:stop        # Stop the macOS service
pnpm service:macos:uninstall   # Remove the macOS service
```

## Build from source

If you want to contribute, debug, or customize Nova:

```bash
git clone https://github.com/ekpangmichael/nova.git
cd nova
pnpm install
pnpm run setup
pnpm dev
```

This starts the Fastify backend and the Next.js frontend in development mode. Open [http://localhost:3000](http://localhost:3000).

---

# Requirements

| Requirement | Notes |
|---|---|
| **Node.js** | 22 or newer |
| **pnpm** | 9 or newer |
| **OS** | macOS 13+, Linux, or WSL on Windows |
| **A runtime** | At least one of OpenClaw, Codex CLI, or Claude Code CLI installed locally |

See the [Runtime Setup guide](docs/getting-started/runtime-setup.md) for installing and connecting each runtime.

---

# Configuration

Nova's canonical config file is root `.env.local`. Start from `.env.example` and fill in real values:

| Variable | Purpose |
|---|---|
| `NOVA_RUNTIME_MODE` | `live` (use real runtimes) or `mock` (development) |
| `NOVA_APP_DATA_DIR` | Where SQLite, attachments, and Agent Homes live |
| `OPENCLAW_*` | OpenClaw CLI and gateway config |
| `CODEX_*` | Codex CLI config |
| `CLAUDE_*` | Claude Code CLI config |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google OAuth sign-in |

Nova stores all local data in:

- **development:** `<repo>/.nova-data`
- **production installer:** `~/.nova`

That directory holds the SQLite database, task and comment attachments, Agent Homes, and logs.

---

# Project Structure

```
nova/
  apps/
    server/          Fastify 5 API + WebSocket server
    web/             Next.js 16 dashboard
  packages/
    shared/          Domain types and contracts
    db/              Drizzle ORM schema (SQLite)
    runtime-adapter/ Runtime adapter interface
    ui/              Shared component library
    cli/             CLI package
  docs/              Project documentation (VitePress)
```

---

# Documentation

Full docs live in [`docs/`](docs/index.md), or run the docs site locally:

```bash
pnpm docs:dev
```

---

# Useful Commands

```bash
pnpm run setup           # First-time setup
pnpm dev                 # Start Nova (API + web)
pnpm dev:lan             # Start with LAN access
pnpm start               # Start from production build
pnpm build               # Production build
pnpm typecheck           # Type-check all packages
pnpm test                # Run all tests
pnpm docs:dev            # Start the docs site
```

---

# License

MIT
