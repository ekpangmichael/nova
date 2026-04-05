# RuntimeAdapter Interface

The `RuntimeAdapter` interface is the core abstraction for all AI runtime integrations in Nova. It is defined in `packages/runtime-adapter/src/index.ts` and implemented by each concrete adapter in `apps/server/src/services/runtime/`.

## Interface Definition

```typescript
interface RuntimeAdapter {
  kind: RuntimeKind;

  // Discovery and health
  getCapabilities(): Promise<RuntimeCapabilities>;
  getHealth(): Promise<RuntimeHealth>;
  getSummary(): Promise<RuntimeSummary>;
  getCatalog(): Promise<RuntimeCatalog>;
  listRuntimeAgents(): Promise<RuntimeAgentCatalogItem[]>;

  // Setup and provisioning
  ensureRuntimeReady(): Promise<void>;
  provisionAgent(input: ProvisionRuntimeAgentInput): Promise<ProvisionRuntimeAgentResult>;
  deleteAgent(runtimeAgentId: string): Promise<void>;
  ensureAgentWorkspace(agentId: string, workspacePath: string, runtimeStatePath: string): Promise<void>;
  syncAgentWorkspace(input: SyncRuntimeWorkspaceInput): Promise<SyncRuntimeWorkspaceResult>;
  ensureProjectRoot(agentId: string, workspacePath: string, projectRoot: string, seed?: ProjectSeed | null): Promise<void>;

  // Run execution
  startRun(input: StartRunInput): Promise<StartRunResult>;
  stopRun(runtimeSessionKey: string): Promise<void>;
  sendRunInput(runtimeSessionKey: string, input: RuntimeRunInput): Promise<{ runtimeRunId: string | null; startedAt: string }>;
  loadSessionHistory(runtimeSessionKey: string, after?: number): Promise<RuntimeSessionHistoryMessage[]>;
  subscribeRun(runtimeSessionKey: string, onEvent: (event: RuntimeEvent) => Promise<void> | void): Promise<() => Promise<void>>;

}
```

## Property

### `kind`

```typescript
kind: RuntimeKind;
```

The runtime kind identifier. One of: `"openclaw-native"`, `"openclaw-acp"`, `"claude-code"`, `"codex"`, `"custom"`.

---

## Discovery and Health Methods

### `getCapabilities()`

```typescript
getCapabilities(): Promise<RuntimeCapabilities>;
```

Returns the feature flags for this runtime. See [capabilities.md](./capabilities.md) for details.

### `getHealth()`

```typescript
getHealth(): Promise<RuntimeHealth>;
```

Returns the current health status of the runtime. The `RuntimeHealth` type includes:

| Field | Type | Description |
|-------|------|-------------|
| `status` | `RuntimeHealthState` | `"missing_binary"`, `"starting"`, `"healthy"`, `"degraded"`, `"error"` |
| `mode` | `string` | `"mock"`, `"openclaw"`, `"codex"`, `"claude"` |
| `profile` | `string` | Runtime profile name |
| `gatewayUrl` | `string \| null` | WebSocket gateway URL (if applicable) |
| `binaryPath` | `string` | Path to the runtime binary |
| `binaryVersion` | `string \| null` | Detected binary version |
| `configPath` | `string \| null` | Path to configuration file |
| `stateDir` | `string \| null` | Path to state directory |
| `details` | `string[]` | Human-readable status messages |
| `updatedAt` | `string` | ISO 8601 timestamp of the health check |

### `getSummary()`

```typescript
getSummary(): Promise<RuntimeSummary>;
```

Returns a compact summary combining health and capabilities:

| Field | Type | Description |
|-------|------|-------------|
| `providerKey` | `string` | Provider identifier (e.g., `"openclaw"`, `"codex"`, `"claude"`) |
| `kind` | `RuntimeKind` | Runtime kind |
| `label` | `string` | Human-readable label (e.g., `"OpenClaw"`, `"Codex"`, `"Claude Code"`) |
| `available` | `boolean` | Whether the runtime is available for use |
| `health` | `RuntimeHealth` | Full health status |
| `capabilities` | `RuntimeCapabilities` | Feature flags |

### `getCatalog()`

```typescript
getCatalog(): Promise<RuntimeCatalog>;
```

Returns comprehensive runtime information including available models, existing agents, gateway status, and defaults. This is the most detailed discovery method. The `RuntimeCatalog` type extends `RuntimeSummary` with:

| Field | Type | Description |
|-------|------|-------------|
| `configPath` | `string \| null` | Configuration file path |
| `stateDir` | `string \| null` | State directory path |
| `gateway` | `object` | Gateway connectivity details (reachable, url, port, authMode) |
| `defaults` | `object` | Default agent ID, model ID, and path templates |
| `models` | `RuntimeModelCatalogItem[]` | Available models with availability and metadata |
| `existingAgents` | `RuntimeAgentCatalogItem[]` | Already-provisioned agents |

### `listRuntimeAgents()`

```typescript
listRuntimeAgents(): Promise<RuntimeAgentCatalogItem[]>;
```

Returns agents already provisioned within the runtime. Each item includes:

| Field | Type | Description |
|-------|------|-------------|
| `runtimeAgentId` | `string` | Agent identifier within the runtime |
| `workspacePath` | `string` | Filesystem path to the agent's workspace |
| `runtimeStatePath` | `string` | Path to runtime-specific state |
| `displayName` | `string \| null` | Human-readable name |
| `defaultModelId` | `string \| null` | Default model for this agent |
| `isDefault` | `boolean` | Whether this is the default agent |

---

## Setup and Provisioning Methods

### `ensureRuntimeReady()`

```typescript
ensureRuntimeReady(): Promise<void>;
```

