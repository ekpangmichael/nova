# Prerequisites

Before setting up Nova, make sure the following tools are installed on your system.

---

## Required Software

| Tool | Minimum Version | Purpose |
| ---- | --------------- | ------- |
| **Node.js** | 22.0+ | JavaScript runtime for both the server and frontend |
| **pnpm** | 9.0+ | Package manager and monorepo workspace orchestrator |
| **Git** | 2.30+ | Version control; also used by project seeding and task git context |

### Verifying Versions

```bash
node --version    # Should print v22.x.x or higher
pnpm --version    # Should print 9.x.x or higher
git --version     # Should print 2.30.x or higher
```

---

## Optional Runtime Binaries

Nova manages AI agents through pluggable runtimes. You only need the binaries for the runtimes you intend to use. Nova auto-detects installed binaries on `$PATH`, in nvm-managed Node versions, and at well-known locations.

| Binary | Purpose | Default Lookup |
| ------ | ------- | -------------- |
| `openclaw` | OpenClaw CLI for native and ACP runtimes | `$PATH`, `~/.nvm/versions/node/*/bin/` |
| `codex` | OpenAI Codex CLI runtime | `$PATH`, `~/.nvm/versions/node/*/bin/` |
| `claude` | Anthropic Claude Code CLI runtime | `$PATH`, `~/.local/bin/`, `~/.nvm/versions/node/*/bin/` |

If none of these binaries are present, Nova falls back to its built-in **mock runtime**, which is sufficient for exploring the UI and running the test suite.

---

## System Requirements

- **Operating system** -- macOS, Linux, or Windows (WSL recommended on Windows).
- **Disk space** -- approximately 500 MB for `node_modules` and build artifacts.
- **Ports** -- the dev script expects ports **4010** (API server) and **3000** (web frontend) to be free. If either port is occupied by a previous Nova process, the dev script will terminate it automatically. If the port is held by a non-Nova process, the script will exit with an error.
- **macOS production launcher** -- if you want Nova to run as a background app on macOS, LaunchAgents must be available under `~/Library/LaunchAgents`.

---

## Environment Variables (Optional)

Nova ships with a root `.env.example`. The official path is:

```bash
pnpm setup
```

That bootstrap command copies `.env.example` to `.env.local` if needed. None of the variables are required for a basic local boot; sensible defaults are applied automatically.

The server reads environment variables from `.env` and `.env.local` files at the repository root and inside `packages/`.

Key variables you may want to override:

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PORT` | `4000` | API server port (overridden to `4010` by the dev script) |
| `NOVA_RUNTIME_MODE` | `mock` | Runtime mode: `mock` or `openclaw` |
| `NOVA_APP_DATA_DIR` | `.nova-data/` | Base directory for the SQLite database, attachments, and logs |
| `OPENCLAW_PROFILE` | `apm` | OpenClaw profile name |
| `OPENCLAW_BINARY_PATH` | `openclaw` | Path to the OpenClaw binary |
| `CODEX_BINARY_PATH` | `codex` | Path to the Codex binary |
| `CODEX_DEFAULT_MODEL` | auto-detected | Default model for the Codex runtime |
| `CLAUDE_BINARY_PATH` | `claude` | Path to the Claude Code binary |
| `CLAUDE_DEFAULT_MODEL` | `claude-sonnet-4-6` | Default model for the Claude runtime |

See `apps/server/src/env.ts` for the full schema.
