# Runtime Adapter System Overview

This section documents Nova's runtime adapter internals.

If you are trying to install or configure a runtime on your machine, start here instead:

- [Runtime Setup](../getting-started/runtime-setup.md)

The adapter system exists so Nova can:

- configure runtimes from one UI
- start and stop task runs through a shared interface
- normalize runtime events into Nova execution logs
- swap execution backends without changing the task model

## Available runtimes in the codebase

| Runtime | Kind | Adapter Class | Notes |
| --- | --- | --- | --- |
| Mock | `openclaw-native` in mock mode | `MockRuntimeAdapter` | Development-only fallback |
| OpenClaw | `openclaw-native` | `OpenClawNativeAdapter` | CLI + gateway integration |
| Codex | `codex` | `CodexRuntimeAdapter` | Local Codex CLI subprocess |
| Claude Code | `claude-code` | `ClaudeRuntimeAdapter` | Local Claude Code CLI subprocess |

## Architecture

```
+---------------------------------------------+
|            Nova Service Layer                |
|  (NovaService, routes, WebSocket broadcast)  |
+---------------------------------------------+
                     |
                     | uses RuntimeAdapter
                     v
+---------------------------------------------+
|            RuntimeManager                    |
|  selects adapters and manages lifecycle      |
+---------------------------------------------+
        |              |              |              |
        v              v              v              v
  +-----------+  +-----------+  +-----------+  +-----------+
  |   Mock    |  | OpenClaw  |  |   Codex   |  |  Claude   |
  |  Adapter  |  |  Native   |  |  Adapter  |  |  Code     |
  +-----------+  +-----------+  +-----------+  +-----------+
```

## Why the adapter system matters

The adapters let Nova preserve one operator workflow while different runtimes have different execution mechanics:

- OpenClaw uses a gateway plus CLI process management
- Codex uses a CLI subprocess with JSONL streaming
- Claude Code uses a CLI subprocess with `stream-json` output

Nova normalizes all of those into the same run model:

- `run.accepted`
- `run.started`
- `message.delta`
- `message.completed`
- `tool.started`
- `tool.completed`
- `artifact.created`
- `usage`
- `warning`
- `error`
- `run.completed`
- `run.failed`
- `run.aborted`

## Source files

| File | Description |
| --- | --- |
| `packages/runtime-adapter/src/index.ts` | `RuntimeAdapter` interface and shared runtime types |
| `apps/server/src/services/runtime/RuntimeManager.ts` | Adapter registry and lifecycle manager |
| `apps/server/src/services/runtime/OpenClawNativeAdapter.ts` | OpenClaw runtime adapter |
| `apps/server/src/services/runtime/OpenClawProcessManager.ts` | OpenClaw CLI process manager |
| `apps/server/src/services/runtime/OpenClawGatewayClient.ts` | OpenClaw gateway client |
| `apps/server/src/services/runtime/CodexRuntimeAdapter.ts` | Codex runtime adapter |
| `apps/server/src/services/runtime/CodexProcessManager.ts` | Codex detection and health checks |
| `apps/server/src/services/runtime/ClaudeRuntimeAdapter.ts` | Claude Code runtime adapter |
| `apps/server/src/services/runtime/ClaudeProcessManager.ts` | Claude detection and health checks |

## Next pages

- [Adapter Interface](./adapter-interface.md)
- [Capabilities](./capabilities.md)
- [OpenClaw Adapter](./openclaw-adapter.md)
- [Codex Adapter](./codex-adapter.md)
- [Claude Code Adapter](./claude-adapter.md)
