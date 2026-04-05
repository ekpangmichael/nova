# Nova

Nova is a local-first agent orchestration workspace for projects, tasks, and runtime-backed coding agents.

It includes:
- a Next.js dashboard in `apps/web`
- a Fastify API server in `apps/server`
- a SQLite-backed local data store in `.nova-data/`
- runtime adapters for OpenClaw, Codex, and Claude Code

## Current official install path

Nova now ships with a repo-native one-line installer:

```bash
curl -fsSL https://raw.githubusercontent.com/ekpangmichael/nova/main/install.sh | bash
```

That installer:
- clones the latest tagged release when tags exist
- falls back to the repository default branch when no release tags exist yet
- runs `pnpm install`
- runs `pnpm setup`

The equivalent manual source flow is:

```bash
git clone <repo-url> nova
cd nova
pnpm install
pnpm setup
pnpm dev
```

`pnpm setup` is the bootstrap step. It:
- creates `.env.local` from `.env.example` if you do not already have one
- creates the local app-data directory
- detects whether `openclaw`, `codex`, and `claude` are available on your machine
- prints the next steps for local or LAN development

When `pnpm dev` finishes booting, open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Planned npm installer path

This branch also includes a publishable CLI package at [`packages/cli`](packages/cli). Once published, the intended npm-native installer path will be:

```bash
npx nova-cli@latest setup
```

## Quick commands

```bash
pnpm setup
pnpm dev
pnpm dev:lan
pnpm typecheck
pnpm test
pnpm build
```

## Development notes

- App data defaults to `<repo>/.nova-data`.
- Uploaded task attachments live under `.nova-data/attachments/`.
- Agent homes are generated under `.nova-data/agent-homes/`.
- The combined dev launcher starts the API server on `127.0.0.1:4010` and the web app on `127.0.0.1:3000`.
- `pnpm dev:lan` exposes the web app to other devices on the same network.

## Environment

Start from [`.env.example`](.env.example). The most useful variables are:

- `NOVA_RUNTIME_MODE`
- `NOVA_APP_DATA_DIR`
- `OPENCLAW_*`
- `CODEX_*`
- `CLAUDE_*`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

The full install and configuration story lives in the docs:
- [Getting Started](docs/getting-started/index.md)
- [Installation](docs/getting-started/installation.md)
- [Configuration Reference](docs/operations/configuration-reference.md)
