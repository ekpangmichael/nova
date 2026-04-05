# RuntimeCapabilities

The `RuntimeCapabilities` type declares what features a runtime adapter supports. It is returned by `getCapabilities()` and included in both `RuntimeSummary` and `RuntimeCatalog` responses.

## Type Definition

```typescript
interface RuntimeCapabilities {
  kind: RuntimeKind;
  executionTargetMode: "inside-agent-home" | "runtime-cwd" | "external";
  supportsStreaming: boolean;
  supportsStop: boolean;
  supportsRetry: boolean;
  supportsPause: boolean;
  supportsResume: boolean;
  supportsUsageMetrics: boolean;
}
```

## Fields

### `kind`

The `RuntimeKind` identifier for this adapter. One of:

| Value | Runtime |
|-------|---------|
| `"openclaw-native"` | OpenClaw native runtime (also used by the mock adapter) |
| `"openclaw-acp"` | OpenClaw ACP (not yet implemented) |
| `"claude-code"` | Claude Code CLI |
| `"codex"` | Codex CLI |
| `"custom"` | Custom runtime (not yet implemented) |

### `executionTargetMode`

Describes how the runtime determines where code execution takes place:

| Value | Meaning |
|-------|---------|
| `"inside-agent-home"` | Execution happens within the agent's home directory. The runtime manages its own directory layout. |
| `"runtime-cwd"` | The execution target is passed as the working directory (`cwd`) when spawning the runtime process. Used by Codex and Claude Code. |
| `"external"` | The execution target is passed to the runtime via message parameters (e.g., OpenClaw gateway). The runtime navigates to the target itself. Used by OpenClaw and the mock adapter. |

### `supportsStreaming`

Whether the runtime can emit incremental events during execution (`message.delta`, `tool.started`, etc.). All current adapters support streaming.

### `supportsStop`

Whether an in-progress run can be stopped by the operator. All current adapters support stop:

- **Mock**: Clears scheduled timers.
- **OpenClaw**: Sends `chat.abort` over the gateway WebSocket.
- **Codex/Claude**: Sends `SIGINT` to the child process.

### `supportsRetry`

Whether a failed or completed run can be retried by resuming the same session. All current adapters support retry by passing the previous `runtimeSessionKey` to `startRun()`.

### `supportsPause`

Whether an in-progress run can be paused and later resumed. No current adapter supports pause.

### `supportsResume`

Whether a paused run can be resumed. No current adapter supports resume.

### `supportsUsageMetrics`

Whether the runtime reports token usage data. All current adapters support usage metrics and emit `usage` events containing token counts.

## Capability Matrix

| Capability | Mock | OpenClaw | Codex | Claude Code |
|------------|------|----------|-------|-------------|
| `kind` | `openclaw-native` | `openclaw-native` | `codex` | `claude-code` |
| `executionTargetMode` | `external` | `external` | `runtime-cwd` | `runtime-cwd` |
| `supportsStreaming` | Yes | Yes | Yes | Yes |
| `supportsStop` | Yes | Yes | Yes | Yes |
| `supportsRetry` | Yes | Yes | Yes | Yes |
| `supportsPause` | No | No | No | No |
| `supportsResume` | No | No | No | No |
| `supportsUsageMetrics` | Yes | Yes | Yes | Yes |

## Usage in the Application

Capabilities are used by the Nova service layer to determine which operations are available for a given agent. For example, the UI can check `supportsStop` before showing a stop button.

```typescript
const adapter = runtimeManager.getAdapter(agent.runtimeKind);
const capabilities = await adapter.getCapabilities();

if (capabilities.supportsStop) {
  // Show stop button in the UI
}
```
