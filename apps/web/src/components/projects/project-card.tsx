import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { ApiProjectSummary } from "@/lib/api";

const statusConfig: Record<
  ApiProjectSummary["status"],
  { label: string; textColor: string; borderColor: string; chipBg: string }
> = {
  active: {
    label: "Active",
    textColor: "text-tertiary",
    borderColor: "border-tertiary/30",
    chipBg: "bg-tertiary/10",
  },
  paused: {
    label: "Paused",
    textColor: "text-secondary",
    borderColor: "border-secondary/30",
    chipBg: "bg-secondary/10",
  },
  archived: {
    label: "Archived",
    textColor: "text-on-surface-variant",
    borderColor: "border-outline-variant",
    chipBg: "bg-on-surface-variant/10",
  },
};

const formatUpdatedAt = (timestamp: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));

export function ProjectCard({ project }: { project: ApiProjectSummary }) {
  const config = statusConfig[project.status];
  const isArchived = project.status === "archived";

  return (
    <Link
      href={`/projects/${project.id}`}
      className={`bg-surface-container group hover:bg-surface-container-high transition-all duration-300 p-6 flex flex-col gap-6 ${isArchived ? "grayscale-[0.8] opacity-70" : ""}`}
    >
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <span className={`font-mono text-[10px] ${config.textColor} border ${config.borderColor} ${config.chipBg} px-2 py-0.5 rounded-full mb-3 inline-block uppercase`}>
            {config.label}
          </span>
          <h4 className="text-xl font-bold text-on-surface group-hover:text-secondary transition-colors">
            {project.name}
          </h4>
          <p className="mt-2 text-sm text-on-surface-variant leading-relaxed line-clamp-2">
            {project.description || "No description yet. This project is ready for agent assignment and task intake."}
          </p>
        </div>
        <button className="text-on-surface-variant hover:text-on-surface transition-colors">
          <Icon name="more_vert" />
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-container-lowest p-3">
          <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-1">
            Agents
          </p>
          <p className="font-bold text-on-surface">{project.assignedAgentCount}</p>
        </div>
        <div className="bg-surface-container-lowest p-3">
          <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-1">
            Project Root
          </p>
          <p className="font-mono text-xs text-on-surface truncate">
            {project.projectRoot}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-container-lowest p-3">
          <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-1">
            Open Tasks
          </p>
          <p className="font-bold text-on-surface">{project.openTaskCount}</p>
        </div>
        <div className="bg-surface-container-lowest p-3">
          <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-1">
            Updated
          </p>
          <p className="font-mono text-xs text-on-surface uppercase">
            {formatUpdatedAt(project.updatedAt)}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 ghost-t flex justify-between items-center">
        <div className="flex flex-wrap gap-2">
          {project.tags.length > 0 ? (
            project.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 text-[10px] font-mono uppercase tracking-widest bg-surface-container-low text-on-surface-variant"
              >
                {tag}
              </span>
            ))
          ) : (
            <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">
              {project.seedType === "git" ? "Git Seeded" : "Manual Root"}
            </span>
          )}
        </div>
        <Icon
          name="arrow_forward"
          size={16}
          className="text-on-surface-variant"
        />
      </div>
    </Link>
  );
}
