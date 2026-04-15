# Development Setup

## Prerequisites

- **Node.js** -- Version 18 or later.
- **pnpm** -- Package manager. Install via `corepack enable` or `npm install -g pnpm`.

## Initial Setup

Clone the repository, install dependencies, and run the bootstrap step:

```bash
git clone https://github.com/ekpangmichael/nova.git nova
cd nova
pnpm install
pnpm run setup
```

`pnpm run setup` creates `.env.local` from `.env.example` if needed and performs the same first-run bootstrap described in the public installation guide.

## Running in Development

Start both the backend and frontend in development mode:

```bash
pnpm dev
```

This runs a development orchestrator script (`scripts/dev.mjs`) that starts:

- **Backend** (Fastify) -- Typically on port 4010 during `pnpm dev`.
- **Frontend** (Next.js) -- Typically on port 3000.

You can also start them independently:

```bash
pnpm dev:web       # Start only the Next.js frontend
pnpm dev:server    # Start only the Fastify backend
```

## Database

Nova uses **SQLite** via **Drizzle ORM**. The database file is stored at `<NOVA_APP_DATA_DIR>/db/app.db` (defaults to `.nova-data/db/app.db` in the repo root).

### Generating Migrations

After modifying the schema in `packages/db/src/schema.ts`:

```bash
pnpm db:generate
```

This creates a new SQL migration file in `packages/db/drizzle/`. Migrations are applied automatically on server startup.

## Testing

Nova uses **Vitest** for all tests (unit and integration).

```bash
pnpm test           # Run all tests across all packages
```

To run tests for a specific package:

```bash
pnpm --filter @nova/server test
pnpm --filter @nova/shared test
```

### Test Files

Test files follow the co-location pattern:

- Unit tests: `<module>.test.ts` next to the source file.
- Integration tests: `<module>.integration.test.ts` next to the source file.

### OpenClaw Smoke Tests

Integration tests that require a live OpenClaw runtime are gated behind the `NOVA_ENABLE_OPENCLAW_SMOKE` environment variable:

```bash
NOVA_ENABLE_OPENCLAW_SMOKE=1 pnpm --filter @nova/server test
```

## Type Checking

Run TypeScript type checking across all packages:

```bash
pnpm typecheck
```

This invokes `tsc --noEmit` (or equivalent) in every package that defines a `typecheck` script.

## Linting

Run linting across all packages:

```bash
pnpm lint
```

## Building

Build all packages and applications for production:

```bash
pnpm build
```

## Verification Checklist

Before submitting changes, run all three checks:

```bash
pnpm typecheck
pnpm test
pnpm build
```

All three must pass. This is the same set of checks listed in the `AGENTS.md` verification section.

## Project Structure

```
nova/
  apps/
    server/           Fastify backend (TypeScript)
    web/              Next.js 16 frontend (TypeScript)
  packages/
    shared/           Domain constants, types, contracts
    db/               Drizzle ORM schema and migrations
    runtime-adapter/  Runtime adapter interface
  scripts/
    dev.mjs           Development orchestrator
  .nova-data/         Default application data directory (gitignored)
```

## Environment Variables

See the [Configuration Reference](../operations/configuration-reference.md) for all available environment variables. For local development, the defaults work without any configuration -- the backend starts in mock runtime mode and uses `.nova-data/` for persistence.
