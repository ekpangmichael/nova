# Frontend Overview

The Nova frontend lives in `apps/web` and is built with **Next.js 16** using the App Router. It serves as the control surface for managing projects, agents, tasks, and runtime execution.

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 with `@theme` design tokens |
| Icons | Material Symbols Outlined (variable font) |
| Fonts | Inter (UI text), JetBrains Mono (code / labels) |
| Drag-and-drop | dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`) |
| Real-time | Native WebSocket client connecting to the Fastify `/ws` endpoint |
| Auth | Cookie-based sessions (`nova_session`) with email/password sign-in |

## Architecture Principles

**Server components by default.** Pages such as the Dashboard, Projects list, Agents list, and Kanban board are async server components. They call `lib/api.ts` helper functions directly during SSR, forwarding the session cookie to the Fastify backend.

**Client components where necessary.** Interactive elements (sign-in form, Kanban drag-and-drop, real-time WebSocket listeners, theme toggle, sidebar navigation) are explicitly marked `"use client"`.

**No client-side state library.** The frontend relies on Next.js server component data loading, local `useState` for interactive UI, and `router.refresh()` to re-fetch server data after mutations.

## Folder Structure

```
apps/web/src/
  app/
    layout.tsx              Root layout (fonts, ThemeProvider)
    globals.css             Design tokens, utilities, keyframes
    (auth)/
      layout.tsx            Auth layout (redirect if logged in)
      signin/page.tsx       Sign-in / sign-up form
    (dashboard)/
      layout.tsx            Dashboard shell (auth guard, Sidebar, TopBar)
      page.tsx              Dashboard home
      projects/             Project list, detail, edit, new
      agents/               Agent list, detail, edit, new
      settings/page.tsx     Settings (theme, notifications)
      runtimes/page.tsx     Runtime configuration
      tasks/new/page.tsx    New task form
    api/
      backend/[...path]/    Proxy route to Fastify backend
  components/
    board/                  Kanban board components
    dashboard/              Dashboard-specific cards
    layout/                 Sidebar, TopBar, BrowserNotificationManager
    task-detail/            Task detail screen, comments, metadata
    theme-provider.tsx      Dark/light theme context
    ui/                     Shared UI primitives (Icon, etc.)
    pagination.tsx          Reusable pagination component
  lib/
    api.ts                  API client (requestJson, all endpoint wrappers)
    auth.ts                 Server-side auth helpers
    auth-client.ts          Client-side auth helpers
    browser-notifications.ts  Browser Notification API wrapper
    board-project-preference.ts  LocalStorage helper for board project
  types/
    index.ts                Frontend-only view model types
```

## Dark / Light Theme

The app defaults to dark mode (`html.dark`). A `ThemeProvider` client component toggles between `dark` and `light` classes on the `<html>` element. All color tokens are defined as CSS custom properties in `globals.css` and overridden under `html.light`. See [Styling](./styling.md) for the full token reference.

## Related Documentation

- [Routing and Layouts](./routing-and-layouts.md)
- [API Client](./api-client.md)
- [Styling](./styling.md)
- [Real-time Updates](./real-time-updates.md)
- [Page: Dashboard](./pages/dashboard.md)
- [Page: Projects](./pages/projects.md)
- [Page: Kanban Board](./pages/kanban-board.md)
- [Page: Agents](./pages/agents.md)
