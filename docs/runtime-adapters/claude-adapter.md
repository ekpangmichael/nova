# Claude Code Runtime Adapter

The `ClaudeRuntimeAdapter` integrates Nova with the Claude Code CLI. It spawns Claude as a child process with `stream-json` output format, parses the structured JSON lines from stdout, and translates them into Nova's `RuntimeEvent` model.

## Source Files

| File | Class | Purpose |
|------|-------|---------|
| `apps/server/src/services/runtime/ClaudeRuntimeAdapter.ts` | `ClaudeRuntimeAdapter` | RuntimeAdapter implementation |
| `apps/server/src/services/runtime/ClaudeProcessManager.ts` | `ClaudeProcessManager` | CLI health checks and configuration detection |

## Capabilities

```typescript
{
  kind: "claude-code",
  executionTargetMode: "runtime-cwd",
  supportsStreaming: true,
  supportsStop: true,
  supportsRetry: true,
  supportsPause: false,
  supportsResume: false,
  supportsUsageMetrics: true,
}
```

Like Codex, `executionTargetMode` is `"runtime-cwd"` -- the execution target is passed as the working directory when spawning the process.

## ClaudeProcessManager

The process manager handles binary detection, health monitoring, and configuration reading.

### Health Checks

Health is cached for 10 seconds. The check flow:

1. Try to get the binary version via `claude --version`. If it fails, return `"missing_binary"`.
2. Check login status by running `claude auth status` (returns JSON).
3. Return `"healthy"` if logged in, `"degraded"` if logged out, `"error"` if unknown.

### Login Detection

Login status is detected by running `claude auth status`, which returns:

```json
{
  "loggedIn": true,
  "authMethod": "oauth",
  "email": "user@example.com",
  "subscriptionType": "pro"
}
```

### Configuration Detection

The process manager reads:

| Source | Purpose |
|--------|---------|
| `env.claudeBinaryPath` | Path to the `claude` binary |
| `env.claudeConfigPath` | Path to the Claude settings JSON file |
| `env.claudeStateDir` | Claude state directory |
| `env.claudeDefaultModel` | Fallback default model from environment |

The default model is read from the Claude settings JSON by checking `defaultModel`, `model`, `preferredModel`, or `primaryModel` fields, in that order. Model IDs are normalized through `normalizeClaudeModelId()`.

## Model Catalog

The adapter provides a hardcoded list of supported Claude models:

| Model ID | Display Name |
|----------|-------------|
| `claude-sonnet-4-6` | Claude Sonnet 4.6 |
| `claude-opus-4-6` | Claude Opus 4.6 |
| `claude-haiku-4-5-20251001` | Claude Haiku 4.5 |

## CLI Invocation

### Command Structure

Runs are started by spawning the Claude binary in print mode with stream-json output:

```
claude -p --output-format stream-json --verbose --include-partial-messages \
  --max-turns 20 --permission-mode <mode> --add-dir <agentHomePath> \
  [--resume <sessionId>] [--model <model>] [--effort <level>] \
  "<prompt>"
```

Note that unlike Codex, the prompt is passed as a CLI argument rather than through stdin. The process stdin is set to `"ignore"`.

### Arguments

| Argument | When Used | Purpose |
|----------|-----------|---------|
| `-p` | Always | Print mode (non-interactive) |
| `--output-format stream-json` | Always | Structured JSON output per line |
| `--verbose` | Always | Include detailed event information |
| `--include-partial-messages` | Always | Include partial streaming messages |
| `--max-turns 20` | Always | Limit agent turns to prevent runaway execution |
| `--permission-mode <mode>` | Always | `"acceptEdits"` (sandbox on) or `"bypassPermissions"` (sandbox off) |
| `--add-dir <path>` | Always | Add agent home directory to context |
| `--resume <sessionId>` | When continuing a session | Resume an existing session |
| `--model <model>` | When model override is set | Override the default model |
| `--effort <level>` | When thinking level is not `"off"` | Set reasoning effort level |

### Permission Modes

