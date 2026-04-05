# Development Workflow

This page covers the commands and conventions for day-to-day development in the Nova monorepo.

---

## Dev Mode

```bash
pnpm dev
```

This is the primary development command. It runs `scripts/dev.mjs`, which:

1. Builds shared dependencies (`@nova/shared`, `@nova/runtime-adapter`, `@nova/db`).
2. Starts the Fastify API server on port **4010** with `tsx watch` for automatic restarts on file changes.
3. Waits for the server health check to pass.
4. Starts the Next.js dev server on port **3000** with hot module replacement.

Both processes run in the foreground and are terminated together when you press `Ctrl+C`.

### Running Services Independently

You can start each service separately if needed:

```bash
# API server only (port 4010)
pnpm dev:server

# Web frontend only (port 3000)
pnpm dev:web
```

When running the web frontend independently, make sure the API server is already running so the frontend can reach its backend at `http://127.0.0.1:4010/api`.

### Runtime Mode

The dev script sets the `NOVA_RUNTIME_MODE` environment variable. By default it uses the value from your environment or falls back to `openclaw`. You can override it:

```bash
NOVA_RUNTIME_MODE=mock pnpm dev
```

Available modes:

| Mode | Behavior |
| ---- | -------- |
| `mock` | Uses a built-in mock runtime. No external binaries required. Suitable for UI development and testing. |
| `openclaw` | Uses the OpenClaw CLI for real agent execution. Requires the `openclaw` binary on your `$PATH`. |

---

## Build

```bash
pnpm build
```

Runs `pnpm -r --if-present build` across all packages and applications. The build order is determined by workspace dependency relationships:

1. `@nova/shared` (no dependencies)
2. `@nova/runtime-adapter` (depends on `@nova/shared`)
3. `@nova/db` (depends on `@nova/shared`)
4. `@nova/ui` (no workspace dependencies)
5. `@nova/server` (depends on `@nova/shared`, `@nova/db`, `@nova/runtime-adapter`)
6. `@nova/web` (standalone Next.js build)

The server compiles TypeScript to JavaScript in its `dist/` directory. The web app produces a Next.js production build.

---

## Type Checking

```bash
pnpm typecheck
```

Runs `tsc --noEmit` in every package that defines a `typecheck` script. This validates types across the entire monorepo without producing output files.

---

## Testing

```bash
pnpm test
```

Runs `pnpm -r --if-present test` across all packages. The server uses **Vitest** as its test runner. Before executing tests, the server builds its shared dependencies to ensure imports resolve correctly.

To run tests for a specific package:

```bash
# Server tests only
pnpm --filter @nova/server run test

# Run a specific test file
pnpm --filter @nova/server exec vitest run src/lib/task-file.test.ts
```

---

## Linting

```bash
pnpm lint
```

Runs `pnpm -r --if-present lint` across all packages. The web frontend uses ESLint with the `eslint-config-next` preset.

---

## Database Schema Generation

```bash
pnpm db:generate
```

Runs `drizzle-kit generate` in the `@nova/db` package. Use this after modifying the Drizzle schema in `packages/db/src/schema.ts` to produce new SQL migration files in `packages/db/drizzle/`.

---

## Command Reference

| Command | Scope | Description |
| ------- | ----- | ----------- |
| `pnpm dev` | All | Start API server (4010) and web frontend (3000) in dev mode |
| `pnpm dev:server` | Server | Start the Fastify API server only |
| `pnpm dev:web` | Web | Start the Next.js frontend only |
| `pnpm build` | All | Production build for every package |
| `pnpm typecheck` | All | Type-check all packages with `tsc --noEmit` |
| `pnpm test` | All | Run test suites across all packages |
| `pnpm lint` | All | Lint all packages |
| `pnpm db:generate` | DB | Generate Drizzle migration files from schema changes |

---

## File Watching

- **Server** -- `tsx watch` monitors `apps/server/src/` and restarts the process on any change. Shared package changes require a manual rebuild or a restart of `pnpm dev`.
- **Web** -- Next.js dev server provides hot module replacement. Changes to components, pages, and styles are reflected instantly in the browser.
