# Installation

Nova's current official install path is **source install with bootstrap**.

That means the supported first-run workflow today is:

1. clone the repository
2. install dependencies
3. run `pnpm setup`
4. run `pnpm dev`

This keeps the install story simple now, while leaving room for a future standalone installer or npm bootstrap package.

---

## 1. Clone the repository

```bash
git clone <repo-url> nova
cd nova
```

---

## 2. Install dependencies

Nova is a pnpm workspace monorepo. Install everything with one command:

```bash
pnpm install
```

---

## 3. Bootstrap the local workspace

Run:

```bash
pnpm setup
```

The bootstrap script does three things:

1. creates `.env.local` from `.env.example` if you do not already have one
2. ensures the local app-data directory exists
3. detects local runtime binaries like `openclaw`, `codex`, and `claude`

It does **not** overwrite an existing `.env.local`.

If you want to inspect or change configuration before the first run, edit `.env.local` after this step.

---

## 4. Start Nova

Run:

```bash
pnpm dev
```

The development launcher:

1. loads environment variables from `.env`, `.env.local`, and `packages/.env*`
2. stops stale Nova dev processes from previous sessions
3. starts the Fastify API server on `http://127.0.0.1:4010`
4. waits for `/api/health` to become ready
5. starts the Next.js frontend on `http://127.0.0.1:3000`

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser when startup completes.

---

## LAN access

If you want to open Nova from another device on the same network, use:

```bash
pnpm dev:lan
```

This exposes the web frontend on your LAN IP and prints the URL to open from another machine.

---

## Runtime onboarding

Nova can run without external runtimes in mock mode, but most real agent workflows need one or more local runtimes:

- OpenClaw
- Codex
- Claude Code

Nova will detect installed runtime binaries during `pnpm setup`, and you can finish runtime configuration from the `/runtimes` page after the app is running.

---

## Local data storage

Nova stores local state in `.nova-data/` by default, unless overridden by `NOVA_APP_DATA_DIR`.

Typical contents:

| Path | Contents |
| ---- | -------- |
| `.nova-data/db/app.db` | SQLite database |
| `.nova-data/attachments/` | Task and comment attachments |
| `.nova-data/logs/` | Local server logs |
| `.nova-data/temp/` | Temporary files |
| `.nova-data/agent-homes/` | Generated agent homes |

This directory is local-only and git-ignored.

---

## Troubleshooting

### `pnpm setup` says a runtime is not found

That is not fatal. Nova can still boot in mock mode. You only need a runtime binary installed for the runtime you want to use.

### Port 3000 or 4010 is already in use

The dev launcher can clean up stale Nova processes, but it will stop if a non-Nova process is holding the port. Free the port and rerun `pnpm dev`.

### I need Google sign-in

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`. For local-only auth, email/password works without Google OAuth.

### I want to customize config first

Start from [`.env.example`](../../.env.example) and edit `.env.local` after `pnpm setup`.
