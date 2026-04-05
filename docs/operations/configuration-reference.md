# Configuration Reference

Nova's backend is configured through environment variables. All variables are validated at startup using Zod in `apps/server/src/env.ts`.

## Server Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `HOST` | string | `0.0.0.0` | Host address the Fastify server binds to. |
| `PORT` | number | `4000` | Port the Fastify server listens on. |
| `NODE_ENV` | enum | `development` | One of `development`, `test`, or `production`. |

## Application Data

| Variable | Type | Default | Description |
|---|---|---|---|
| `NOVA_APP_DATA_DIR` | string | `<repo-root>/.nova-data` | Root directory for all Nova persistent data. Contains the database, attachments, logs, temp files, and Agent Home directories. |

The application data directory contains the following subdirectories (created automatically):

| Subdirectory | Description |
|---|---|
| `db/` | SQLite database file (`app.db`). |
| `attachments/` | Uploaded task attachment files. |
| `logs/` | Application log files. |
| `temp/` | Temporary files. |
| `agent-homes/` | Default location for Agent Home directories. |

## Runtime Mode

| Variable | Type | Default | Description |
|---|---|---|---|
| `NOVA_RUNTIME_MODE` | enum | `mock` | The primary runtime mode. One of `mock` or `openclaw`. In `mock` mode, runs are simulated without calling a real runtime. |

## OpenClaw Runtime

| Variable | Type | Default | Description |
|---|---|---|---|
| `OPENCLAW_PROFILE` | string | `apm` | OpenClaw profile name. |
| `OPENCLAW_BINARY_PATH` | string | `openclaw` | Path to the OpenClaw binary. If set to `openclaw`, the server searches `$PATH` and `~/.nvm/versions/` for the binary. |
| `OPENCLAW_CONFIG_PATH` | string | `<state-dir>/openclaw.json` | Path to the OpenClaw configuration file. |
| `OPENCLAW_STATE_DIR` | string | `~/.openclaw` | Path to the OpenClaw state directory. |
| `OPENCLAW_GATEWAY_URL` | string | (none) | URL of the OpenClaw gateway, if using gateway mode. |
| `OPENCLAW_GATEWAY_TOKEN` | string | (none) | Authentication token for the OpenClaw gateway. |

## Codex Runtime

| Variable | Type | Default | Description |
|---|---|---|---|
| `CODEX_BINARY_PATH` | string | `codex` | Path to the Codex binary. If set to `codex`, the server searches `$PATH` and `~/.nvm/versions/`. |
| `CODEX_CONFIG_PATH` | string | `<state-dir>/config.toml` | Path to the Codex configuration file (TOML format). |
| `CODEX_STATE_DIR` | string | `~/.codex` | Path to the Codex state directory. |
| `CODEX_DEFAULT_MODEL` | string | (auto-detected) | Default model ID for Codex. If not set, the server reads the `model` field from the Codex config file. |

## Claude Code Runtime

| Variable | Type | Default | Description |
|---|---|---|---|
| `CLAUDE_BINARY_PATH` | string | `claude` | Path to the Claude Code binary. Searches `$PATH`, `~/.local/bin/`, and `~/.nvm/versions/`. |
| `CLAUDE_CONFIG_PATH` | string | `<state-dir>/settings.json` | Path to the Claude Code configuration file (JSON format). |
| `CLAUDE_STATE_DIR` | string | `~/.claude` | Path to the Claude Code state directory. |
| `CLAUDE_DEFAULT_MODEL` | string | `claude-sonnet-4-6` | Default model ID for Claude Code. Auto-detected from config file if not set. The server normalizes legacy model IDs (e.g., `claude-sonnet-4-20250514` becomes `claude-sonnet-4-6`). |

## Testing

| Variable | Type | Default | Description |
|---|---|---|---|
| `NOVA_ENABLE_OPENCLAW_SMOKE` | boolean | `false` | Set to `1` or `true` to enable OpenClaw smoke tests in the integration test suite. |

## Frontend Variables

The frontend (`apps/web`) uses the following environment variables:

| Variable | Context | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_WEB_ORIGIN` | Build-time | `http://127.0.0.1:3000` | The origin URL of the web application. Used for CORS and cookie configuration. |
| `NEXT_PUBLIC_API_BASE_URL` | Build-time | `/api/backend` (client) | Base URL for API requests from the browser. Defaults to the proxy route. |
| `NOVA_BACKEND_URL` | Server-only | `http://127.0.0.1:4010/api` | Direct backend URL used by server components and the proxy route. |

## Binary Resolution

The server implements intelligent binary resolution for all runtimes:

1. If the configured path is just the binary name (e.g., `openclaw`, `codex`, `claude`), the server searches:
   - `$PATH` entries
   - `~/.nvm/versions/node/*/bin/` (sorted by version, newest first)
   - `~/.local/bin/` (Claude Code only)
2. If the configured path is an absolute path, it is used directly.

## Model ID Normalization

For Claude Code, the server normalizes dated model identifiers to their short forms:

| Input | Normalized |
|---|---|
| `claude-sonnet-4-20250514` | `claude-sonnet-4-6` |
| `claude-opus-4-20250514` | `claude-opus-4-6` |
| Other values | Passed through unchanged |
