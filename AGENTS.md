<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Repo notes

- The backend lives in `apps/server` and uses Fastify, not NestJS.
- The frontend lives in `apps/web` and is currently Next.js 16.
- Shared domain contracts live in `packages/shared`.
- The DB layer lives in `packages/db`.
- The runtime adapter boundary lives in `packages/runtime-adapter`.

# Canonical terms

Do not use `workspace` as a generic product term in code or docs.

Use:
- `Agent Home`
- `Project Root`
- `Execution Target`

# Current backend slice

Implemented:
- Fastify app factory and boot layer
- SQLite persistence with Drizzle
- projects, agents, assignments, tasks, comments, attachments
- run start/stream/stop with the mock runtime adapter
- runtime health endpoints
- monitor endpoints
- websocket broadcasting on `/ws`

Not implemented yet:
- retry and reassign flows
- real OpenClaw run execution

# Verification

For backend changes, run:
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
