
# Agent Project Manager v1 — Implementation Handoff Prompt

Build the product described in `apm-v1-implementation-spec.md`.

## Your mission
Continue v1 as a local-first web app with:
- Next.js 16 frontend
- Fastify backend
- SQLite
- mock-first runtime adapter plus OpenClaw native skeleton
- projects
- agents
- tasks
- live runs
- monitor page

## Current status
Already implemented:
- monorepo scaffold
- Fastify backend app factory and boot layer
- SQLite + Drizzle schema and migrations
- projects, agents, project-agent assignments
- agent home compilation
- tasks, comments, attachments
- run start / stream / stop
- monitor endpoints
- websocket broadcasting
- test suite for the first backend slice

Deferred:
- automations
- retry / reassign
- real OpenClaw execution beyond health/setup skeletons

## Important constraints
1. Use the exact terminology and scope from the spec.
2. Keep **Agent Home** separate from **Execution Target**.
3. For OpenClaw-native mode, execution targets must stay inside the assigned agent home.
4. Automations are native OpenClaw cron wrappers and are separate from tasks.
5. Browser must never talk directly to OpenClaw.
6. Runtime abstraction must exist from day one; the current repo uses a mock adapter for development and an OpenClaw native skeleton for runtime boundaries.
7. v1 is single-user local mode only.
8. Agent concurrency is fixed at 1.

## Build order
Follow this next build order:
1. adapt the frontend to the canonical backend API and terminology
2. add retry / reassign / failure recovery flows
3. add richer board and task detail integration against live data
4. add real OpenClaw execution transport behind the existing adapter boundary
5. add automations
6. add recovery, import/export, and more operational polish

## Implementation style
- Prefer simple concrete code over framework cleverness.
- Keep services small and testable.
- Persist raw runtime event payloads.
- Validate all paths strictly.
- Use the database as the source of truth for product state.
- Treat agent home files as generated runtime mirrors of app data.

## Minimum acceptable first vertical slice
This slice is now complete in the repo:
- create project
- create agent
- assign agent to project
- generate agent home files
- create task
- start task
- see live run events through the backend
- stop task
- persist run history
- show agent/task state in monitor endpoints

## Final output expected
Produce:
- complete codebase
- db migrations
- README
- dev startup instructions
- test suite
- short progress notes mapping completed work to spec sections
