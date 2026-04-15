# Nova

Nova is a local-first platform for managing coding agents. It gives you a single dashboard to create projects, assign tasks, run agents on different runtimes, and track everything that happens — without sending your data anywhere.

Instead of jumping between separate CLIs and scattered notes, Nova puts your projects, tasks, agent configurations, execution logs, and follow-up comments in one place, all stored locally on your machine.

## Why Nova

Most agent tooling today is either a hosted service you don't control, or a bare CLI with no memory between sessions. Nova sits in between: a proper management layer that stays local.

- **One interface for multiple runtimes.** Use OpenClaw, Codex, or Claude Code from the same task board. Switch runtimes per agent without changing your workflow.
- **Persistent context.** Projects, tasks, comments, attachments, and execution history survive across sessions. When something fails, you can see exactly what happened and why.
- **Local by default.** SQLite database, file attachments, and agent configurations all live on your machine. No accounts, no cloud dependencies, no data leaving your network.

## Who it's for

- Developers using AI coding agents who want structure around their work
- Small teams running agents on trusted machines who need shared visibility
- Anyone tired of managing agent context across disconnected tools

## What works today

- Web dashboard for projects, agents, tasks, runtimes, and settings
- Task execution through OpenClaw, Codex CLI, and Claude Code CLI
- Kanban boards with drag-and-drop, priorities, labels, and due dates
- Task comments with `@agent` mentions for follow-up and handoff
- File attachments on tasks and comments
- Agent Homes with synced files like `AGENTS.md`, `SOUL.md`, and `IDENTITY.md`
- Structured execution logs with streaming output, tool calls, and failure reasons
- Browser notifications for run completions, failures, and blocked tasks
- Local auth with email/password or Google sign-in
- LAN mode for accessing Nova from another device on your network

## What's still evolving

- First-run packaging and `npm`-native install path
- Runtime ergonomics outside the core OpenClaw path
- Retry and long-run edge cases for Codex and Claude Code
- Cross-machine usage beyond local and LAN setups

## Use Nova

If you want to run Nova as an operator, use the guided installer instead of cloning the repo manually:

```bash
curl -fsSL https://raw.githubusercontent.com/ekpangmichael/nova/main/install.sh | bash -s -- --production
```

That flow is production-oriented. It:

- clones or reuses a Nova checkout
- asks for the required production settings
- writes the canonical root `.env.local`
- stores persistent app data in `~/.nova` by default
- can build Nova for production
- on macOS, can install the LaunchAgent service for you

If you want a direct CLI entrypoint instead of the shell wrapper:

```bash
npx nova-cli@latest setup-production
```

After setup:

- foreground production run: `pnpm start`
- macOS service status: `pnpm service:macos:status`
- macOS service restart: `pnpm service:macos:restart`
- macOS service stop: `pnpm service:macos:stop`
- macOS service uninstall: `pnpm service:macos:uninstall`

Open Nova at the web origin you configured during setup. By default that is [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Develop Nova

If you want to contribute, debug, or run Nova in local development mode, use the repo workflow:

```bash
git clone https://github.com/ekpangmichael/nova.git
cd nova
pnpm install
pnpm run setup
pnpm dev
```

This starts the Fastify backend and the Next.js frontend in development mode.

## Environment Configuration

The canonical place for local configuration is root `.env.local`.

Use:

- `.env.example` as the template
- `.env.local` for real machine-specific values

Do not rely on `packages/.env` or `packages/.env.local` for app or runtime secrets.

## Runtimes

Nova connects to three runtimes today. Each uses its own local CLI and authentication:

| Runtime | Connection | Auth | Models |
| --- | --- | --- | --- |
| OpenClaw | Local CLI + gateway | OpenClaw profile | From your local install |
| Codex | Codex CLI | ChatGPT login | Curated model list |
| Claude Code | Claude Code CLI | Anthropic login | Curated model list |

See the [Runtime Setup](docs/getting-started/runtime-setup.md) guide for configuration details.

## Commands

```bash
pnpm run setup      # First-time setup
pnpm dev            # Start Nova (API + web)
pnpm dev:lan        # Start with LAN access
pnpm start          # Start Nova from built production artifacts
pnpm service:macos:install  # Install a macOS LaunchAgent
pnpm service:macos:status   # Check the macOS service
pnpm docs:dev       # Start the docs site
pnpm typecheck      # Type-check all packages
pnpm test           # Run all tests
pnpm build          # Production build
```

## Project structure

```
nova/
  apps/
    server/          Fastify 5 API + WebSocket server
    web/             Next.js 16 dashboard
  packages/
    shared/          Domain types and contracts
    db/              Drizzle ORM schema (SQLite)
    runtime-adapter/ Runtime adapter interface
    ui/              Shared component library
    cli/             CLI package (in progress)
  docs/              Project documentation (VitePress)
```

## Local data

Nova uses two sensible defaults depending on how you run it:

- development: `<repo>/.nova-data`
- production installer: `~/.nova`

That directory holds:

- SQLite database
- Task and comment attachments
- Agent Homes
- Logs and temporary files

Start from `.env.example` and write your real values into root `.env.local`. Key variables:

| Variable | Purpose |
| --- | --- |
| `NOVA_RUNTIME_MODE` | Runtime mode (`live` or `mock`) |
| `NOVA_APP_DATA_DIR` | Data directory path |
| `OPENCLAW_*` | OpenClaw CLI and gateway config |
| `CODEX_*` | Codex CLI config |
| `CLAUDE_*` | Claude Code CLI config |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (optional) |

## Documentation

Full docs are available at the [docs site](docs/index.md) or by running:

```bash
pnpm docs:dev
```

## License

MIT
