import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { ApiError, getAgents, getProject, getProjectActivity } from "@/lib/api";

const statusConfig = {
  active: {
    label: "Active",
    className: "bg-tertiary/15 text-tertiary",
  },
  paused: {
    label: "Paused",
    className: "bg-secondary/15 text-secondary",
  },
  archived: {
    label: "Archived",
    className: "bg-on-surface-variant/10 text-on-surface-variant",
  },
} as const;

const formatDateTime = (timestamp: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));

const formatActivityLabel = (type: "comment" | "run" | "assignment") => {
  switch (type) {
    case "assignment":
      return { icon: "person_add", tone: "text-secondary" };
    case "run":
      return { icon: "play_circle", tone: "text-tertiary" };
    case "comment":
      return { icon: "chat", tone: "text-primary" };
  }
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const [project, activity, agents] = await Promise.all([
      getProject(id),
      getProjectActivity(id),
      getAgents(),
    ]);
    const assignedAgents = agents.filter((agent) => agent.projectIds.includes(project.id));
    const status = statusConfig[project.status];

    return (
      <>
        <Link
          href="/projects"
          className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5 text-sm mb-8 anim-1"
        >
          <Icon name="arrow_back" size={16} />
          Projects
        </Link>

        <div className="flex flex-col gap-4 mb-10 anim-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`font-mono text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-sm ${status.className}`}>
                {status.label}
              </span>
              <span className="font-mono text-[10px] text-on-surface-variant/40 uppercase tracking-widest">
                ID: {project.id}
              </span>
            </div>
            <Link
              href={`/projects/${project.id}/board`}
              className="ghost px-5 py-2.5 rounded-sm text-sm font-bold text-on-surface flex items-center gap-2 hover:bg-surface-container-high/60 transition-all"
            >
              Go to Project Board
              <Icon name="arrow_forward" size={16} />
            </Link>
          </div>
          <div>
            <h2 className="text-4xl font-extrabold tracking-tighter text-on-surface">
              {project.name}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-10 anim-2">
          <div className="bg-surface-container-low p-5 ghost">
            <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-3">
              Backlog
            </p>
            <p className="text-3xl font-black tracking-tight text-on-surface">
              {project.backlogTaskCount}
            </p>
          </div>
          <div className="bg-surface-container-low p-5 ghost">
            <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-3">
              Assigned Agents
            </p>
            <p className="text-3xl font-black tracking-tight text-on-surface">
              {assignedAgents.length}
            </p>
          </div>
          <div className="bg-surface-container-low p-5 ghost">
            <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-3">
              Open Tasks
            </p>
            <p className="text-3xl font-black tracking-tight text-on-surface">
              {project.openTaskCount}
            </p>
          </div>
          <div className="bg-surface-container-low p-5 ghost">
            <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-3">
              Updated
            </p>
            <p className="font-mono text-sm text-on-surface">{formatDateTime(project.updatedAt)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-surface-container p-6 ghost anim-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-bold tracking-widest uppercase text-on-surface">
                  Configuration
                </h3>
                <span className="font-mono text-[9px] text-on-surface-variant/40 uppercase tracking-widest">
                  {project.seedType === "git" ? "Git Seed" : "Manual Root"}
                </span>
              </div>
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">
                    Description
                  </dt>
                  <dd className="text-on-surface leading-relaxed">
                    {project.description ? (
                      project.description
                    ) : (
                      <span className="text-on-surface-variant">No description</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">
                    Project Root
                  </dt>
                  <dd className="font-mono text-on-surface">{project.projectRoot}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">
                    Seed URL
                  </dt>
                  <dd className="text-on-surface">
                    {project.seedUrl ? (
                      <a
                        href={project.seedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-secondary hover:text-secondary/80 transition-colors break-all"
                      >
                        {project.seedUrl}
                      </a>
                    ) : (
                      "None"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">
                    Tags
                  </dt>
                  <dd className="flex flex-wrap gap-2">
                    {project.tags.length > 0 ? (
                      project.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-[10px] font-mono uppercase tracking-widest bg-surface-container-low text-on-surface-variant"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-on-surface-variant">No tags</span>
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="bg-surface-container p-6 ghost anim-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-bold tracking-widest uppercase text-on-surface">
                  Assigned Agents
                </h3>
                <span className="font-mono text-[9px] text-on-surface-variant/40 uppercase tracking-widest">
                  {assignedAgents.length} linked
                </span>
              </div>
              {assignedAgents.length > 0 ? (
                <div className="space-y-3">
                  {assignedAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="bg-surface-container-low px-4 py-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-mono text-sm text-on-surface">{agent.name}</p>
                        <p className="text-[11px] uppercase tracking-widest text-on-surface-variant">
                          {agent.role}
                        </p>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                        {agent.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant">
                  No agents are assigned to this project yet.
                </p>
              )}
            </section>
          </div>

          <aside className="space-y-4 anim-3">
            <div className="bg-surface-container p-6 ghost">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-bold tracking-widest uppercase text-on-surface">
                  Activity
                </h3>
                <span className="font-mono text-[9px] text-on-surface-variant/40 uppercase tracking-widest">
                  Latest 20
                </span>
              </div>
              {activity.length > 0 ? (
                <div className="space-y-4">
                  {activity.map((item) => {
                    const visual = formatActivityLabel(item.type);

                    return (
                      <div key={item.id} className="pl-9 relative">
                        <div className="absolute left-0 top-0.5 w-6 h-6 rounded-full bg-surface-container-low flex items-center justify-center">
                          <Icon name={visual.icon} size={14} className={visual.tone} />
                        </div>
                        <p className="font-mono text-[9px] text-on-surface-variant/35 mb-1">
                          {formatDateTime(item.createdAt)}
                        </p>
                        <p className="text-[12px] font-bold uppercase tracking-wide text-on-surface/80 mb-1">
                          {item.title}
                        </p>
                        <p className="font-mono text-[10px] text-on-surface-variant/60 leading-relaxed">
                          {item.message}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant">
                  No project activity has been recorded yet.
                </p>
              )}
            </div>
          </aside>
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}
