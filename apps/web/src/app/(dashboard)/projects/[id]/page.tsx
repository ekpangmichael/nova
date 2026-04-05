import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { ApiError, getAgents, getProject, getProjectActivity } from "@/lib/api";
import { ProjectActionButtons } from "@/components/project-detail/project-action-buttons";
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

const activityVisual: Record<string, { icon: string; tone: string }> = {
  assignment: { icon: "person_add", tone: "text-secondary" },
  run: { icon: "play_circle", tone: "text-tertiary" },
  comment: { icon: "chat", tone: "text-on-surface-variant/50" },
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const displayPreferences = await getServerDisplayPreferences();

  try {
    const [project, activity, agents] = await Promise.all([
      getProject(id),
      getProjectActivity(id),
      getAgents(),
    ]);
    const assignedAgents = agents.filter((agent) =>
      agent.projectIds.includes(project.id),
    );
    const visibleActivity = activity.slice(0, 5);
    const dot = statusDot[project.status] ?? "bg-outline/20";
    const label = statusLabel[project.status] ?? "text-on-surface-variant/30";
    const formatDate = (timestamp: string) =>
      formatTimestampForDisplay(timestamp, displayPreferences, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

    return (
      <div className="h-full overflow-y-auto pr-2 scrollbar-thin">
        <div className="mx-auto max-w-4xl pb-16">
          {/* Back link */}
          <Link
            href="/projects"
            className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-on-surface-variant/40 transition-colors hover:text-on-surface-variant/70 anim-1"
          >
            <Icon name="arrow_back" size={14} />
            Projects
          </Link>

          {/* Header */}
          <div className="mb-8 anim-1">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2.5">
                  <div className={`h-2 w-2 rounded-full ${dot}`} />
                  <span
                    className={`font-mono text-[10px] uppercase tracking-wider ${label}`}
                  >
                    {project.status}
                  </span>
                  {project.seedType === "git" && (
                    <>
                      <span className="text-outline-variant/15">|</span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/25">
                        Git
                      </span>
                    </>
                  )}
                </div>
                <h1 className="text-2xl font-bold tracking-[-0.03em] text-on-surface">
                  {project.name}
                </h1>
                {project.description && (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-on-surface-variant/40">
                    {project.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ProjectActionButtons
                  projectId={project.id}
                  projectName={project.name}
                />
                <Link
                  href={`/projects/${project.id}/board`}
                  className="flex items-center gap-2 rounded-md bg-secondary/15 px-4 py-2.5 text-[12px] font-semibold text-secondary transition-colors hover:bg-secondary/20"
                >
                  Board
                  <Icon name="arrow_forward" size={14} />
                </Link>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-8 grid grid-cols-4 gap-3 anim-2">
            {[
              {
                label: "Backlog",
                value: project.backlogTaskCount,
                tone: "text-on-surface",
              },
              {
                label: "Agents",
                value: assignedAgents.length,
                tone: "text-secondary",
              },
              {
                label: "Open tasks",
                value: project.openTaskCount,
                tone:
                  project.openTaskCount > 0
                    ? "text-tertiary"
                    : "text-on-surface-variant/40",
              },
              {
                label: "Updated",
                value: null,
                tone: "text-on-surface",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl bg-surface-container-low px-5 py-4 ghost"
              >
                <p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
                  {s.label}
                </p>
                {s.value !== null ? (
                  <p className={`mt-1.5 text-2xl font-semibold ${s.tone}`}>
                    {s.value}
                  </p>
                ) : (
                  <p className="mt-1.5 font-mono text-[13px] text-on-surface/70">
                    {formatDate(project.updatedAt)}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Left column */}
            <div className="space-y-6 lg:col-span-3">
              {/* Details */}
              <section className="rounded-xl bg-surface-container-low ghost anim-3">
                <div className="flex items-center justify-between px-5 py-4 ghost-b">
                  <h3 className="text-[12px] font-semibold tracking-tight text-on-surface">
                    Details
                  </h3>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-on-surface-variant/25">
                    {project.seedType === "git" ? "Git Repository" : "Local Directory"}
                  </span>
                </div>
                <div className="space-y-3.5 px-5 py-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/35">
                      Root
                    </span>
                    <span className="truncate text-right font-mono text-[12px] text-on-surface/70">
                      {project.projectRoot}
                    </span>
                  </div>
                  {project.seedUrl && (
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/35">
                        Repository
                      </span>
                      <a
                        href={project.seedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-right text-[12px] text-secondary hover:text-secondary/80 transition-colors"
                      >
                        {project.seedUrl}
                      </a>
                    </div>
                  )}
                  {project.tags.length > 0 && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/35">
                        Tags
                      </span>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {project.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md bg-surface-container-high/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-on-surface-variant/30"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Assigned agents */}
              <section className="rounded-xl bg-surface-container-low ghost anim-4">
                <div className="flex items-center justify-between px-5 py-4 ghost-b">
                  <h3 className="text-[12px] font-semibold tracking-tight text-on-surface">
                    Assigned agents
                  </h3>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-on-surface-variant/25">
                    {assignedAgents.length} linked
                  </span>
                </div>
                {assignedAgents.length > 0 ? (
                  <div className="divide-y divide-outline-variant/[0.06]">
                    {assignedAgents.map((agent) => (
                      <Link
                        key={agent.id}
                        href={`/agents/${agent.id}`}
                        className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-surface-container-high/20"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/8">
                            <Icon
                              name={agent.avatar || "smart_toy"}
                              size={16}
                              className="text-secondary/60"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-on-surface">
                              {agent.name}
                            </p>
                            <p className="truncate text-[11px] text-on-surface-variant/35">
                              {agent.role}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-on-surface-variant/30">
                          {agent.status}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-6 text-center">
                    <p className="text-[13px] text-on-surface-variant/35">
                      No agents assigned yet.
                    </p>
                  </div>
                )}
              </section>
            </div>

            {/* Right column - activity */}
            <aside className="lg:col-span-2 anim-3">
              <div className="rounded-xl bg-surface-container-low ghost">
                <div className="flex items-center justify-between px-5 py-4 ghost-b">
                  <h3 className="text-[12px] font-semibold tracking-tight text-on-surface">
                    Activity
                  </h3>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-on-surface-variant/25">
                    Latest {visibleActivity.length}
                  </span>
                </div>
                {visibleActivity.length > 0 ? (
                  <div className="divide-y divide-outline-variant/[0.06]">
                    {visibleActivity.map((item) => {
                      const vis =
                        activityVisual[item.type] ?? activityVisual.comment;
                      return (
                        <div key={item.id} className="px-5 py-3.5">
                          <div className="mb-1 flex items-center gap-2">
                            <Icon
                              name={vis.icon}
                              size={13}
                              className={vis.tone}
                            />
                            <span className="font-mono text-[9px] text-on-surface-variant/25">
                              {formatDate(item.createdAt)}
                            </span>
                          </div>
                          <p className="text-[12px] font-medium text-on-surface/70">
                            {item.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-on-surface-variant/35">
                            {item.message}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-5 py-6 text-center">
                    <p className="text-[13px] text-on-surface-variant/35">
                      No activity yet.
                    </p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}
