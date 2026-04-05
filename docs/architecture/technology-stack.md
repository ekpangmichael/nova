# Technology Stack

This document lists every significant technology used in the Nova monorepo, where
it is used, and its role in the system.

## Core Stack

| Technology          | Version   | Package(s)           | Role                                    |
|---------------------|-----------|----------------------|-----------------------------------------|
| TypeScript          | ^5.0      | All                  | Language for all source code             |
| pnpm                | --        | Root                 | Package manager and workspace orchestration |
| Node.js             | 20+       | All                  | Runtime for server and build tooling     |

## Frontend (`@nova/web`)

| Technology          | Version   | Role                                                   |
|---------------------|-----------|--------------------------------------------------------|
| Next.js             | 16.2.1    | React framework; App Router, server components, API routes |
| React               | 19.2.4    | UI component library                                   |
| React DOM           | 19.2.4    | DOM rendering for React                                |
| Tailwind CSS        | ^4        | Utility-first CSS framework                            |
| @tailwindcss/postcss| ^4        | PostCSS integration for Tailwind                       |
| dnd-kit/core        | ^6.3.1    | Drag-and-drop primitives for Kanban board              |
| dnd-kit/sortable    | ^10.0.0   | Sortable list support for dnd-kit                      |
| dnd-kit/utilities   | ^3.2.2    | Shared utilities for dnd-kit                           |
| react-markdown      | ^10.1.0   | Markdown rendering for task descriptions and comments  |
| remark-gfm          | ^4.0.1    | GitHub Flavored Markdown plugin for react-markdown     |
| clsx                | ^2.1.1    | Conditional className utility                          |
| tailwind-merge      | ^3.5.0    | Intelligent Tailwind class deduplication               |
| ESLint              | ^9        | Code linting                                           |
| eslint-config-next  | 16.2.1    | Next.js-specific ESLint rules                          |

## Backend (`@nova/server`)

| Technology          | Version   | Role                                                   |
|---------------------|-----------|--------------------------------------------------------|
| Fastify             | ^5.0.0    | HTTP server framework                                  |
| @fastify/cors       | ^10.0.0   | CORS middleware                                        |
| @fastify/multipart  | ^9.0.0    | Multipart file upload handling (25 MB limit)           |
| @fastify/websocket  | ^11.0.0   | WebSocket support for real-time event broadcasting     |
| ws                  | ^8.18.0   | WebSocket implementation used by Fastify plugin        |
| Zod                 | ^4.0.0    | Request validation and schema definition               |
| Drizzle ORM         | ^0.43.0   | Type-safe SQL query builder and ORM                    |
| mime-types          | ^2.1.35   | MIME type detection for file attachments               |
| tsx                 | ^4.0.0    | TypeScript execution for development (watch mode)      |
| Vitest              | ^3.0.0    | Test runner                                            |

## Database (`@nova/db`)

| Technology          | Version   | Role                                                   |
|---------------------|-----------|--------------------------------------------------------|
| @libsql/client      | ^0.15.10  | SQLite client (libsql-compatible)                      |
| Drizzle ORM         | ^0.43.0   | Schema definition, query building, migrations          |
| drizzle-kit         | ^0.31.0   | Migration generation tool                              |

## Shared Packages

### `@nova/shared`

Zero-dependency package containing domain constants, enums, and TypeScript type
definitions. Used by all other packages.

### `@nova/runtime-adapter`

Depends only on `@nova/shared`. Defines the `RuntimeAdapter` interface and all
associated types for runtime communication. No runtime or framework
dependencies.

## Architecture Diagram with Technologies

```
+------------------------------------------------------------------+
|  @nova/web                                                        |
|  Next.js 16 + React 19 + Tailwind CSS 4                         |
|  dnd-kit (drag-and-drop) + react-markdown                        |
|                                                                  |
|  /api/backend/[...path] -- reverse proxy to Fastify              |
+------------------+-----------------------------------------------+
                   |
                   | HTTP (fetch)
                   |
+------------------v-----------------------------------------------+
|  @nova/server                                                     |
|  Fastify 5 + Zod 4 (validation) + @fastify/websocket            |
|                                                                  |
|  NovaService -- core business logic                              |
|  RuntimeManager -- adapter registry                              |
|  WebsocketHub -- real-time event broadcast                       |
|  AuthService -- session-based authentication                     |
+-------+-----------+---------------------------------------------+
        |           |
        |           | RuntimeAdapter interface
        v           v
+-------+---+  +----+------+  +-----------+  +------------------+
| @nova/db  |  | OpenClaw  |  | Claude    |  | Codex            |
| Drizzle   |  | Adapter   |  | Adapter   |  | Adapter          |
| SQLite    |  +-----------+  +-----------+  +------------------+
| (libsql)  |
+-----------+
        |
        v
+-------+---+
| @nova/    |
| shared    |
| (types)   |
+-----------+
```

## Build and Development Tooling

| Tool                | Purpose                                                |
|---------------------|--------------------------------------------------------|
| pnpm                | Workspace management, dependency resolution, script running |
| tsc                 | TypeScript compilation for all packages                |
| tsx                 | Development-mode TypeScript execution with watch       |
| next dev / build    | Frontend development server and production build       |
| drizzle-kit         | Database migration generation from schema changes      |
| vitest              | Unit and integration testing (backend)                 |
| eslint              | Static analysis and code style enforcement (frontend)  |

## Development Commands

```bash
# Start both frontend and backend in development mode
pnpm dev

# Start only the frontend
pnpm dev:web

# Start only the backend
pnpm dev:server

# Build all packages
pnpm build

# Run all type checks
pnpm typecheck

# Run all tests
pnpm test

# Generate database migrations after schema changes
pnpm db:generate
```

## Key Version Notes

- **Next.js 16** introduces breaking changes from earlier versions. Consult
  the guides in `node_modules/next/dist/docs/` before modifying frontend code.
- **React 19** is used with server components and the new use() hook patterns.
- **Tailwind CSS 4** uses the new PostCSS-based configuration (no
  `tailwind.config.js`).
- **Zod 4** is used in the backend for request schema validation.
- **Drizzle ORM 0.43** with the SQLite dialect and libsql driver.
