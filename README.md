# Nova

Nova is a local-first orchestration workspace for coding agents. It gives you a web UI for projects, kanban tasks, agent profiles, runtime configuration, execution logs, attachments, and follow-up comments, while keeping your data on your machine.

Nova is for people who want a self-hosted control plane around local coding runtimes such as OpenClaw, Codex, and Claude Code, instead of jumping between separate CLIs and ad hoc notes.

## Who Nova is for

- Solo builders who want a persistent task board and execution log for local coding agents
- Small teams experimenting with agent workflows on trusted machines
- Operators who want one place to manage projects, agents, attachments, task context, and runtime health

## What works today

- Local web dashboard for projects, agents, tasks, runtimes, settings, and logs
- Runtime-backed task execution through:
  - OpenClaw
  - Codex CLI
  - Claude Code CLI
- Task comments, `@agent` handoff, attachments, and execution-log history
- Agent homes with synced workspace files such as `AGENTS.md`, `SOUL.md`, `TOOLS.md`, and `IDENTITY.md`
- Local authentication for Nova itself with email/password or Google sign-in
- LAN development mode for opening Nova from another device on the same network

## Experimental or still evolving

- First-run installer and npm-native install path
- Runtime ergonomics outside the core OpenClaw path
- Some long-running Claude and Codex edge cases around retries and CLI behavior
- Cross-machine usage beyond trusted local or LAN setups
- Public packaging and release workflow

## Install and run quickly

The current official install path is the one-line bootstrap script:

```bash
curl -fsSL https://raw.githubusercontent.com/ekpangmichael/nova/main/install.sh | bash
```

That script:

1. clones the newest tagged release when one exists
2. falls back to the default branch when there are no release tags yet
3. runs `pnpm install`
4. runs `pnpm setup`

Then start Nova:

```bash
cd nova
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) when startup completes.

If you prefer the manual source flow:

```bash
git clone https://github.com/ekpangmichael/nova.git nova
cd nova
pnpm install
pnpm setup
pnpm dev
```

## Runtime overview

Nova supports three real runtime paths today:

| Runtime | How Nova talks to it | Auth model | Models |
| --- | --- | --- | --- |
| OpenClaw | Local CLI + gateway | Your local OpenClaw profile and provider setup | Comes from your local OpenClaw install |
| Codex | Local Codex CLI | Your local Codex login | Curated confirmed Codex model list |
| Claude Code | Local Claude CLI | Your local Claude Code login | Curated confirmed Claude model list |

Setup details, model IDs, and caveats are documented here:

- [Getting Started](docs/getting-started/index.md)
- [Installation](docs/getting-started/installation.md)
- [Runtime Setup](docs/getting-started/runtime-setup.md)
- [Configuration Reference](docs/operations/configuration-reference.md)

## Quick commands

```bash
pnpm setup
pnpm dev
pnpm dev:lan
pnpm typecheck
pnpm test
pnpm build
```

## Local data and environment

Nova stores local state in `.nova-data/` by default:

- SQLite database
- task and comment attachments
- generated agent homes
- local logs and temporary files

Start from [`.env.example`](.env.example). The most useful variables are:

- `NOVA_RUNTIME_MODE`
- `NOVA_APP_DATA_DIR`
- `OPENCLAW_*`
- `CODEX_*`
- `CLAUDE_*`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## Current installation direction

Nova already includes:

- a repo-native installer script: `install.sh`
- a bootstrap step: `pnpm setup`
- a publishable CLI package under [`packages/cli`](packages/cli)

The intended npm-native flow is:

```bash
npx nova-cli@latest setup
```

That path exists in the repo, but it is still part of the packaging work rather than the primary public install channel.
