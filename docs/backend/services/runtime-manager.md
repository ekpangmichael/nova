# RuntimeManager

`RuntimeManager` is the adapter routing layer for AI agent runtimes. It lives in `apps/server/src/services/runtime/RuntimeManager.ts` and is responsible for selecting the correct runtime adapter based on the `RuntimeKind` and providing unified access to runtime operations.

## Construction

```ts
new RuntimeManager(env: AppEnv)
```

On construction, the manager creates process managers and adapters for all supported runtimes:

- **OpenClaw** -- `OpenClawProcessManager` + `OpenClawNativeAdapter`
- **Codex** -- `CodexProcessManager` + `CodexRuntimeAdapter`
- **Claude Code** -- `ClaudeProcessManager` + `ClaudeRuntimeAdapter`
- **Mock** -- `MockRuntimeAdapter` (no process manager, used in development)

## Adapter Routing

### getAdapter(kind)

```ts
getAdapter(kind: RuntimeKind = "openclaw-native"): RuntimeAdapter
```

Returns the appropriate `RuntimeAdapter` for the given runtime kind:

| `kind`            | Adapter                          | Notes                                              |
| ----------------- | -------------------------------- | -------------------------------------------------- |
| `openclaw-native` | `OpenClawNativeAdapter` or `MockRuntimeAdapter` | Uses mock when `env.runtimeMode === "mock"` |
| `codex`           | `CodexRuntimeAdapter`            | Always uses the real adapter                       |
| `claude-code`     | `ClaudeRuntimeAdapter`           | Always uses the real adapter                       |

Throws `400 bad_request` for unrecognized runtime kinds.

The default kind is `openclaw-native`.

## Runtime Mode

The `runtimeMode` setting (from `NOVA_RUNTIME_MODE` env var) controls whether the OpenClaw adapter uses the real process manager or the mock:

- `mock` -- Returns `MockRuntimeAdapter` for OpenClaw calls. Useful during development when no OpenClaw binary is available.
- `openclaw` -- Returns the real `OpenClawNativeAdapter` backed by a running OpenClaw process.

Codex and Claude Code always use their real adapters regardless of runtime mode.

## RuntimeAdapter Interface

All adapters implement the `RuntimeAdapter` interface from `@nova/runtime-adapter`:

```ts
interface RuntimeAdapter {
  getSummary(): Promise<RuntimeSummary>;
  getCatalog(): Promise<RuntimeCatalog>;
  getHealth(): Promise<RuntimeHealth>;
  ensureProjectRoot(agentId, agentHomePath, projectRoot, seed): Promise<void>;
  startRun(config): Promise<{ sessionKey: string; subscribe: ... }>;
  stopRun(sessionKey): Promise<void>;
  close(): Promise<void>;
}
```

## Catalog and Health

The manager provides convenience methods for each runtime:

- `listRuntimes()` -- Returns summaries for all three runtimes (OpenClaw, Codex, Claude Code).
- `getOpenClawCatalog()` / `getCodexCatalog()` / `getClaudeCatalog()` -- Returns available models and capabilities.
- `getHealth()` / `getCodexHealth()` / `getClaudeHealth()` -- Returns health status for each runtime.
- `getCodexLogin()` / `getClaudeLogin()` -- Returns authentication/login summary for Codex and Claude Code.

## Lifecycle Management

### setup()

Runs the OpenClaw process manager setup (initial configuration, binary verification).

### restart()

Restarts the OpenClaw process manager.

### reconfigure()

Tears down and recreates all adapters and process managers with the current environment configuration. Called when runtime settings are updated through the settings UI.

### close()

Gracefully shuts down the OpenClaw adapter. Called during app shutdown.
