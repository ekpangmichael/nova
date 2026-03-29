# Nova

Agent Project Manager v1 workspace.

The repo is split into separate frontend and backend apps with shared internal packages:

- `apps/web`: existing frontend prototype, preserved as a Next.js 16 app for now
- `apps/server`: Fastify backend for projects, agents, tasks, runs, monitor, runtime health, and websocket broadcasting
- `packages/shared`: canonical shared enums and DTOs
- `packages/db`: Drizzle schema, client, and generated SQLite migrations
- `packages/runtime-adapter`: runtime adapter contracts plus mock and OpenClaw skeleton support
- `packages/ui`: shared UI package placeholder

## Getting started

Install dependencies:

```bash
pnpm install
```

Run both apps together:

```bash
pnpm dev
```

Run apps separately:

```bash
pnpm dev:web
pnpm dev:server
```

Useful workspace commands:

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm db:generate
```

## Current ports

- frontend: `http://localhost:3000`
- backend: `http://localhost:4000`

## Backend notes

- App data defaults to `<repo>/.nova-data`.
- The server stores a file-backed SQLite database at `.nova-data/db/app.db`.
- Task attachments are stored under `.nova-data/attachments/`.
- Agent homes are generated under `.nova-data/agent-homes/`.
- Default runtime mode is `mock`; use `NOVA_RUNTIME_MODE=openclaw` to switch to the OpenClaw process manager skeleton.

## Environment

- `PORT`: Fastify listen port. Defaults to `4000`.
- `NOVA_APP_DATA_DIR`: Override the app-data root.
- `NOVA_RUNTIME_MODE`: `mock` or `openclaw`.
- `OPENCLAW_PROFILE`: Runtime profile name. Defaults to `apm`.
- `OPENCLAW_BINARY_PATH`: OpenClaw binary path. Defaults to `openclaw`.
- `OPENCLAW_GATEWAY_URL`: Optional gateway URL for runtime health metadata.
- `NOVA_ENABLE_OPENCLAW_SMOKE`: Enables optional smoke-only OpenClaw checks when set to `1` or `true`.
