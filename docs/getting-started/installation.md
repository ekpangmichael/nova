# Installation

This page covers cloning the repository, installing dependencies, and launching Nova for the first time.

---

## 1. Clone the Repository

```bash
git clone <repo-url> nova
cd nova
```

---

## 2. Install Dependencies

Nova is a pnpm workspace monorepo. A single install command pulls dependencies for every package and application.

```bash
pnpm install
```

This installs dependencies for:

- `apps/server` (`@nova/server`)
- `apps/web` (`@nova/web`)
- `packages/shared` (`@nova/shared`)
- `packages/db` (`@nova/db`)
- `packages/runtime-adapter` (`@nova/runtime-adapter`)
- `packages/ui` (`@nova/ui`)

---

## 3. First Run

Start both the API server and web frontend with a single command:

```bash
pnpm dev
```

The dev script (`scripts/dev.mjs`) performs the following sequence:

1. Loads environment variables from `.env` and `.env.local` files at the repo root and `packages/` directory.
2. Terminates any lingering Nova dev processes from previous sessions.
3. Frees port **4010** if occupied by a prior Nova server and verifies port **3000** is available.
4. Starts the Fastify API server on `http://127.0.0.1:4010` via `pnpm --filter @nova/server run dev`, which first builds shared dependencies (`@nova/shared`, `@nova/runtime-adapter`, `@nova/db`) then launches `tsx watch src/index.ts`.
5. Polls `http://127.0.0.1:4010/api/health` until the server responds with `{"service": "nova-server"}` (up to 30 seconds).
6. Starts the Next.js frontend on `http://127.0.0.1:3000` with `NOVA_BACKEND_URL` set to `http://127.0.0.1:4010/api`.

Once both processes are running, open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser.

---

## 4. Verify the Server

You can confirm the API server is healthy independently:

```bash
curl http://127.0.0.1:4010/api/health
```

Expected response:

```json
{
  "service": "nova-server"
}
```

---

## 5. Local Data Storage

Nova stores all persistent data in the `.nova-data/` directory at the repository root (configurable via `NOVA_APP_DATA_DIR`). This directory contains:

| Path | Contents |
| ---- | -------- |
| `.nova-data/db/app.db` | SQLite database |
| `.nova-data/attachments/` | Uploaded task attachments |
| `.nova-data/logs/` | Server logs |
| `.nova-data/temp/` | Temporary files |
| `.nova-data/agent-homes/` | Per-agent home directories managed by runtimes |

The `.nova-data/` directory is git-ignored. To reset all local state, delete it and restart the server.

---

## Troubleshooting

### Port Already in Use

If port 4010 or 3000 is occupied by a non-Nova process, the dev script exits with an error message indicating the PID. Free the port and try again:

```bash
# Find and stop the process on port 4010
lsof -ti tcp:4010 | xargs kill
```

### Shared Package Build Failures

The server and web app depend on shared packages being built first. If you see import errors referencing `@nova/shared`, `@nova/db`, or `@nova/runtime-adapter`, build them manually:

```bash
pnpm -r --if-present build
```

### Database Schema Changes

After pulling changes that include new migration files in `packages/db/drizzle/`, regenerate the schema:

```bash
pnpm db:generate
```
