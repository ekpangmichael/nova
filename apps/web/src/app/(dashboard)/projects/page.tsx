import { getProjects, type ApiProjectSummary, ApiError } from "@/lib/api";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Pagination } from "@/components/pagination";
import { formatTimestampForDisplay } from "@/lib/display-preferences";
import { getServerDisplayPreferences } from "@/lib/display-preferences.server";

const statusDot: Record<string, string> = {
  active: "bg-tertiary shadow-[0_0_6px_rgba(209,255,215,0.4)]",
  paused: "bg-secondary shadow-[0_0_6px_rgba(123,153,255,0.3)]",
  archived: "bg-outline/20",
};

const statusLabel: Record<string, string> = {
  active: "text-tertiary",
  paused: "text-secondary",
  archived: "text-on-surface-variant/30",
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const { created, page, pageSize } = await searchParams;
  const displayPreferences = await getServerDisplayPreferences();
  let projects: ApiProjectSummary[] = [];
  let errorMessage: string | null = null;

  const parsePositiveInt = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const currentPage = parsePositiveInt(page, 1);
  const currentPageSize = parsePositiveInt(pageSize, 12);

  try {
    projects = await getProjects();
  } catch (error) {
    errorMessage =
      error instanceof ApiError
        ? error.message
        : "The project service is unavailable. Start the backend and reload this page.";
  }

  const activeCount = projects.filter((p) => p.status === "active").length;
  const openTasks = projects.reduce((sum, p) => sum + p.openTaskCount, 0);
  const totalProjects = projects.length;
  const totalPages = Math.max(1, Math.ceil(totalProjects / currentPageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProjects = projects.slice(
    (safeCurrentPage - 1) * currentPageSize,
    safeCurrentPage * currentPageSize
  );

  return (
    <div className="h-full overflow-y-auto pr-2 scrollbar-thin">
      <div className="mx-auto max-w-4xl pb-16">
        {/* Header */}
        <div className="mb-10 anim-1">
          <div className="flex items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl font-bold tracking-[-0.03em] text-on-surface">
                Projects
              </h1>
              <p className="mt-1.5 text-[13px] text-on-surface-variant/40">
                Organize work, assign agents, and track progress.
              </p>
            </div>
            <Link
              href="/projects/new"
              className="flex items-center gap-2 rounded-md bg-secondary/15 px-4 py-2.5 text-[12px] font-semibold text-secondary transition-colors hover:bg-secondary/20"
            >
              <Icon name="add" size={16} />
              New project
            </Link>
          </div>
        </div>

        {created && (
          <div className="mb-6 rounded-lg border border-tertiary/20 bg-tertiary/5 px-4 py-3 text-[13px] text-tertiary anim-1">
            Project created successfully.
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-[13px] text-error">
            {errorMessage}
          </div>
        )}

        {/* Stats */}
        <div className="mb-8 grid grid-cols-3 gap-3 anim-2">
          {[
            { label: "Total", value: projects.length, tone: "text-on-surface" },
            { label: "Active", value: activeCount, tone: "text-tertiary" },
            {
              label: "Open tasks",
              value: openTasks,
              tone:
                openTasks > 0 ? "text-secondary" : "text-on-surface-variant/40",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-surface-container-low px-5 py-4 ghost"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
                {stat.label}
              </p>
              <p className={`mt-1.5 text-2xl font-semibold ${stat.tone}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Project grid */}
        <div className="grid gap-3 lg:grid-cols-2 anim-3">
          {paginatedProjects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group overflow-hidden rounded-xl bg-surface-container-low ghost transition-all duration-200 hover:bg-surface-container-low/80"
            >
              <div className="p-5">
                {/* Top row */}
                <div className="mb-3 flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tertiary/8">
                    <Icon
                      name={project.seedType === "git" ? "folder_data" : "folder_open"}
                      size={20}
                      className="text-tertiary/75"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[15px] font-semibold tracking-tight text-on-surface">
                      {project.name}
                    </h2>
                    <p className="truncate text-[12px] text-on-surface-variant/40">
                      {project.description || "No description"}
                    </p>
                  </div>
                  <Icon
                    name="arrow_forward"
                    size={16}
                    className="shrink-0 text-on-surface-variant/20 transition-all group-hover:translate-x-0.5 group-hover:text-on-surface-variant/50"
                  />
                </div>

                {/* Status + meta */}
                <div className="mb-4 flex items-center gap-3 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${statusDot[project.status] ?? "bg-outline/20"}`}
                    />
                    <span
                      className={`font-mono uppercase tracking-wider ${statusLabel[project.status] ?? "text-on-surface-variant/30"}`}
                    >
                      {project.status}
                    </span>
                  </div>
                  <span className="text-outline-variant/15">|</span>
                  <span className="font-mono uppercase tracking-wider text-on-surface-variant/30">
                    {project.assignedAgentCount} agent{project.assignedAgentCount !== 1 ? "s" : ""}
                  </span>
                  <span className="text-outline-variant/15">|</span>
                  <span className="font-mono uppercase tracking-wider text-on-surface-variant/30">
                    {project.openTaskCount} open
                  </span>
                </div>

                {/* Tags */}
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-surface-container-high/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-on-surface-variant/30">
                    {project.seedType === "git" ? "Git" : "Local"}
                  </span>
                  {project.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-surface-container-high/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-on-surface-variant/30"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-on-surface-variant/20">
                    {formatTimestampForDisplay(project.updatedAt, displayPreferences, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Pagination */}
        {projects.length > 0 && (
          <Pagination
            total={totalProjects}
            pageSize={currentPageSize}
            currentPage={safeCurrentPage}
            pages={totalPages}
            queryMode="url"
          />
        )}

        {projects.length === 0 && !errorMessage && (
          <div className="mt-8 rounded-xl bg-surface-container-low ghost p-8 text-center">
            <Icon
              name="folder_open"
              size={32}
              className="mx-auto mb-3 text-on-surface-variant/20"
            />
            <p className="text-sm text-on-surface-variant/40">
              No projects registered yet.
            </p>
            <Link
              href="/projects/new"
              className="mt-4 inline-flex items-center gap-2 text-[12px] font-semibold text-secondary hover:text-secondary/80 transition-colors"
            >
              <Icon name="add" size={14} />
              Create your first project
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
