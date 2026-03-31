"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { setStoredBoardProjectId } from "@/lib/board-project-preference";

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

  useEffect(() => {
    const projectStillExists = projects.some((project) => project.id === currentProjectId);

    if (projectStillExists) {
      setStoredBoardProjectId(currentProjectId);
    }
  }, [currentProjectId, projects]);

  return (
    <div className="relative">
      <select
        value={currentProjectId}
        onChange={(event) => {
          const nextProjectId = event.target.value;
          setStoredBoardProjectId(nextProjectId);
          router.push(`/projects/${nextProjectId}/board`);
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
