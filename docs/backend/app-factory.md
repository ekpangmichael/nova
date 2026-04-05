# App Factory -- createApp()

The entry point for the Nova backend is the `createApp()` function exported from `apps/server/src/app.ts`. It assembles the entire Fastify application: database, services, middleware, routes, error handling, and shutdown hooks.

## Signature

```ts
type CreateAppOptions = {
  envOverrides?: Partial<NodeJS.ProcessEnv>;
  logger?: boolean | FastifyBaseLogger;
};

type AppContext = {
  app: FastifyInstance;
  env: AppEnv;
  services: AppServices;
};

createApp(options?: CreateAppOptions): Promise<AppContext>
```

## Initialization Sequence

### 1. Environment Loading

`loadEnv()` (from `env.ts`) parses and validates environment variables using a Zod schema. It resolves all runtime binary paths, state directories, and configuration file paths. Key variables:

| Variable              | Default       | Description                        |
| --------------------- | ------------- | ---------------------------------- |
| `HOST`                | `0.0.0.0`    | Bind address                       |
| `PORT`                | `4000`        | Listen port                        |
| `NODE_ENV`            | `development` | `development`, `test`, `production`|
| `NOVA_APP_DATA_DIR`   | `.nova-data`  | Root for SQLite DB, attachments, logs |
| `NOVA_RUNTIME_MODE`   | `mock`        | `mock` or `openclaw`               |

The `envOverrides` option allows tests to inject custom env values without touching `process.env`.

### 2. Database Initialization

```ts
const database = await createDatabaseContext(env.dbPath);
await migrateDatabase(database.db);
```

The database context is created from `@nova/db`. It opens (or creates) an SQLite database at `env.dbPath` (default: `.nova-data/db/app.db`) and runs all pending Drizzle migrations.

### 3. Service Registration

Four service instances are created and composed:

```ts
const websocketHub = new WebsocketHub();
const runtimeManager = new RuntimeManager(env);
const auth = new AuthService(database.db);
const nova = new NovaService({ db, env, runtimeManager, websocketHub });
```

After construction, `nova.bootstrap()` is called. Bootstrap creates required data directories (attachments, logs, temp, agent-homes), initializes the settings row if absent, and reconciles any incomplete runs from a previous process crash.

### 4. Fastify Decorator

All services are bundled into an `AppServices` object and attached to the Fastify instance:

```ts
app.decorate("services", services);
```

This makes `app.services` (and `request.server.services`) available in every route handler.

### 5. Plugin Registration

Three Fastify plugins are registered:

- **@fastify/cors** -- Configured with `origin: true` (reflect request origin).
- **@fastify/multipart** -- File uploads limited to 1 file, 25 MB max.
- **@fastify/websocket** -- Enables the `/ws` WebSocket endpoint.

### 6. WebSocket Endpoint

The `/ws` route is registered directly on the app (outside the `/api` prefix). It authenticates the connection by reading the session token from either the `x-nova-session-token` header or the `nova_session` cookie. Authentication is skipped in `test` environment. On success, the socket is handed to `WebsocketHub.handleConnection()`.

### 7. Authentication Middleware (preHandler)

A `preHandler` hook runs before every request:

1. Sets `request.authSession = null`.
2. Skips authentication for `OPTIONS` requests, test environment, and public paths (`/api/auth`, `/api/health`).
3. Reads the session token from the `x-nova-session-token` header or `nova_session` cookie.
4. Calls `auth.getSessionByToken()` to validate and attach the session.
5. Throws `401 unauthorized` if no valid session is found.

### 8. Route Registration

All API routes are registered under the `/api` prefix:

```ts
await app.register(apiRoutes, { prefix: "/api" });
```

### 9. Error Handling

Two handlers are configured:

- **Error handler** -- If the error is an `ApiError`, it returns a structured JSON response with `{ error: { code, message, details } }`. Otherwise, it logs the error and returns a generic 500 response.
- **Not found handler** -- Returns `404` with code `not_found`.

### 10. Shutdown Hook

An `onClose` hook ensures graceful cleanup:

```ts
app.addHook("onClose", async () => {
  await services.nova.close();
  await services.runtimeManager.close();
  await database.close();
});
```

This stops all active run subscriptions, closes runtime adapters, and closes the database connection.

## AppServices Type

```ts
type AppServices = {
  env: AppEnv;
  db: AppDatabase;
  sqlite: DatabaseContext["client"];
  auth: AuthService;
  runtimeManager: RuntimeManager;
  websocketHub: WebsocketHub;
  nova: NovaService;
};
```
