# Adding a New Runtime Adapter

This guide walks through the steps required to implement a new runtime adapter for Nova. A runtime adapter translates between Nova's task execution model and a specific AI runtime (CLI tool, API, or gateway).

## Prerequisites

Before starting, you will need:

- The runtime's CLI binary or API endpoint.
- An understanding of how the runtime starts sessions, streams output, and terminates.
- Familiarity with the `RuntimeAdapter` interface defined in `packages/runtime-adapter/src/index.ts`.

## Step 1: Register the Runtime Kind

Add the new runtime kind to the `RUNTIME_KINDS` constant in `packages/shared/src/index.ts`:

```typescript
export const RUNTIME_KINDS = [
  "openclaw-native",
  "openclaw-acp",
  "claude-code",
  "codex",
  "custom",
  "your-runtime",  // <-- add here
] as const;
```

This automatically makes it available in the `RuntimeKind` type used throughout the codebase.

## Step 2: Add Environment Configuration

Add any required configuration to `apps/server/src/env.ts`. Follow the pattern of existing runtimes:

```typescript
// In the AppEnv type
yourRuntimeBinaryPath: string;
yourRuntimeConfigPath: string;
yourRuntimeStateDir: string;
yourRuntimeDefaultModel: string | null;
```

If the settings need to be persisted in the database, add columns to the `settings` table via a new migration. See `packages/db/drizzle/0006_codex_runtime.sql` for an example.

## Step 3: Create a Process Manager (Optional)

If your runtime is CLI-based, create a process manager class that handles:

- Binary detection and version checking
- Health status reporting
- Configuration file reading
- Login/authentication status

Create the file at `apps/server/src/services/runtime/YourProcessManager.ts`. Follow the pattern in `CodexProcessManager.ts` or `ClaudeProcessManager.ts`:

```typescript
export class YourProcessManager {
  static #HEALTH_CACHE_TTL_MS = 10_000;

  #env: AppEnv;
  #lastHealth: RuntimeHealth | null = null;
  #lastHealthAt = 0;

  constructor(env: AppEnv) {
    this.#env = env;
  }

  async getBinaryVersion(): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync(
        this.#env.yourRuntimeBinaryPath,
        ["--version"]
      );
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  async getHealth(): Promise<RuntimeHealth> {
    // Check binary, login status, return health object
    // Cache for HEALTH_CACHE_TTL_MS
  }
}
```

## Step 4: Implement the RuntimeAdapter

Create your adapter at `apps/server/src/services/runtime/YourRuntimeAdapter.ts`. The class must implement every method of the `RuntimeAdapter` interface.

### Minimal Skeleton

```typescript
import type {
  RuntimeAdapter,
  RuntimeCapabilities,
  RuntimeCatalog,
  RuntimeEvent,
  RuntimeSummary,
  StartRunInput,
  StartRunResult,
  // ... other types
} from "@nova/runtime-adapter";

export class YourRuntimeAdapter implements RuntimeAdapter {
  kind = "your-runtime" as const;

  async getCapabilities(): Promise<RuntimeCapabilities> {
    return {
      kind: this.kind,
      executionTargetMode: "runtime-cwd", // or "external"
      supportsStreaming: true,
      supportsStop: true,
      supportsRetry: true,
      supportsPause: false,
      supportsResume: false,
      supportsUsageMetrics: true,
    };
  }

  async getHealth() { /* ... */ }
  async getSummary() { /* ... */ }
  async getCatalog() { /* ... */ }
  async listRuntimeAgents() { /* ... */ }
  async ensureRuntimeReady() { /* ... */ }
  async provisionAgent(input) { /* ... */ }
  async deleteAgent(runtimeAgentId) { /* ... */ }
  async ensureAgentWorkspace(agentId, workspacePath, runtimeStatePath) { /* ... */ }
  async syncAgentWorkspace(input) { /* ... */ }
  async ensureProjectRoot(agentId, workspacePath, projectRoot, seed?) { /* ... */ }
  async startRun(input) { /* ... */ }
  async stopRun(runtimeSessionKey) { /* ... */ }
  async sendRunInput(runtimeSessionKey, input) { /* ... */ }
  async loadSessionHistory(runtimeSessionKey, after?) { /* ... */ }
  async subscribeRun(runtimeSessionKey, onEvent) { /* ... */ }

}
```

