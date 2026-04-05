# Getting Started

This section walks you through Nova's current official install path: source install with a bootstrap step. By the end you will have the API server and web frontend running on your machine.

---

## Overview

Nova runs as two processes during development:

1. **API server** (`@nova/server`) -- a Fastify 5 application that exposes REST endpoints and a WebSocket at `/ws`. Defaults to port **4010**.
2. **Web frontend** (`@nova/web`) -- a Next.js 16 application with Tailwind CSS 4. Defaults to port **3000**.

A single `pnpm dev` command starts both processes, builds shared dependencies, and orchestrates health checks so the frontend only launches after the API server is ready.

---

## Sections

| Guide | Description |
| ----- | ----------- |
| [Prerequisites](./prerequisites.md) | Required tooling and system requirements |
| [Installation](./installation.md) | Source install, bootstrap with `pnpm setup`, and run Nova for the first time |
| [Development Workflow](./development-workflow.md) | Day-to-day dev commands: dev mode, build, test, lint, typecheck |
| [Project Structure](./project-structure.md) | Monorepo layout, packages, and how they relate |

---

## Quick Start (TL;DR)

```bash
git clone <repo-url> nova
cd nova
pnpm install
pnpm setup
pnpm dev
```

`pnpm setup` is the bootstrap command. It creates `.env.local` from `.env.example` when needed, prepares the local data directory, and detects installed runtimes before you launch the app.

The dev script then builds shared packages, starts the Fastify server on `http://127.0.0.1:4010`, waits for a healthy response from `/api/health`, then starts the Next.js frontend on `http://127.0.0.1:3000`.

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser to access Nova.
