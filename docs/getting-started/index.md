# Getting Started

This section covers the public install path for Nova and the runtime setup needed for real agent work.

## What you will have at the end

- Nova running at [http://127.0.0.1:3000](http://127.0.0.1:3000)
- production app data under `~/.nova` by default
- runtime detection completed for OpenClaw, Codex, and Claude Code
- enough setup to sign in and start configuring projects, agents, and tasks

## Guides

| Guide | Description |
| ----- | ----------- |
| [Prerequisites](./prerequisites.md) | Tooling and environment assumptions |
| [Installation](./installation.md) | Bootstrap install and first launch |
| [Runtime Setup](./runtime-setup.md) | OpenClaw, Codex, and Claude auth/setup requirements |
| [Development Workflow](./development-workflow.md) | Day-to-day local development commands |
| [Project Structure](./project-structure.md) | Monorepo layout and major packages |

## Quick start

If you want to use Nova, run the guided production installer:

```bash
curl -fsSL https://raw.githubusercontent.com/ekpangmichael/nova/main/install.sh | bash -s -- --production
```

If you want to contribute or run Nova in development mode, follow the development workflow instead:

```bash
git clone https://github.com/ekpangmichael/nova.git nova
cd nova
pnpm install
pnpm run setup
pnpm dev
```

## What is production-ready versus still moving

### Solid today

- local dashboard and API
- projects, tasks, attachments, comments, logs, and runtime configuration
- OpenClaw integration
- local Codex and Claude Code integrations

### Still evolving

- first-run packaging and installer ergonomics
- public release workflow
- some runtime-specific retry and edge-case behavior

If you want to use Nova primarily as an operator dashboard around local coding agents, it is already useful. If you want a polished public installer or a hosted SaaS experience, that is not the current target.
