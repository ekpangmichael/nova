# OpenClaw Native Adapter

The `OpenClawNativeAdapter` integrates Nova with the OpenClaw runtime through a WebSocket gateway connection and CLI-based process management.

## Source Files

| File | Class | Purpose |
|------|-------|---------|
| `apps/server/src/services/runtime/OpenClawNativeAdapter.ts` | `OpenClawNativeAdapter` | RuntimeAdapter implementation |
| `apps/server/src/services/runtime/OpenClawProcessManager.ts` | `OpenClawProcessManager` | CLI command execution and health checks |
| `apps/server/src/services/runtime/OpenClawGatewayClient.ts` | `OpenClawGatewayClient` | WebSocket client for the OpenClaw gateway |

## Architecture

The OpenClaw adapter has a two-layer architecture:

```
OpenClawNativeAdapter
    |
    +-- OpenClawProcessManager  (CLI operations: health, agents, models)
    |
    +-- OpenClawGatewayClient   (WebSocket: runs, events, chat)
```

**Process Manager** handles all CLI interactions -- checking binary version, listing agents and models, provisioning agents, setting identity, and querying gateway status. It shells out to the `openclaw` binary.

**Gateway Client** maintains a persistent WebSocket connection to the OpenClaw gateway for real-time operations -- starting runs, streaming events, and aborting sessions.

## Capabilities

```typescript
{
  kind: "openclaw-native",
  executionTargetMode: "external",
  supportsStreaming: true,
  supportsStop: true,
  supportsRetry: true,
  supportsPause: false,
  supportsResume: false,
  supportsUsageMetrics: true,
}
```

## OpenClawProcessManager

The process manager wraps the `openclaw` CLI binary and provides structured access to its commands.

### CLI Commands Used

| Method | CLI Command | Purpose |
|--------|-------------|---------|
| `getBinaryVersion()` | `openclaw --version` | Detect if the binary is installed |
| `getGatewayStatus()` | `openclaw gateway status --json` | Check gateway health, port, and RPC status |
| `listAgents()` | `openclaw agents list --json` | List provisioned agents |
| `listModels()` | `openclaw models list --json` | List available models |
| `provisionAgent()` | `openclaw agents add <id> --workspace <path> --agent-dir <path> --json` | Create a new agent |
| `deleteAgent()` | `openclaw agents delete <id> --force --json` | Remove an agent |
| `setIdentity()` | `openclaw agents set-identity --agent <id> [--name, --theme, --emoji, --avatar]` | Update agent identity |
| `setIdentityFromWorkspace()` | `openclaw agents set-identity --agent <id> --from-identity` | Apply identity from workspace file |

### Health Checks

Health is cached for 10 seconds (`#HEALTH_CACHE_TTL_MS`). The health check flow:

1. If `runtimeMode` is `"mock"`, return healthy immediately.
2. Try to get the binary version. If it fails, return `"missing_binary"`.
3. Query gateway status via `openclaw gateway status --json`.
4. Return `"healthy"` if gateway is reachable and RPC is OK; otherwise `"degraded"`.

### Environment Configuration

The process manager reads the following from `AppEnv`:

| Variable | Purpose |
|----------|---------|
| `openclawBinaryPath` | Path to the `openclaw` binary |
| `openclawConfigPath` | Path to `openclaw.json` config |
| `openclawStateDir` | OpenClaw state directory |
| `openclawProfile` | CLI profile name |

CLI commands run with `OPENCLAW_CONFIG_PATH` and `OPENCLAW_STATE_DIR` environment variables set.

## OpenClawGatewayClient

The gateway client manages a WebSocket connection to the OpenClaw gateway using the protocol version 3 handshake.

### Connection Flow

1. Resolve the gateway URL from environment, gateway status, or fallback to `ws://127.0.0.1:18789`.
2. Open a WebSocket connection.
3. Wait for a `connect.challenge` event containing a nonce.
4. Build and sign a device authentication payload using the local device identity (ed25519 key pair stored in the app data directory).
5. Send a `connect` request with the signed payload, client metadata, and operator scope.
6. Receive the connect response. On success, the connection is established.

The connection challenge must complete within 10 seconds or it times out.

### Message Protocol

The gateway uses three frame types:

| Frame Type | Direction | Purpose |
|------------|-----------|---------|
| `req` | Client -> Gateway | Request with method and params |
| `res` | Gateway -> Client | Response to a request |
| `event` | Gateway -> Client | Streamed events (chat, agent) |

### Gateway Methods Used

| Method | Purpose |
|--------|---------|
| `chat.send` | Start a new run or send follow-up input |
| `chat.abort` | Stop an active run |
| `chat.history` | Load session conversation history |

### Event Handling

The gateway emits two event types that the adapter processes:

**`chat` events** carry message state changes:
- `state: "delta"` -- Streaming text fragment, mapped to `message.delta`
- `state: "final"` -- Complete message, mapped to `message.completed` and potentially `run.completed`
- `state: "error"` -- Error condition, mapped to `error` and `run.failed`
- `state: "aborted"` -- Abort signal, mapped to `run.aborted`

**`agent` events** carry structured agent lifecycle data:
- `stream: "lifecycle"` with `phase: "start"` -- Mapped to `run.started`
- `stream: "lifecycle"` with `phase: "end"` -- Mapped to `run.completed`
- `stream: "lifecycle"` with `phase: "error"` -- Mapped to `run.failed`
- `stream: "tool"` with `phase: "start"/"end"` -- Mapped to `tool.started`/`tool.completed`
- `stream: "usage"` -- Mapped to `usage`
- `stream: "warning"` -- Mapped to `warning`

## Session Key Format

Session keys for the OpenClaw adapter follow the pattern:

```
agent:<runtimeAgentId>:nova:task:<taskId>
```

## Run Lifecycle

1. `startRun()` validates runtime health, creates or retrieves session state, then sends a `chat.send` request to the gateway with `deliver: false` and a 1-hour timeout.
2. Gateway events stream in through the WebSocket and are translated to `RuntimeEvent` objects.
3. Events are buffered and forwarded to any active listeners.
4. Terminal events (`run.completed`, `run.failed`, `run.aborted`) are deduplicated using a `terminalRunIds` set to prevent duplicate completion signals.

## Workspace Sync and Identity

When `syncAgentWorkspace()` writes files, it checks for an `IDENTITY.md` file. If found, it parses identity fields (name, theme, emoji, avatar) and calls `setIdentity()` on the process manager to update the agent's display identity in the OpenClaw runtime.
