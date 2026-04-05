# Codex Runtime Adapter

The `CodexRuntimeAdapter` integrates Nova with the Codex CLI. It spawns Codex as a child process, feeds prompts via stdin, and reads structured JSONL events from stdout.

## Source Files

| File | Class | Purpose |
|------|-------|---------|
| `apps/server/src/services/runtime/CodexRuntimeAdapter.ts` | `CodexRuntimeAdapter` | RuntimeAdapter implementation |
| `apps/server/src/services/runtime/CodexProcessManager.ts` | `CodexProcessManager` | CLI health checks and configuration detection |

## Capabilities

```typescript
{
  kind: "codex",
  executionTargetMode: "runtime-cwd",
  supportsStreaming: true,
  supportsStop: true,
  supportsRetry: true,
  supportsPause: false,
  supportsResume: false,
  supportsUsageMetrics: true,
}
```

Key difference from OpenClaw: `executionTargetMode` is `"runtime-cwd"`, meaning the execution target is passed as the working directory when spawning the Codex process rather than as a message parameter.

## CodexProcessManager

The process manager handles binary detection, health monitoring, and configuration reading.

### Health Checks

Health is cached for 10 seconds. The check flow:

1. Try to get the binary version via `codex --version`. If it fails, return `"missing_binary"`.
2. Check login status by reading `auth.json` from the Codex state directory, or by running `codex login status`.
3. Return `"healthy"` if logged in, `"degraded"` if logged out, `"error"` if unknown.

### Configuration Detection

The process manager reads configuration from:

| Source | Purpose |
|--------|---------|
| `env.codexBinaryPath` | Path to the `codex` binary |
| `env.codexConfigPath` | Path to the Codex config file (TOML format) |
| `env.codexStateDir` | Codex state directory |
| `env.codexDefaultModel` | Fallback default model from environment |

The default model is read from the Codex config file by parsing `model = "<value>"` from the TOML content.

### Login Detection

Login status is detected by reading the `auth.json` file from the state directory:

```json
{
  "auth_mode": "chatgpt",
  "tokens": { ... },
  "last_refresh": "2025-03-29T..."
}
```

If `tokens` exists and `auth_mode` is set, the user is considered logged in.

## Supported Models

The adapter provides a hardcoded list of supported Codex models:

| Model ID | Display Name |
|----------|-------------|
| `gpt-5.4` | GPT-5.4 |
| `gpt-5.4-mini` | GPT-5.4-Mini |
| `gpt-5.3-codex` | GPT-5.3-Codex |
| `gpt-5.2-codex` | GPT-5.2-Codex |
| `gpt-5.2` | GPT-5.2 |
| `gpt-5.1-codex` | GPT-5.1-Codex |
| `gpt-5.1-codex-max` | GPT-5.1-Codex-Max |
| `gpt-5.1-codex-mini` | GPT-5.1-Codex-Mini |

## CLI Invocation

### Command Structure

Runs are started by spawning the Codex binary with `exec` subcommand:

```
codex exec [resume <threadId>] --json --skip-git-repo-check [--cd <cwd>] \
  [--model <model>] [--config model_reasoning_effort="<level>"] \
  [--sandbox workspace-write | --dangerously-bypass-approvals-and-sandbox] \
  -
```

The prompt is piped to stdin, and the `-` flag tells Codex to read from stdin.

### Arguments

| Argument | When Used | Purpose |
|----------|-----------|---------|
| `exec` | Always | Run command |
| `resume <threadId>` | When continuing a session | Resume an existing thread |
| `--json` | Always | Output JSONL to stdout |
| `--skip-git-repo-check` | Always | Skip git repository validation |
| `--cd <cwd>` | New sessions only | Set working directory |
| `--model <model>` | When model override is set | Override the default model |
| `--config model_reasoning_effort="<level>"` | When thinking level is not `"off"` | Set reasoning effort |
| `--sandbox workspace-write` | New sessions with sandbox enabled | Enable workspace sandbox |
| `--dangerously-bypass-approvals-and-sandbox` | New sessions with sandbox `"off"` | Disable all sandboxing |
| `-` | Always | Read prompt from stdin |

## JSONL Event Stream

Codex outputs structured JSONL (one JSON object per line) to stdout. The adapter parses each line and maps it to `RuntimeEvent` types:

### Event Type Mapping

| Codex JSONL Type | Item Type | RuntimeEvent Type |
|------------------|-----------|-------------------|
| `thread.started` | -- | Session ID extracted, `run.accepted` emitted |
| `turn.started` | -- | `run.started` |
| `item.started` | `file_change` | `tool.started` |
| `item.completed` | `file_change` | `tool.completed` + `artifact.created` for each changed file |
| `item.completed` | `agent_message` | `message.completed` |
| `turn.completed` | -- | `usage` (if present) + `run.completed` |

### Process Lifecycle

When the Codex process closes:

- **Exit code 0 without terminal event**: Emit `run.completed`
- **Stop requested (SIGINT sent)**: Emit `run.aborted`
- **Non-zero exit code**: Emit `run.failed` with stderr content

## Session Management

Sessions are keyed by Codex thread ID (a UUID). The thread ID is obtained from the `thread.started` event emitted at the beginning of each run.

Each session tracks:

- The working directory (`cwd`)
- The current child process reference
- Buffered events for late subscribers
- Active event listeners
- Conversation history
- stderr tail (last 12 lines)
- The last assistant message for use as the final summary

### Session Continuity

When resuming a session (`sendRunInput()`), the adapter spawns a new Codex process with `exec resume <threadId>`. This continues the existing conversation thread.

### Session File Recovery

The adapter can recover conversation history from Codex session files stored in `<stateDir>/sessions/`. It searches recursively for files containing the thread ID, then parses the JSONL entries for `user_message` and `agent_message` events.

## Stop Behavior

Stopping a run sends `SIGINT` to the child process. If the process does not exit within 5 seconds, `SIGKILL` is sent as a fallback.

## Agent Provisioning

Codex does not have a native agent registry. `provisionAgent()` creates the workspace directories. `deleteAgent()` is a no-op. `listRuntimeAgents()` always returns an empty array.
