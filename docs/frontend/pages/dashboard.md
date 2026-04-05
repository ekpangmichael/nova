# Page: Dashboard

**Route**: `/`
**File**: `apps/web/src/app/(dashboard)/page.tsx`
**Component**: `DashboardPage` (async server component)

The Dashboard is the landing page after sign-in. It provides a real-time overview of the entire Nova system.

## Data Loading

The page fetches four data sets in parallel during SSR:

```typescript
const [stats, workingRuns, activity, attention] = await Promise.all([
  getDashboardStats(),
  getDashboardWorkingRuns(),
  getDashboardActivity(),
  getDashboardAttention(),
]);
```

All data is fetched server-side with the user's session cookie forwarded to the backend.

## Page Sections

### Header

Displays the page title ("Dashboard") and a "New task" action button that links to `/tasks/new`.

### Hero Stats

A four-column grid of stat cards:

| Stat | Description |
|---|---|
| Projects | Total project count, with active count as sub-label. |
| Agents | Active agent count, with total as sub-label. Uses tertiary (green) accent. |
| Open tasks | Count of tasks not yet completed. Uses secondary (blue) accent. |
| Done this week | Tasks completed in the current week. Uses tertiary accent. |

Each card uses the `ghost` utility for a subtle border and renders labels in monospace uppercase.

### Currently Working

Shows agents that are actively executing tasks. Each working agent is rendered as an `AgentCard` component in a two-column grid. The card displays the agent name, task label (project name + task number + title), run status, and a scrolling log feed.

When no agents are running, an empty state message is shown.

### Needs Attention

Conditionally rendered only when there are issues. Displays `NeedsAttentionCard` components for:

- **Failed runs** -- Runs that ended with an error.
- **Blocked tasks** -- Tasks stuck in a blocked state.
- **Agent errors** -- Agents in error state.

Each card shows severity (error/warning), a title, message, and a navigation link.

### Recent Activity

A chronological feed of system events. Each entry shows:

- Status icon (play, pause, error, schedule, or check icons from Material Symbols).
- Timestamp in `HH:MM:SS` 24-hour format.
- Status tag (Active, Idle, Error, Queued, or Update) with color-coded background.
- Actor label and message.

Entries with an `href` are rendered as links for navigation to the relevant task or project.

## Animations

Each section uses staggered entrance animations (`anim-1` through `anim-5`), which produce a fade-up effect with incrementally delayed start times (50ms to 360ms).
