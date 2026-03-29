import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { ProjectDetail } from "@/types";

const statusConfig: Record<
  ProjectDetail["status"],
  { label: string; bg: string; text: string }
> = {
  live: { label: "Live System", bg: "bg-tertiary/15", text: "text-tertiary" },
  paused: { label: "Paused", bg: "bg-secondary/15", text: "text-secondary" },
  maintenance: { label: "Maintenance", bg: "bg-error/15", text: "text-error" },
  archived: { label: "Archived", bg: "bg-on-surface-variant/10", text: "text-on-surface-variant" },
};

export function ProjectHeader({ project }: { project: ProjectDetail }) {
  const status = statusConfig[project.status];

  return (
    <div className="flex justify-between items-start mb-8 anim-1">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`${status.bg} ${status.text} font-mono text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-sm`}
          >
            {status.label}
          </span>
          <span className="font-mono text-[10px] text-on-surface-variant/40">
            ID: {project.projectId}
          </span>
        </div>
        <h2 className="text-4xl font-extrabold tracking-tighter text-on-surface uppercase mb-2">
          {project.name}
        </h2>
        <div className="flex items-center gap-4 font-mono text-[10px] text-on-surface-variant/60 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Icon name="priority_high" size={14} className="text-error/60" />
            Priority: {project.priority}
          </span>
          <span className="text-outline-variant/30">&bull;</span>
          <span className="flex items-center gap-1.5">
            <Icon name="account_tree" size={14} />
            {project.workflowCount} Parallel Workflows
          </span>
        </div>
      </div>
      <Link
        href={`/projects/${project.id}/board`}
        className="ghost px-5 py-2.5 rounded-sm text-sm font-bold text-on-surface flex items-center gap-2 hover:bg-surface-container-high/60 transition-all"
      >
        Go to Project Board
        <Icon name="arrow_forward" size={16} />
      </Link>
    </div>
  );
}
