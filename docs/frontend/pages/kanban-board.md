# Page: Kanban Board

**Route**: `/projects/[id]/board`
**File**: `apps/web/src/app/(dashboard)/projects/[id]/board/page.tsx`

The Kanban board is the primary task management view. It shows all tasks for a project organized into status columns with full drag-and-drop support.

## Architecture

The board uses a three-layer component structure:

1. **Board page** (server component) -- Fetches project tasks via `getProjectTasks()`, transforms them into `BoardColumn[]` data, and passes it down.
2. **KanbanBoardShell** (client component) -- A thin wrapper that uses `next/dynamic` to lazily load the actual board with `ssr: false`. This prevents dnd-kit from running during SSR. Shows a pulsing skeleton during load.
3. **KanbanBoard** (client component) -- The interactive board with drag-and-drop powered by dnd-kit.

## Status Columns

The board displays up to 9 columns, one per task status:

| Column ID | Title | Accent Color |
|---|---|---|
| `backlog` | Backlog | `outline-variant` (neutral) |
| `todo` | To Do | `outline-variant` (neutral) |
| `in_progress` | In Progress | `tertiary` (green) |
| `in_review` | In Review | `secondary` (blue) |
| `done` | Done | `primary` (dimmed) |
| `failed` | Failed | `primary` (dimmed) |
| `blocked` | Blocked | `primary` (dimmed) |
| `paused` | Paused | `primary` (dimmed) |
| `canceled` | Canceled | `primary` (dimmed) |

Terminal columns (`done`, `failed`, `blocked`, `paused`, `canceled`) are rendered with reduced opacity that increases on hover.

## Drag-and-Drop

Powered by `@dnd-kit/core` and `@dnd-kit/sortable`:

- **Sensors**: Uses `PointerSensor` with an 8px activation distance to distinguish clicks from drags.
- **Collision detection**: `pointerWithin` strategy for accurate column detection.
- **Drag overlay**: A rotated (2 degrees), scaled-up ghost of the task card rendered via a React portal.

### Drag Flow

1. **`onDragStart`** -- Captures a snapshot of all columns for rollback. Identifies the source column and task.
2. **`onDragOver`** -- Moves the task between columns in local state as the user drags, providing real-time visual feedback.
3. **`onDragEnd`** -- If the task moved to a different column, calls `patchTask(taskId, { status: newColumnId })` to persist the change. On success, calls `router.refresh()` to reload server data. On failure, rolls back to the snapshot and shows an error message.

## Task Cards

Each task card (`TaskCard` component) displays:

- **Display ID** -- Task number formatted as `TASK-001`.
- **Title** -- Truncated task title.
- **Priority badge** -- Color-coded by priority level (critical, high, medium, low).
- **Assigned agent** -- Agent name if assigned.
- **Comment and attachment counts** -- Shown as small icons with counts.

Task cards link to the task detail page at `/projects/[id]/board/[taskId]`.

## Agent Bar

The `AgentBar` component appears above the board and shows all agents assigned to the project with their current status:

- **Working** -- Green pulsing dot, green name text.
- **Idle** -- Blue dot, dimmed blue name text.
- **Error** -- Red dot, red name text.

Each agent displays a brief activity description.

## Backlog Column Actions

The backlog column header includes a "+" button that links to `/tasks/new?projectId=<id>` for quick task creation.

## Error Handling

If a drag-and-drop status change fails (e.g., backend is unreachable), the board:
1. Rolls back the column state to the pre-drag snapshot.
2. Displays an error banner above the board with the error message.