Validates that the runtime is operational. Throws a `serviceUnavailable` error if the runtime binary is missing, not signed in, or otherwise unhealthy.

### `provisionAgent(input)`

```typescript
provisionAgent(input: ProvisionRuntimeAgentInput): Promise<ProvisionRuntimeAgentResult>;
```

Creates or registers an agent within the runtime. The input includes:

| Field | Type | Description |
|-------|------|-------------|
| `runtimeAgentId` | `string` | Unique agent identifier |
| `workspacePath` | `string` | Filesystem path for the agent's workspace |
| `runtimeStatePath` | `string` | Path for runtime-specific state |
| `defaultModelId` | `string \| null` | Optional default model |
| `modelOverrideAllowed` | `boolean` | Whether model can be changed per-run |
| `sandboxMode` | `SandboxMode` | Sandbox configuration |
| `defaultThinkingLevel` | `ThinkingLevel` | Default thinking level |

### `deleteAgent(runtimeAgentId)`

```typescript
deleteAgent(runtimeAgentId: string): Promise<void>;
```

Removes an agent from the runtime. For CLI-based runtimes (Codex, Claude), this is typically a no-op since agents are not registered with the runtime itself.

### `ensureAgentWorkspace(agentId, workspacePath, runtimeStatePath)`

```typescript
ensureAgentWorkspace(
  agentId: string,
  workspacePath: string,
  runtimeStatePath: string
): Promise<void>;
```

Creates the required directory structure for an agent's workspace. All adapters create:
- The workspace directory itself
- The runtime state directory
- A `.apm` subdirectory within the workspace

### `syncAgentWorkspace(input)`

```typescript
syncAgentWorkspace(input: SyncRuntimeWorkspaceInput): Promise<SyncRuntimeWorkspaceResult>;
```

Writes configuration files into the agent's workspace. The input includes the agent's workspace file list (relative paths and content strings). For the OpenClaw adapter, this also parses `IDENTITY.md` to extract and apply identity settings.

### `ensureProjectRoot(agentId, workspacePath, projectRoot, seed?)`

```typescript
ensureProjectRoot(
  agentId: string,
  workspacePath: string,
  projectRoot: string,
  seed?: ProjectSeed | null
): Promise<void>;
```

Creates the project directory within the agent's workspace. If a git seed is provided, ensures a `.git` directory exists (in the mock adapter, this is simulated).

---

## Run Execution Methods

### `startRun(input)`

```typescript
startRun(input: StartRunInput): Promise<StartRunResult>;
```

Starts a new execution run. This is the primary entry point for task execution.

**StartRunInput**:

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | `string` | Task identifier |
| `runId` | `string` | Run identifier |
| `previousRuntimeSessionKey` | `string \| null` | Session key to resume (if retrying) |
| `agentId` | `string` | Nova agent ID |
| `runtimeAgentId` | `string` | Runtime-specific agent ID |
| `agentHomePath` | `string` | Agent workspace path |
| `executionTarget` | `string` | Directory where execution takes place |
| `prompt` | `string` | The prompt/instructions for the agent |
| `attachments` | `RuntimeAttachment[]` | File attachments for the run |
| `modelOverride` | `string \| null` | Override the default model |
| `thinkingLevel` | `ThinkingLevel \| null` | Override thinking level |
| `sandboxMode` | `SandboxMode \| null` | Override sandbox mode |

**StartRunResult**:

| Field | Type | Description |
|-------|------|-------------|
| `runtimeSessionKey` | `string` | Key to identify this session for future operations |
| `runtimeRunId` | `string \| null` | Runtime-specific run identifier |
| `startedAt` | `string` | ISO 8601 start timestamp |

### `stopRun(runtimeSessionKey)`

```typescript
stopRun(runtimeSessionKey: string): Promise<void>;
```

Stops a running execution. The behavior varies by adapter:
- **Mock**: Clears pending timers and emits `run.aborted`.
- **OpenClaw**: Sends `chat.abort` via the gateway WebSocket.
- **Codex/Claude**: Sends `SIGINT` to the child process, with a `SIGKILL` fallback after 5 seconds.

### `sendRunInput(runtimeSessionKey, input)`

```typescript
sendRunInput(
  runtimeSessionKey: string,
  input: RuntimeRunInput
): Promise<{ runtimeRunId: string | null; startedAt: string }>;
```

Sends follow-up input to an active session (e.g., a user reply in a conversational flow). The `RuntimeRunInput` includes:

| Field | Type | Description |
|-------|------|-------------|
| `text` | `string` | The input text |
| `idempotencyKey` | `string` | Optional deduplication key |
| `thinkingLevel` | `ThinkingLevel \| null` | Optional thinking level override |

### `loadSessionHistory(runtimeSessionKey, after?)`

```typescript
loadSessionHistory(
  runtimeSessionKey: string,
  after?: number
): Promise<RuntimeSessionHistoryMessage[]>;
```

Loads the conversation history for a session. The optional `after` parameter filters messages to only those with a sequence number greater than the given value. Each message includes:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string \| null` | Message identifier |
| `seq` | `number \| null` | Sequence number |
| `role` | `"user" \| "assistant" \| "system"` | Message role |
| `text` | `string` | Message content |
| `timestamp` | `string \| null` | ISO 8601 timestamp |

### `subscribeRun(runtimeSessionKey, onEvent)`

```typescript
subscribeRun(
  runtimeSessionKey: string,
  onEvent: (event: RuntimeEvent) => Promise<void> | void
): Promise<() => Promise<void>>;
```

Subscribes to the event stream of a run. The callback receives `RuntimeEvent` objects. Returns an unsubscribe function. Late subscribers receive all buffered events that were emitted before subscription.

