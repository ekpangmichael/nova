# Runtime Adapter System Overview

Nova abstracts AI runtime execution behind a common **RuntimeAdapter** interface. This allows the task execution engine to start runs, stream events, and manage agents without being coupled to any specific AI runtime.

## Architecture

The runtime adapter system has three layers:

```
+---------------------------------------------+
|            Nova Service Layer                |
|  (NovaService, route handlers, WebSocket)    |
+---------------------------------------------+
                     |
                     | uses RuntimeAdapter interface
                     v
+---------------------------------------------+
|            RuntimeManager                    |
|  Selects adapter by RuntimeKind              |
|  Manages process managers and adapter        |
|  lifecycle                                   |
+---------------------------------------------+
        |              |              |              |
        v              v              v              v
  +-----------+  +-----------+  +-----------+  +-----------+
  |   Mock    |  | OpenClaw  |  |   Codex   |  |  Claude   |
  |  Adapter  |  |  Native   |  |  Adapter  |  |  Code     |
  |           |  |  Adapter  |  |           |  |  Adapter  |
  +-----------+  +-----------+  +-----------+  +-----------+
                       |              |              |
                       v              v              v
                 +-----------+  +-----------+  +-----------+
                 | OpenClaw  |  |  Codex    |  | Claude    |
                 | Process   |  | Process   |  | Process   |
                 | Manager   |  | Manager   |  | Manager   |
                 +-----------+  +-----------+  +-----------+
                       |              |              |
                       v              v              v
                 +-----------+  +-----------+  +-----------+
                 |  OpenClaw |  | Codex CLI |  | Claude    |
                 |  Gateway  |  |  (exec)   |  | Code CLI  |
                 | (WebSocket|  |           |  |  (exec)   |
                 +-----------+  +-----------+  +-----------+
```

## Package Structure

The runtime adapter system spans two packages:

| Package | Path | Contents |
|---------|------|----------|
| `@nova/runtime-adapter` | `packages/runtime-adapter/` | Interface definitions, type exports |
| `@nova/server` | `apps/server/src/services/runtime/` | Concrete adapter implementations |

The interface package (`@nova/runtime-adapter`) defines the `RuntimeAdapter` interface and all associated types. It contains no implementation code. The concrete adapters live in the server package, where they have access to environment configuration and can spawn child processes.

## Available Runtimes

Nova ships with four runtime adapter implementations:

| Runtime | Kind | Adapter Class | Description |
|---------|------|---------------|-------------|
| Mock | `openclaw-native` (mock mode) | `MockRuntimeAdapter` | In-memory simulation for development |
| OpenClaw | `openclaw-native` | `OpenClawNativeAdapter` | WebSocket-based gateway communication |
| Codex | `codex` | `CodexRuntimeAdapter` | CLI subprocess with JSONL streaming |
| Claude Code | `claude-code` | `ClaudeRuntimeAdapter` | CLI subprocess with stream-json output |

## RuntimeManager

The `RuntimeManager` class in `apps/server/src/services/runtime/RuntimeManager.ts` is the central entry point. It:

1. Instantiates all process managers and adapters at construction time.
2. Selects the correct adapter based on `RuntimeKind` via `getAdapter(kind)`.
3. Falls back to the mock adapter for `openclaw-native` when `runtimeMode` is `"mock"`.
4. Provides aggregate methods like `listRuntimes()` to query all adapters at once.
5. Manages adapter lifecycle through `setup()`, `restart()`, `reconfigure()`, and `close()`.

```typescript
class RuntimeManager {
  getAdapter(kind: RuntimeKind): RuntimeAdapter;
  listRuntimes(): Promise<RuntimeSummary[]>;
  getOpenClawCatalog(): Promise<RuntimeCatalog>;
  getCodexCatalog(): Promise<RuntimeCatalog>;
  getClaudeCatalog(): Promise<RuntimeCatalog>;
  setup(): Promise<RuntimeHealth>;
  restart(): Promise<RuntimeHealth>;
  reconfigure(): Promise<void>;
  close(): Promise<void>;
}
```

## Event Model

All adapters emit events through the same `RuntimeEvent` type:

```typescript
interface RuntimeEvent {
  type: RuntimeEventType;
  at: string;           // ISO 8601 timestamp
  data: Record<string, JsonValue>;
}
```

The event types follow a common lifecycle:

1. `run.accepted` -- The runtime acknowledged the run request.
2. `run.started` -- Execution has begun.
3. `message.delta` -- Streaming text fragment from the agent.
4. `tool.started` -- The agent invoked a tool.
5. `tool.completed` -- A tool invocation finished.
6. `artifact.created` -- A file was created or modified.
7. `message.completed` -- A complete message from the agent.
8. `usage` -- Token usage metrics.
9. `warning` -- A non-fatal warning from the runtime.
10. `error` -- A runtime error occurred.
11. `run.completed` -- The run finished successfully.
12. `run.failed` -- The run failed with an error.
13. `run.aborted` -- The run was stopped by the operator.

## Source Files

| File | Description |
|------|-------------|
| `packages/runtime-adapter/src/index.ts` | `RuntimeAdapter` interface and all type definitions |
| `apps/server/src/services/runtime/RuntimeManager.ts` | Central adapter registry and lifecycle manager |
| `apps/server/src/services/runtime/MockRuntimeAdapter.ts` | Mock adapter for development |
| `apps/server/src/services/runtime/OpenClawNativeAdapter.ts` | OpenClaw native adapter |
| `apps/server/src/services/runtime/OpenClawProcessManager.ts` | OpenClaw CLI process manager |
| `apps/server/src/services/runtime/OpenClawGatewayClient.ts` | OpenClaw WebSocket gateway client |
| `apps/server/src/services/runtime/CodexRuntimeAdapter.ts` | Codex CLI adapter |
| `apps/server/src/services/runtime/CodexProcessManager.ts` | Codex CLI process manager |
| `apps/server/src/services/runtime/ClaudeRuntimeAdapter.ts` | Claude Code CLI adapter |
| `apps/server/src/services/runtime/ClaudeProcessManager.ts` | Claude Code CLI process manager |