### Key Implementation Decisions

#### Execution Target Mode

Choose how your runtime handles execution targets:

- `"runtime-cwd"` -- Pass the target as `cwd` when spawning a process (used by Codex and Claude Code).
- `"external"` -- Pass the target as a parameter in the run request (used by OpenClaw).
- `"inside-agent-home"` -- The runtime manages its own directory layout.

#### Event Mapping

Map your runtime's output to Nova's `RuntimeEventType`:

```typescript
type RuntimeEventType =
  | "run.accepted"       // Run acknowledged
  | "run.started"        // Execution began
  | "message.delta"      // Streaming text fragment
  | "message.completed"  // Complete message
  | "tool.started"       // Tool invocation began
  | "tool.completed"     // Tool invocation finished
  | "artifact.created"   // File created/modified
  | "usage"              // Token usage metrics
  | "warning"            // Non-fatal warning
  | "error"              // Runtime error
  | "run.completed"      // Run finished successfully
  | "run.failed"         // Run failed
  | "run.aborted";       // Run stopped by operator
```

Every run should emit at minimum: `run.accepted`, `run.started`, and one of `run.completed`/`run.failed`/`run.aborted`.

#### Session State

Maintain a `Map<string, SessionState>` of active sessions. Each session should track:

- Runtime session/thread ID
- Working directory
- Buffered events (for late subscribers)
- Active listener callbacks
- Child process reference (for CLI-based runtimes)
- Conversation history

#### Event Buffering and Subscription

The `subscribeRun()` method must:

1. Add the callback to the session's listener set.
2. Replay all previously buffered events to the new subscriber.
3. Return an unsubscribe function that removes the callback.

```typescript
async subscribeRun(runtimeSessionKey, onEvent) {
  const state = this.#sessions.get(runtimeSessionKey);
  if (!state) return async () => {};

  state.listeners.add(onEvent);
  for (const event of state.bufferedEvents) {
    await onEvent(event);
  }

  return async () => {
    state.listeners.delete(onEvent);
  };
}
```

## Step 5: Register in RuntimeManager

Add your adapter to `apps/server/src/services/runtime/RuntimeManager.ts`:

1. Import your process manager and adapter classes.
2. Instantiate them in the constructor.
3. Add a case to `getAdapter()`:

```typescript
getAdapter(kind: RuntimeKind = "openclaw-native"): RuntimeAdapter {
  if (kind === "your-runtime") {
    return this.#yourAdapter;
  }
  // ... existing cases
}
```

4. Add to `listRuntimes()` if you want it visible in the runtime listing.
5. Add to `reconfigure()` so the adapter is recreated when settings change.

## Step 6: Add Settings UI Support (Optional)

If your runtime needs user-configurable settings:

1. Add a database migration for the new settings columns.
2. Update the settings API route in `apps/server/src/routes/`.
3. Update the settings page in `apps/web/src/app/(dashboard)/settings/`.

## Step 7: Test

Implement at minimum:

- A health check test that verifies the binary detection flow.
- A run lifecycle test that starts a run, subscribes to events, and verifies the expected event sequence.
- A stop test that verifies the run can be aborted cleanly.

Run the test suite to verify nothing is broken:

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Reference: Existing Adapters

Study these existing implementations for patterns:

| Adapter | Best For Learning |
|---------|------------------|
| `MockRuntimeAdapter` | Simplest implementation, good starting point for understanding the interface |
| `CodexRuntimeAdapter` | CLI-based adapter with JSONL stdout parsing |
| `ClaudeRuntimeAdapter` | CLI-based adapter with stream-json parsing, tool tracking |
| `OpenClawNativeAdapter` | WebSocket-based adapter with gateway protocol |
