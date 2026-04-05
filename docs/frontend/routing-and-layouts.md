# Routing and Layouts

Nova uses Next.js 16 App Router with **route groups** to separate authenticated and unauthenticated experiences.

## Route Groups

### `(auth)` -- Unauthenticated Pages

Contains the sign-in / sign-up page at `/signin`.

**Layout** (`app/(auth)/layout.tsx`):
- Calls `getServerAuthSession()` on the server.
- If a valid session exists, redirects to `/` immediately.
- Renders a centered card layout with a decorative background (gradient blurs, grid pattern, scan line).

**Pages**:

| Route | File | Description |
|---|---|---|
| `/signin` | `(auth)/signin/page.tsx` | Email/password sign-in and sign-up form (client component). |

### `(dashboard)` -- Authenticated Pages

All operational pages live inside this group. The layout enforces authentication.

**Layout** (`app/(dashboard)/layout.tsx`):
- Calls `getServerAuthSession()` on the server.
- If no session exists, redirects to `/signin`.
- Renders the application shell: fixed `Sidebar` (264px wide), `TopBar`, and `BrowserNotificationManager`.
- Content area sits to the right of the sidebar with `p-8` padding.

**Pages**:

| Route | File | Description |
|---|---|---|
| `/` | `page.tsx` | Dashboard home with stats, working agents, attention items, activity feed. |
| `/projects` | `projects/page.tsx` | Paginated project list with status indicators. |
| `/projects/new` | `projects/new/page.tsx` | Create project form. |
| `/projects/[id]` | `projects/[id]/page.tsx` | Project detail view. |
| `/projects/[id]/edit` | `projects/[id]/edit/page.tsx` | Edit project form. |
| `/projects/[id]/board` | `projects/[id]/board/page.tsx` | Kanban task board for a project. |
| `/projects/[id]/board/[taskId]` | `projects/[id]/board/[taskId]/page.tsx` | Task detail screen. |
| `/projects/[id]/board/[taskId]/edit` | `projects/[id]/board/[taskId]/edit/page.tsx` | Edit task form. |
| `/projects/[id]/board/[taskId]/log` | `projects/[id]/board/[taskId]/log/page.tsx` | Task execution log viewer. |
| `/tasks/new` | `tasks/new/page.tsx` | New task form (accepts optional `?projectId` query). |
| `/agents` | `agents/page.tsx` | Paginated agent list with status and runtime info. |
| `/agents/new` | `agents/new/page.tsx` | Create agent form (runtime selection, model picker). |
| `/agents/[id]` | `agents/[id]/page.tsx` | Agent detail view. |
| `/agents/[id]/edit` | `agents/[id]/edit/page.tsx` | Edit agent form. |
| `/runtimes` | `runtimes/page.tsx` | Runtime configuration (OpenClaw, Codex, Claude Code). |
| `/settings` | `settings/page.tsx` | App settings (theme toggle, browser notifications). |

## Auth Guard Flow

```
Browser request
  --> Next.js server component
    --> getServerAuthSession()
      --> Reads `nova_session` cookie
      --> Validates with backend
    --> No session? redirect("/signin")
    --> Session valid? Render page with session.user passed to Sidebar
```

The session user object contains `displayName` and `email`, which the Sidebar uses to render the user profile section.

## Root Layout

The root layout (`app/layout.tsx`) applies to all routes:

1. Loads Inter and JetBrains Mono via `next/font/google`.
2. Sets CSS variable classes (`--font-inter`, `--font-jetbrains-mono`) on `<html>`.
3. Defaults to `dark` class on `<html>`.
4. Loads Material Symbols Outlined variable font from Google Fonts.
5. Wraps all content in `ThemeProvider` for dark/light mode toggling.

## API Proxy Route

The catch-all route at `app/api/backend/[...path]/route.ts` proxies client-side API requests to the Fastify backend. See [API Client](./api-client.md) for details.
