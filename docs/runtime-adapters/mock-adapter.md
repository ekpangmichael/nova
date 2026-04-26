# MockRuntimeAdapter

The `MockRuntimeAdapter` is an in-memory simulation of a runtime adapter used for development and testing. It produces a deterministic sequence of events on a timer without actually executing any AI model.

## Source File

`apps/server/src/services/runtime/MockRuntimeAdapter.ts`

## When It Is Used

The mock adapter is selected by the `RuntimeManager` when `env.runtimeMode` is set to `"mock"`. In that case, calling `getAdapter("openclaw-native")` returns the mock adapter instead of the real OpenClaw adapter.

```typescript
// RuntimeManager.getAdapter()
if (kind === "openclaw-native") {
  return this.#env.runtimeMode === "mock"
    ? this.#mockAdapter
    : this.#openClawAdapter;
}
```

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

## Simulated Event Sequence

When `startRun()` is called, the mock adapter schedules a sequence of events using `setTimeout()` with increasing delays:

| Delay (ms) | Event Type | Description |
|------------|------------|-------------|
| 0 | `run.accepted` | Run acknowledged |
| 25 | `run.started` | Execution started |
| 50 | `message.delta` | Streaming text fragment |
| 75 | `tool.started` | Tool invocation begins (`filesystem.inspect`) |
| 100 | `tool.completed` | Tool invocation finishes |
| 125 | `artifact.created` | File artifact recorded |
| 150 | `message.completed` | Full message from agent |
| 175 | `usage` | Token usage report (128 prompt + 256 completion = 384 total) |
| 200 | `run.completed` | Run finished successfully |

The entire sequence completes in 200ms, making it fast enough for UI development without waiting for real model execution.

## Session Management

The adapter maintains an in-memory `Map` of sessions keyed by `runtimeSessionKey`. Each session tracks:

- The original `StartRunInput`
- Buffered events (for late subscribers)
- Active listeners
- Pending timer handles
- A closed flag
- Conversation history

Session keys follow the format `apm:task:<runId>`.

## Agent Provisioning

Agent provisioning is simulated in memory. The adapter maintains a `Map` of runtime agents. `provisionAgent()` stores the agent configuration and creates the workspace directories on disk. `deleteAgent()` simply removes the entry from the map.

## Follow-up Input

`sendRunInput()` simulates a conversational reply. It schedules a `message.delta` at 25ms and a `message.completed` at 75ms, then appends both the user and assistant messages to the session history.

## Stopping a Run

`stopRun()` clears all pending timers for the session, sets the `closed` flag, and emits a `run.aborted` event.

## Health Reporting

The mock adapter always reports healthy status:

```typescript
{
  status: "healthy",
  mode: "mock",
  profile: "apm",
  gatewayUrl: null,
  binaryPath: "mock",
  binaryVersion: null,
  configPath: "/tmp/mock-openclaw/openclaw.json",
  stateDir: "/tmp/mock-openclaw",
  details: ["Mock runtime adapter is active."],
}
```

## Model Catalog

The mock adapter reports a single model in its catalog:

| ID | Name | Context Window | Input |
|----|------|---------------|-------|
| `openai-codex/gpt-5.5` | GPT-5.5 | 1,000,000 | text+image |
