import { notFound } from "next/navigation";
import Link from "next/link";
import { KanbanBoard } from "@/components/board/kanban-board";
import { AgentBar } from "@/components/board/agent-bar";
import { ProjectBoardSelector } from "@/components/board/project-board-selector";
import { Icon } from "@/components/ui/icon";
import { boardAgents, boardColumns, projectDetails } from "@/lib/mock-data";
import { ApiError, getAgents, getProject, getProjects } from "@/lib/api";
import type { BoardAgent, BoardColumn } from "@/types";

const emptyBoardColumns: BoardColumn[] = [
  {
    id: "backlog",
    title: "Backlog",
    count: 0,
    accentColor: "outline-variant",
    tasks: [],
  },
  {
    id: "todo",
    title: "To Do",
    count: 0,
    accentColor: "secondary",
    tasks: [],
  },
  {
    id: "in-progress",
    title: "In Progress",
    count: 0,
    accentColor: "tertiary",
    tasks: [],
  },
  {
    id: "in-review",
    title: "In Review",
    count: 0,
    accentColor: "primary",
    tasks: [],
  },
  {
    id: "done",
    title: "Done",
    count: 0,
    accentColor: "outline-variant",
    dimmed: true,
    tasks: [],
  },
];

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mockProject = projectDetails[id];
  let projectName = mockProject?.name ?? "Project Board";
  let columns = boardColumns;
  let agentsForBar: BoardAgent[] = boardAgents;
  let selectorProjects = Object.entries(projectDetails).map(
    ([projectId, project]) => ({
      id: projectId,
      name: project.name,
    })
  );

  try {
    const apiProjects = await getProjects();

    selectorProjects = [
      ...apiProjects.map((project) => ({
        id: project.id,
        name: project.name,
      })),
      ...selectorProjects,
    ].filter(
      (project, index, allProjects) =>
        allProjects.findIndex((candidate) => candidate.id === project.id) === index
    );
  } catch {
    selectorProjects = selectorProjects;
  }

  if (!mockProject) {
    try {
      const [project, agents] = await Promise.all([getProject(id), getAgents()]);
      projectName = project.name;
      columns = emptyBoardColumns;
      agentsForBar = agents
        .filter((agent) => agent.projectIds.includes(id))
        .map((agent) => ({
          name: agent.name.toUpperCase(),
          status:
            agent.status === "working"
              ? "working"
              : agent.status === "error"
                ? "error"
                : "idle",
          activity:
            agent.status === "working"
              ? "ACTIVE"
              : agent.status === "error"
                ? "ATTENTION"
                : "IDLE",
        }));
      selectorProjects = [
        {
          id: project.id,
          name: project.name,
        },
        ...selectorProjects,
      ].filter(
        (projectOption, index, allProjects) =>
          allProjects.findIndex((candidate) => candidate.id === projectOption.id) === index
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        notFound();
      }

      columns = emptyBoardColumns;
      agentsForBar = [];
    }
  }

  return (
    <div className="-m-8 flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Board Header */}
      <div className="flex items-center gap-4 px-6 py-3 ghost-b shrink-0">
        <Link
          href={`/projects/${id}`}
          className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1 text-sm shrink-0"
        >
          <Icon name="arrow_back" size={16} />
        </Link>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-sm ghost">
          <span className="text-xs font-mono text-secondary">PROJECT_ID</span>
          <ProjectBoardSelector
            currentProjectId={id}
            projects={selectorProjects}
          />
        </div>
        <div className="h-4 w-px bg-outline-variant/30" />
        <div className="relative">
          <Icon
            name="search"
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="text"
            className="bg-surface-container-low border-none rounded-sm pl-9 pr-4 py-1.5 text-xs w-64 focus:ring-1 focus:ring-secondary/40 placeholder:text-on-surface-variant/50"
            placeholder="Filter tasks, agents, or logs..."
          />
        </div>
      </div>

      {/* Kanban Grid (drag-and-drop) */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin">
        <KanbanBoard initialColumns={columns} projectId={id} />
      </div>

      {/* Agent Status Bar */}
      <AgentBar agents={agentsForBar} />
    </div>
  );
}
