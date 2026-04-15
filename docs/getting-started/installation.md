# Installation

Nova's current official install path is the repo-native one-line installer.

```bash
curl -fsSL https://raw.githubusercontent.com/ekpangmichael/nova/main/install.sh | bash
```

For the guided production path:

```bash
curl -fsSL https://raw.githubusercontent.com/ekpangmichael/nova/main/install.sh | bash -s -- --production
```

That script clones the newest tagged release when one exists, falls back to the default branch when the repository does not have release tags yet, then either runs Nova's local bootstrap steps or hands off to the production setup wizard.

---

## 1. One-line installer

```bash
curl -fsSL https://raw.githubusercontent.com/ekpangmichael/nova/main/install.sh | bash
```

To install into a different directory:

```bash
curl -fsSL https://raw.githubusercontent.com/ekpangmichael/nova/main/install.sh | bash -s -- --dir my-nova
```

To pin a specific release or branch:

```bash
curl -fsSL https://raw.githubusercontent.com/ekpangmichael/nova/main/install.sh | bash -s -- --ref v0.1.0
```

The installer does four things:

1. clones Nova into `./nova` by default
2. installs dependencies with `pnpm install`
3. runs `pnpm run setup`
4. prints the next steps for starting the app

### Guided production setup

If you want a guided production setup instead of the dev-oriented bootstrap, use:

```bash
npx nova-cli@latest setup-production
```

Or invoke the same wizard through the shell installer:

```bash
curl -fsSL https://raw.githubusercontent.com/ekpangmichael/nova/main/install.sh | bash -s -- --production
```

The wizard is production-focused. It collects the required environment values, writes `.env.local`, and on macOS can install the background LaunchAgent automatically.

---

## 2. Start Nova in development

Run:

```bash
cd nova
pnpm dev
```

The development launcher:

1. loads environment variables from the repository root `.env` and `.env.local`
2. stops stale Nova dev processes from previous sessions
3. starts the Fastify API server on `http://127.0.0.1:4010`
4. waits for `/api/health` to become ready
5. starts the Next.js frontend on `http://127.0.0.1:3000`

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser when startup completes.

---

## 3. Start Nova in production

For a foreground production run on any platform:

```bash
cd nova
pnpm build
pnpm start
```

The production launcher:

1. verifies the built server and web artifacts exist
2. starts the Fastify API server on `http://127.0.0.1:4000`
3. waits for `/api/health` to become ready
4. starts the Next.js app on `http://127.0.0.1:3000`

Use this when you want production behavior without installing a background service.

### macOS background service

On macOS, Nova can run as a LaunchAgent:

```bash
cd nova
pnpm build
pnpm service:macos:install
```

This writes `~/Library/LaunchAgents/ai.nova.production.plist`, starts Nova at login, and keeps it running in the background.

Useful service commands:

```bash
pnpm service:macos:status
pnpm service:macos:restart
pnpm service:macos:stop
pnpm service:macos:uninstall
```

Service logs are written under `.nova-data/logs/`.

---

## 4. Manual source install

If you prefer not to use the one-line installer, the equivalent manual flow is:

```bash
git clone https://github.com/ekpangmichael/nova.git nova
cd nova
pnpm install
pnpm run setup
pnpm dev
```

---

## 5. LAN access

If you want to open Nova from another device on the same network, use:

```bash
pnpm dev:lan
```

This exposes the web frontend on your LAN IP and prints the URL to open from another machine.

---

## 6. Runtime onboarding

Nova can run without external runtimes in mock mode, but most real agent workflows need one or more local runtimes:

- OpenClaw
- Codex
- Claude Code

Nova will detect installed runtime binaries during `pnpm run setup`, and you can finish runtime configuration from the `/runtimes` page after the app is running.

For setup details, authentication expectations, supported models, and caveats, continue to [Runtime Setup](./runtime-setup.md).

---

## 7. Local data storage

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

### `pnpm run setup` says a runtime is not found

That is not fatal. Nova can still boot in mock mode. You only need a runtime binary installed for the runtime you want to use.

### Port 3000 or 4010 is already in use

The dev launcher can clean up stale Nova processes, but it will stop if a non-Nova process is holding the port. Free the port and rerun `pnpm dev`.

### `pnpm start` says production artifacts are missing

Run `pnpm build` first. The production launcher only works from the compiled server output and the built Next.js app.

### The macOS service cannot find `openclaw`, `codex`, or `claude`

The LaunchAgent captures your current shell `PATH` at install time. If your runtime binary locations changed, rerun:

```bash
pnpm service:macos:install
```

### I need Google sign-in

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`. For local-only auth, email/password works without Google OAuth.

### I want to customize config first

Start from [`.env.example`](../../.env.example) and edit `.env.local` after `pnpm run setup`.
