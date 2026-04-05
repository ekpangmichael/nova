# Code Conventions

## Language

All code is written in **TypeScript** with strict mode enabled. Both the frontend and backend target modern ESM.

## Canonical Terms

The following terms must be used consistently in code, documentation, and UI text. Do not use "workspace" as a generic product term.

| Term | Meaning |
|---|---|
| **Agent Home** | The on-disk directory structure that defines an agent's identity, directives, tools, and local state. |
| **Project Root** | The filesystem path of a project's source code root directory. Stored as `projectRoot` on `ProjectRecord`. |
| **Execution Target** | The directory where an agent executes a task. May differ from the Project Root (e.g., a subdirectory or a separate checkout). Stored as `resolvedExecutionTarget` on `TaskRecord`, with an optional `executionTargetOverride`. |

## Naming Patterns

### Files

- Source files: `kebab-case.ts` (e.g., `task-file.ts`, `runtime-manager.ts`).
- Test files: `<name>.test.ts` or `<name>.integration.test.ts`, co-located with the source.
- React components: `kebab-case.tsx` for the file, `PascalCase` for the exported component.

### Variables and Functions

- Local variables and functions: `camelCase`.
- Constants: `UPPER_SNAKE_CASE` for true constants (e.g., `TASK_STATUSES`, `APP_NAME`), `camelCase` for derived or computed values.
- Types and interfaces: `PascalCase`.
- Enum-like arrays: `UPPER_SNAKE_CASE` with `as const` assertion (e.g., `TASK_STATUSES`).

### Database

- Table names: `snake_case` (e.g., `task_runs`, `run_events`).
- Column names: `snake_case` (e.g., `created_at`, `assigned_agent_id`).

### API

- URL paths: `kebab-case` (e.g., `/runtimes/openclaw/catalog`).
- Request/response bodies: `camelCase` JSON keys.

## Validation

Use **Zod** for runtime validation of:

- Environment variables (`apps/server/src/env.ts`).
- API request bodies (in Fastify route handlers).
- Configuration files.

Define the Zod schema as the source of truth and derive TypeScript types from it where possible.

## Error Handling

### Backend

- Throw structured errors that Fastify serializes as JSON: `{ error: { code: string, message: string, details?: unknown } }`.
- Use standard HTTP status codes.

### Frontend

- API errors are caught and thrown as `ApiError` instances (see `lib/api.ts`).
- Server components catch `ApiError` and render inline error messages.
- Client components display errors in UI-appropriate formats (banners, toasts, inline text).

## Shared Types

All domain types that cross the frontend/backend boundary must be defined in `@nova/shared`. Do not duplicate type definitions between `apps/web` and `apps/server`.

The frontend `lib/api.ts` defines its own API-specific types (prefixed with `Api`) that represent the shapes returned by API endpoints. These may extend or transform the shared record types.

## Frontend Conventions

### Server Components vs. Client Components

- Default to server components. Only add `"use client"` when the component needs browser APIs, event handlers, or React hooks.
- Server components call `lib/api.ts` functions directly for data fetching.
- Client components use `lib/api.ts` functions for mutations (POST, PATCH, DELETE) and call `router.refresh()` after successful mutations to re-fetch server data.

### Styling

- Use Tailwind CSS utility classes exclusively. No CSS modules or styled-components.
- Reference design tokens via Tailwind classes (e.g., `bg-surface-container-low`, `text-tertiary`).
- Custom utilities are defined in `globals.css` using `@utility`.
- See the [Styling guide](../frontend/styling.md) for the full token reference.

### Icons

- Use Material Symbols Outlined via the `Icon` component.
- Reference icons by their Material Symbol name (e.g., `play_circle`, `smart_toy`, `folder_open`).

## Backend Conventions

### Framework

The backend uses **Fastify** (not NestJS, not Express). Route handlers are registered as Fastify plugins in the `routes/` directory.

### Database

- Use **Drizzle ORM** for all database operations.
- Schema is defined in `packages/db/src/schema.ts`.
- Migrations are generated with `pnpm db:generate` and stored in `packages/db/drizzle/`.

### Service Layer

Business logic lives in service classes (e.g., `NovaService`, `RuntimeManager`) instantiated in the Fastify app factory. Route handlers delegate to services rather than containing business logic directly.

## Git Conventions

- Branch from `main` for feature work.
- Keep commits focused and well-described.
- Run `pnpm typecheck && pnpm test && pnpm build` before pushing.
