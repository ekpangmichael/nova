# Design Philosophy

Nova is built around three core principles: local-first operation,
runtime-agnostic execution, and a clean separation between the control plane
and the execution plane.

## Local-First

Nova runs entirely on the developer's machine. There is no hosted service, no
cloud dependency, and no data leaves the local network unless a runtime itself
makes outbound API calls.

### SQLite as the Single Store

All persistent state -- projects, agents, tasks, runs, comments, attachments,
run events, and artifacts -- lives in a single SQLite database. The database is
accessed through `libsql` (via `@libsql/client`) and managed with Drizzle ORM.

This choice delivers several benefits:

- **Zero infrastructure.** No database server to install, configure, or
  maintain. The database file is created automatically on first boot.
- **Portable state.** The entire project state is a single file that can be
  backed up, copied, or moved.
- **Low latency.** All queries hit local disk with no network round-trip.
- **Deterministic testing.** Integration tests create ephemeral in-memory
  databases that are fully isolated.

The database path is configurable through the `NOVA_DB_PATH` environment
variable and defaults to a location inside the app data directory.

### Local File System as Execution Surface

Agents do their work in real directories on the host machine. Each agent has a
persistent Agent Home directory for configuration and state, and each task gets
its own Execution Target directory where the runtime performs file operations,
runs tools, and produces artifacts. This means developers can inspect, modify,
or debug agent output with their normal editor and terminal.

### Local Binary Discovery

Nova discovers runtime CLI tools (openclaw, claude, codex) by scanning the
system PATH and common installation directories like `~/.nvm/versions/node/`.
Settings are persisted in the database so that binary paths, config directories,
and state directories survive across restarts.

## Runtime-Agnostic

Nova does not embed or depend on any specific AI model or runtime. Instead, it
defines a `RuntimeAdapter` interface in the `@nova/runtime-adapter` package that
abstracts all runtime operations behind a uniform contract.

### The RuntimeAdapter Interface

Every runtime -- whether it is OpenClaw, Claude Code, Codex, or a future
addition -- implements the same interface:

```
RuntimeAdapter
  |
  +-- getCapabilities()       What this runtime can do
  +-- getHealth()             Current health status
  +-- getSummary()            Quick status for listing
  +-- getCatalog()            Full catalog (models, agents, gateway info)
  +-- provisionAgent()        Create a runtime-level agent identity
  +-- deleteAgent()           Remove a runtime-level agent identity
  +-- ensureAgentWorkspace()  Set up the agent's working directory
  +-- syncAgentWorkspace()    Push workspace files (instructions, etc.)
  +-- ensureProjectRoot()     Set up a project directory (optionally from git)
  +-- startRun()              Begin task execution
  +-- stopRun()               Abort a running task
  +-- sendRunInput()          Send follow-up input to a running session
  +-- subscribeRun()          Stream events from a running task
  +-- loadSessionHistory()    Retrieve conversation history
```

### Runtime Capabilities

Each adapter declares its capabilities through a `RuntimeCapabilities` object,
which tells the control plane what features are available:

- `executionTargetMode` -- Whether the runtime works inside the Agent Home, uses
  its own current working directory, or targets an external path.
- `supportsStreaming` -- Whether run events can be streamed in real time.
- `supportsStop` -- Whether a running task can be aborted.
- `supportsRetry` / `supportsPause` / `supportsResume` -- Lifecycle features.
- `supportsUsageMetrics` -- Whether token/cost usage is reported.

This capability model allows the dashboard to dynamically enable or disable UI
controls based on what the selected runtime actually supports.

### Adding a New Runtime

To add a new runtime:

1. Create a class that implements the `RuntimeAdapter` interface.
2. Create a process manager that handles binary discovery and process lifecycle.
3. Register the adapter in `RuntimeManager` with a new `RuntimeKind` value.
4. Add the kind to the `RUNTIME_KINDS` enum in `@nova/shared`.

The control plane code does not need to change. It interacts with all runtimes
uniformly through the adapter interface.

## Control Plane vs. Execution Plane

The system is divided into two planes with a clean boundary between them.

```
+-----------------------------+     +-----------------------------+
|       CONTROL PLANE         |     |      EXECUTION PLANE        |
|                             |     |                             |
| - Web dashboard (Next.js)   |     | - OpenClaw CLI process      |
| - API server (Fastify)      |     | - Claude Code CLI process   |
| - SQLite database           |     | - Codex CLI process         |
| - WebSocket hub             |     | - Agent Home directories    |
| - Auth service              |     | - Execution Target dirs     |
|                             |     | - Git working trees         |
+-------------+---------------+     +-------------+---------------+
              |                                   ^
              |      RuntimeAdapter interface      |
              +-----------------------------------+
```

### Why This Separation Matters

**Substitutability.** The control plane does not know or care which AI model
powers a given agent. Swapping runtimes requires only changing the agent's
`runtimeKind` field.

**Testability.** The mock runtime adapter allows full end-to-end testing of the
control plane without any real AI processes. Integration tests run fast and
deterministically.

**Isolation.** A misbehaving runtime process cannot corrupt the control plane's
state. The adapter boundary ensures that failures in the execution plane are
caught and surfaced as structured errors.

**Observability.** All run events flow through the adapter's `subscribeRun`
callback, where they are persisted as `runEvents` in the database and broadcast
over WebSocket. The control plane maintains a complete audit trail regardless of
which runtime produced the events.

### Process Management

Each runtime has a dedicated process manager class that handles:

- Binary discovery and version detection
- Process spawning and lifecycle management
- Gateway readiness checks
- Health monitoring
- Login/authentication state (for runtimes that require it)

The `RuntimeManager` owns all adapter and process manager instances and provides
a unified API for the rest of the server to access any runtime by kind.
