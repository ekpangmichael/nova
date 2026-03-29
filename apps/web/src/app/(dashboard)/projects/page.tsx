import { getProjects, type ApiProjectSummary, ApiError } from "@/lib/api";
import Link from "next/link";
import { ProjectStats } from "@/components/projects/project-stats";
import { ProjectCard } from "@/components/projects/project-card";
import { NewProjectCard } from "@/components/projects/new-project-card";
import { Icon } from "@/components/ui/icon";

const buildStats = (projects: ApiProjectSummary[]) => {
  const totalProjects = projects.length;
  const activeProjects = projects.filter((project) => project.status === "active").length;
  const openTasks = projects.reduce((sum, project) => sum + project.openTaskCount, 0);

  return [
    {
      label: "Total Projects",
      value: totalProjects,
      unit: "REGISTERED",
      accentColor: "secondary" as const,
      icon: "folder_open",
    },
    {
      label: "Active Projects",
      value: activeProjects,
      unit: "RUNNING",
      accentColor: "tertiary" as const,
      icon: "play_circle",
    },
    {
      label: "Open Tasks",
      value: openTasks,
      unit: "ACROSS ALL",
      accentColor: "primary" as const,
      icon: "assignment",
    },
  ];
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  let projects: ApiProjectSummary[] = [];
  let errorMessage: string | null = null;

  try {
    projects = await getProjects();
  } catch (error) {
    errorMessage =
      error instanceof ApiError
        ? error.message
        : "The project service is unavailable. Start the backend and reload this page.";
  }

  const projectStats = buildStats(projects);

  return (
    <>
      {/* Page Header */}
      <div className="flex justify-between items-end mb-10 anim-1">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tighter text-on-surface mb-1">
            Project Command
          </h2>
          <p className="text-on-surface-variant font-mono text-xs tracking-widest uppercase">
            Autonomous Operations Directory
          </p>
        </div>
        <Link
          href="/projects/new"
          className="bg-primary text-on-primary font-bold px-6 py-2.5 rounded-sm text-sm flex items-center gap-2 hover:opacity-80 transition-all active:scale-95"
        >
          <Icon name="add" size={18} />
          New Project
        </Link>
      </div>

      {created ? (
        <div className="mb-6 border border-tertiary/30 bg-tertiary/10 px-4 py-3 text-sm text-tertiary anim-1">
          Project created successfully.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mb-10 border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {errorMessage}
        </div>
      ) : null}

      {/* Global Stats */}
      <ProjectStats stats={projectStats} />

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 anim-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
        <NewProjectCard />
      </div>
    </>
  );
}
