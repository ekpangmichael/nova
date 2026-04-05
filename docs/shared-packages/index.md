# Shared Packages

Nova uses a pnpm monorepo with several internal packages shared between the frontend (`apps/web`) and backend (`apps/server`). Each package is scoped under `@nova/`.

## Package Map

| Package | Directory | Description |
|---|---|---|
| `@nova/shared` | `packages/shared` | Domain constants, enum arrays, record types, DTO contracts, and JSON utility types. Imported by both server and web. |
| `@nova/db` | `packages/db` | Drizzle ORM schema definitions and migration files for the SQLite database. Used exclusively by the server. |
| `@nova/runtime-adapter` | `packages/runtime-adapter` | Abstract interface for runtime execution backends. Defines the contract that concrete adapters (mock, OpenClaw, Codex, Claude Code) must implement. |

## Dependency Flow

```
apps/web ──────> @nova/shared
apps/server ──> @nova/shared
            ──> @nova/db
            ──> @nova/runtime-adapter ──> @nova/shared
```

The web frontend only depends on `@nova/shared` for type definitions. It never imports `@nova/db` or `@nova/runtime-adapter` directly.

## Package Details

- **[@nova/shared](./nova-shared.md)** -- Complete reference of all exported enums, record types, and DTO shapes.
- **@nova/db** -- See the [Backend Architecture documentation](../backend/index.md) for schema details. Uses Drizzle ORM with SQLite and stores migrations in `packages/db/drizzle/`.
- **@nova/runtime-adapter** -- Defines `RuntimeAdapter`, `RuntimeCapabilities`, `RuntimeCatalog`, and event types used by the server's `RuntimeManager` to abstract over different AI execution runtimes.

## Build and Type Checking

All packages are built and type-checked via the root `pnpm` scripts:

```bash
pnpm build       # Build all packages and apps
pnpm typecheck   # Type-check all packages and apps
pnpm test        # Run tests across all packages
```