| Nova SandboxMode | Claude Permission Mode | Behavior |
|------------------|----------------------|----------|
| `"off"` | `bypassPermissions` | No approval needed for any tool |
| `"docker"` or `"other"` | `acceptEdits` | Auto-approve file edits, prompt for other tools |

## stream-json Output Format

Claude Code outputs structured JSON lines to stdout. Each line is a JSON object with a `type` field. The adapter recognizes six line types:

### `system` (Initialization)

Emitted once at the start. Contains `session_id`, `model`, and `permissionMode`. The `session_id` is used to bind the session state.

```json
{
  "type": "system",
  "subtype": "init",
  "session_id": "uuid-here",
  "model": "claude-sonnet-4-6"
}
```

### `stream_event` (Streaming Events)

Real-time streaming events from the Claude API. The adapter processes these subtypes:

| Event Type | Content | Mapped To |
|------------|---------|-----------|
| `message_start` | Message ID | Tracks active message |
| `content_block_start` (tool_use) | Tool name and ID | `tool.started` |
| `content_block_delta` (text_delta) | Streaming text | `message.delta` |
| `message_delta` | Usage data | `usage` |

### `assistant` (Complete Messages)

Contains the full assistant message with text blocks and tool use blocks.

- **Text blocks** are joined and emitted as `message.completed`.
- **Tool use blocks** that were not already seen via `stream_event` are emitted as `tool.started`.

### `user` (Tool Results)

Contains tool execution results. Each result includes:
- `tool_use_id` -- matches the pending tool
- `tool_use_result` -- may include `filePath`, `content`, `structuredPatch`

The adapter emits `tool.completed` for each result. If the result includes a `filePath`, an `artifact.created` event is also emitted.

### `rate_limit_event`

Rate limit notifications from the Claude API. These are currently ignored.

### `result` (Terminal)

The final line in the output. Contains:
- `subtype` -- `"success"`, `"error_max_turns"`, or `"error_during_execution"`
- `is_error` -- boolean
- `result` -- text result or error message
- `usage` -- cumulative token usage

Mapped to `run.completed` (on success) or `run.failed` (on error), with `usage` emitted separately.

## Session Management

Sessions are keyed by Claude session ID (a UUID obtained from the `system` init line).

Each session tracks:

| Field | Purpose |
|-------|---------|
| `runtimeSessionKey` | The session UUID |
| `cwd` | Working directory |
| `agentHomePath` | Agent home path (passed via `--add-dir`) |
| `currentProcess` | Reference to the spawned child process |
| `bufferedEvents` | Events for late subscribers |
| `listeners` | Active event callback set |
| `history` | Conversation messages |
| `pendingTools` | Map of tool use IDs to pending tool info |
| `permissionMode` | `"acceptEdits"` or `"bypassPermissions"` |

### Session Continuity

When resuming a session (`sendRunInput()`), the adapter spawns a new Claude process with `--resume <sessionId>`. This continues the existing conversation.

### Tool Tracking

The adapter tracks tools through their lifecycle:

1. When a `content_block_start` with `type: "tool_use"` arrives (or a tool_use block in an `assistant` message), the tool is added to `pendingTools`.
2. When a `user` line with a matching `tool_use_id` arrives, the tool is removed from `pendingTools` and a `tool.completed` event is emitted.

## Stop Behavior

Stopping a run sends `SIGINT` to the child process. If the process does not exit within 5 seconds (`STOP_KILL_TIMEOUT_MS`), `SIGKILL` is sent as a fallback.

## Process Exit Handling

When the Claude process closes:

- **`result` line seen**: Terminal event already emitted during parsing.
- **Exit code 0 without terminal event**: Emit `run.completed`.
- **Stop requested (SIGINT sent)**: Emit `run.aborted`.
- **Non-zero exit code**: Emit `run.failed` with stderr content.

## Agent Provisioning

Claude Code does not have a native agent registry. `provisionAgent()` creates the workspace directories. `deleteAgent()` is a no-op. `listRuntimeAgents()` always returns an empty array.

## Workspace File Sync

`syncAgentWorkspace()` writes workspace configuration files to disk. Unlike the OpenClaw adapter, there is no identity parsing -- files are written as-is.
