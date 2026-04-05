# Page: Projects

## Projects List

**Route**: `/projects`
**File**: `apps/web/src/app/(dashboard)/projects/page.tsx`
**Component**: `ProjectsPage` (async server component)

### Data Loading

Fetches all projects via `getProjects()` during SSR. Errors are caught and displayed inline.

### Features

- **Pagination**: Client-side pagination controlled by `?page` and `?pageSize` query parameters. Defaults to 12 items per page. Uses the shared `Pagination` component.
- **Status indicators**: Each project row shows a colored status dot:
  - `active` -- green with glow (`bg-tertiary`)
  - `paused` -- blue with glow (`bg-secondary`)
  - `archived` -- dimmed outline
- **Project cards**: Display the project name, status label, creation date, assigned agent count, and open task count.
- **Create action**: "New project" button links to `/projects/new`.
- **Success banner**: When arriving from project creation (`?created` query param), a success message is displayed.

## Create Project

**Route**: `/projects/new`
**File**: `apps/web/src/app/(dashboard)/projects/new/page.tsx`

Form for creating a new project. Fields include:

- **Name** (required)
- **Description**
- **Project Root** -- filesystem path selected via the backend's directory picker (`selectDirectory()`)
- **Seed type** -- `none` or `git`
- **Seed URL** -- shown when seed type is `git`
- **Tags** -- comma-separated list
- **Status** -- defaults to `active`

On submission, calls `createProject()` and redirects to `/projects?created=<id>`.

## Project Detail

**Route**: `/projects/[id]`
**File**: `apps/web/src/app/(dashboard)/projects/[id]/page.tsx`

Displays project metadata, assigned agents, task summary, and recent activity. Links to the project's Kanban board and edit form.

## Edit Project

**Route**: `/projects/[id]/edit`
**File**: `apps/web/src/app/(dashboard)/projects/[id]/edit/page.tsx`

Pre-populated form for editing project properties. Uses `patchProject()` on submission.

## Navigation

The sidebar "Projects" link points to `/projects`. Individual project rows link to the project detail page. The Kanban board is accessible from the project detail page or via the sidebar "Tasks" link (which resolves to the preferred or first project's board).
