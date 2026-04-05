# Database Overview

Nova uses **SQLite** as its embedded relational database, accessed through **libsql** (the Turso fork of SQLite) and **Drizzle ORM** for schema definition, queries, and migrations.

## Technology Stack

| Component | Library | Purpose |
|-----------|---------|---------|
| Database engine | SQLite via `@libsql/client` | Embedded relational storage |
| ORM | `drizzle-orm` (SQLite dialect) | Schema definition, type-safe queries |
| Migrations | `drizzle-orm/libsql/migrator` | Forward-only SQL migrations |

The database layer lives in the `packages/db` package and is consumed by the Fastify server in `apps/server`.

## Database Initialization

The database is created and configured in `packages/db/src/client.ts` through the `createDatabaseContext()` function. This function:

1. Ensures the parent directory for the database file exists.
2. Opens an embedded libsql connection using the `file:` URL scheme.
3. Enables **WAL (Write-Ahead Logging)** mode for concurrent read performance.
4. Enables **foreign key enforcement** so referential integrity constraints are always checked.
5. Wraps the connection in a Drizzle ORM instance with the full schema loaded.

```typescript
export const createDatabaseContext = async (
  dbPath: string
): Promise<DatabaseContext> => {
  mkdirSync(dirname(dbPath), { recursive: true });

  const client = createClient({
    url: `file:${dbPath}`,
  });

  await client.execute("PRAGMA journal_mode = WAL");
  await client.execute("PRAGMA foreign_keys = ON");

  const db = drizzle(client, { schema });

  return { client, db, close: async () => { client.close(); } };
};
```

## Key Design Decisions

- **WAL mode**: The `PRAGMA journal_mode = WAL` setting allows readers and a single writer to operate concurrently without blocking each other. This is important because Nova streams runtime events while the dashboard reads task state.
- **Foreign keys ON**: The `PRAGMA foreign_keys = ON` setting ensures that all foreign key references are enforced at the database level, not just in application code.
- **Text-based IDs**: All primary keys are `text` columns holding application-generated UUIDs, not auto-incrementing integers.
- **ISO timestamps as text**: All `created_at` and `updated_at` columns store ISO 8601 timestamp strings rather than integer epoch values.
- **JSON-in-text columns**: Several tables store auxiliary data as JSON strings in `text` columns (e.g., `tags_json`, `labels_json`, `usage_json`, `payload_json`).

## Migration System

Migrations are SQL files stored in `packages/db/drizzle/` and tracked by a journal file at `packages/db/drizzle/meta/_journal.json`. Drizzle runs them in order on startup via the `migrateDatabase()` function.

See [migrations.md](./migrations.md) for full details.

## Schema at a Glance

The schema defines 13 tables covering application settings, authentication, projects, agents, tasks, and runtime execution:

| Table | Purpose |
|-------|---------|
| `settings` | Single-row application configuration |
| `users` | Registered user accounts |
| `userSessions` | Session tokens for authenticated users |
| `projects` | Top-level project containers |
| `agents` | AI agent definitions and runtime bindings |
| `projectAgents` | Many-to-many join between projects and agents |
| `tasks` | Work items assigned to agents within projects |
| `taskDependencies` | Directed dependency edges between tasks |
| `taskComments` | Human and agent comments on tasks |
| `taskAttachments` | File attachments on tasks |
| `taskRuns` | Individual execution attempts for a task |
| `runEvents` | Ordered stream of events within a run |
| `runArtifacts` | Files produced or modified during a run |

See [schema-reference.md](./schema-reference.md) for complete column-level documentation.

## Exported Types

The `packages/db` package exports the following key types:

- `AppDatabase` -- The Drizzle database instance type, parameterized with the full schema.
- `DatabaseContext` -- A bundle of the libsql `Client`, the `AppDatabase`, and a `close()` function.

## Source Files

| File | Description |
|------|-------------|
| `packages/db/src/schema.ts` | Drizzle table definitions and schema export |
| `packages/db/src/client.ts` | Database creation, PRAGMA configuration, migration runner |
| `packages/db/drizzle/*.sql` | SQL migration files (0000 through 0009) |
| `packages/db/drizzle/meta/_journal.json` | Migration journal tracking applied migrations |
