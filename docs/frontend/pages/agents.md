# Page: Agents

## Agent List

**Route**: `/agents`
**File**: `apps/web/src/app/(dashboard)/agents/page.tsx`
**Component**: `AgentsPage` (async server component)

### Data Loading

Fetches all agents via `getAgents()` during SSR.

### Features

- **Pagination**: Client-side pagination via `?page` and `?pageSize` query parameters. Defaults to 12 per page.
- **Status summary**: Header area shows counts of working, idle, and error agents.
- **Status indicators**: Each agent shows a colored status dot:
  - `working` -- green with glow
  - `idle` -- blue with glow
  - `paused` -- dimmed outline
  - `error` -- red with glow
  - `offline` -- faint outline
- **Agent cards**: Display agent name, role, status label, runtime kind, and current task (if working).
- **Create action**: "New agent" button links to `/agents/new`.

## Create Agent

**Route**: `/agents/new`
**File**: `apps/web/src/app/(dashboard)/agents/new/page.tsx`
**Component**: `NewAgentPage` (client component)

Interactive form for registering a new agent. The form dynamically loads runtime catalogs to populate available options.

### Runtime Selection

The form presents three runtime options:

| Runtime | Label | Catalog Endpoint |
|---|---|---|
| `openclaw` | OpenClaw | `/runtimes/openclaw/catalog` |
| `codex` | Codex | `/runtimes/codex/catalog` |
| `claude` | Claude Code | `/runtimes/claude/catalog` |

Each runtime option loads its catalog (when available) to populate:
- **Existing agents** in that runtime (selectable for linking).
- **Available models** for the runtime.
- **Default paths** for Agent Home and runtime state directories.

### Form Fields

- **Name** (required)
- **Role** (required) -- e.g., "Senior Engineer", "Code Reviewer"
- **Avatar** (optional)
- **System instructions** -- Primary directive text
- **Persona, context, identity, tools, heartbeat, memory** -- Optional Agent Home document fields
- **Runtime configuration**:
  - Runtime kind
  - Runtime agent ID
  - Agent Home path (filesystem picker via `selectDirectory()`)
  - Runtime state path
  - Default model ID
  - Model override allowed (boolean)
  - Sandbox mode (`off`, `docker`, `other`)
  - Thinking level (`off`, `minimal`, `low`, `medium`, `high`, `xhigh`)

On submission, calls `createAgent()` and redirects to the agents list.

## Agent Detail

**Route**: `/agents/[id]`
**File**: `apps/web/src/app/(dashboard)/agents/[id]/page.tsx`

Displays full agent configuration, current status, assigned projects, and recent task history.

## Edit Agent

**Route**: `/agents/[id]/edit`
**File**: `apps/web/src/app/(dashboard)/agents/[id]/edit/page.tsx`

Pre-populated form for modifying agent properties and runtime configuration. Uses `patchAgent()` on submission.
