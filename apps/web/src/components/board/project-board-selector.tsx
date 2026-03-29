"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

type ProjectBoardSelectorProps = {
  currentProjectId: string;
  projects: Array<{
    id: string;
    name: string;
  }>;
};

export function ProjectBoardSelector({
  currentProjectId,
  projects,
}: ProjectBoardSelectorProps) {
  const router = useRouter();

  return (
    <div className="relative">
      <select
        value={currentProjectId}
        onChange={(event) => {
          router.push(`/projects/${event.target.value}/board`);
        }}
        className="appearance-none bg-surface-container rounded-sm ghost pl-3 pr-9 py-1.5 text-sm text-on-surface min-w-64 focus:ring-1 focus:ring-secondary/40"
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <Icon
        name="expand_more"
        size={16}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
      />
    </div>
  );
}
