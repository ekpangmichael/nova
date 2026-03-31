import { notFound } from "next/navigation";
import Link from "next/link";
import { AgentBar } from "@/components/board/agent-bar";
import { KanbanBoardShell } from "@/components/board/kanban-board-shell";
import { ProjectBoardSelector } from "@/components/board/project-board-selector";
import { Icon } from "@/components/ui/icon";
import {
  ApiError,
  type ApiTaskPriority,
  type ApiTaskStatus,
  getAgents,
  getProject,
  getProjects,
  getProjectTasks,
} from "@/lib/api";
import type { BoardAgent, BoardColumn, BoardTask } from "@/types";

const BOARD_COLUMN_DEFINITIONS: Array<
  Pick<BoardColumn, "id" | "title" | "accentColor" | "dimmed">
> = [
  {
    id: "backlog",
    title: "Backlog",
    accentColor: "outline-variant",
    dimmed: false,
  },
  {
    id: "todo",
    title: "To Do",
    accentColor: "secondary",
    dimmed: false,
  },
  {
    id: "in_progress",
    title: "In Progress",
    accentColor: "tertiary",
    dimmed: false,
  },
  {
    id: "in_review",
    title: "In Review",
    accentColor: "primary",
    dimmed: false,
  },
  {
    id: "done",
    title: "Done",
    accentColor: "outline-variant",
    dimmed: true,
  },
  {
    id: "blocked",
    title: "Blocked",
    accentColor: "primary",
    dimmed: true,
  },
  {
    id: "paused",
    title: "Paused",
    accentColor: "outline-variant",
    dimmed: true,
  },
  {
    id: "failed",
    title: "Failed",
    accentColor: "primary",
    dimmed: true,
  },
  {
    id: "canceled",
    title: "Canceled",
    accentColor: "outline-variant",
    dimmed: true,
  },
];

function mapPriority(priority: ApiTaskPriority): BoardTask["priority"] {
  switch (priority) {
    case "critical":
      return "urgent";
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    default:
      return "none";
  }
}

function formatDueDate(dueAt: string | null) {
  if (!dueAt) {
    return undefined;
  }

  return new Date(dueAt).toLocaleDateString();
}

function toBoardTask(task: Awaited<ReturnType<typeof getProjectTasks>>[number]): BoardTask {
  return {
    id: task.id,
    displayId: `TASK-${String(task.taskNumber).padStart(3, "0")}`,
    title: task.title,
    priority: mapPriority(task.priority),
    assignedAgent: task.assignedAgent?.name,
    comments: task.commentCount || undefined,
    attachments: task.attachmentCount || undefined,
    date: formatDueDate(task.dueAt),
  };
}

function buildColumns(tasks: Awaited<ReturnType<typeof getProjectTasks>>): BoardColumn[] {
  const tasksByStatus = new Map<ApiTaskStatus, BoardTask[]>();

  for (const task of tasks) {
    const columnTasks = tasksByStatus.get(task.status) ?? [];
    columnTasks.push(toBoardTask(task));
    tasksByStatus.set(task.status, columnTasks);
  }

  return BOARD_COLUMN_DEFINITIONS.map((definition) => {
    const columnTasks = tasksByStatus.get(definition.id as ApiTaskStatus) ?? [];

    return {
      ...definition,
      count: columnTasks.length,
      tasks: columnTasks,
    };
  });
}

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const [project, projects, agents, projectTasks] = await Promise.all([
      getProject(id),
      getProjects(),
      getAgents(),
      getProjectTasks(id),
    ]);

    const agentsForBar: BoardAgent[] = agents
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
            ? agent.currentTaskId
              ? `TASK ${agent.currentTaskId.slice(0, 8).toUpperCase()}`
              : "ACTIVE"
            : agent.status === "error"
              ? "ATTENTION"
              : "IDLE",
      }));

    return (
      <div className="-m-8 flex min-h-[calc(100vh-3.5rem)] flex-col pb-24">
        <div className="flex shrink-0 items-center gap-4 px-6 py-3 ghost-b">
          <Link
            href={`/projects/${id}`}
            className="flex shrink-0 items-center gap-1 text-sm text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <Icon name="arrow_back" size={16} />
          </Link>
          <div className="flex items-center gap-2 rounded-sm bg-surface-container px-3 py-1.5 ghost">
            <span className="text-xs font-mono text-secondary">PROJECT_ID</span>
            <ProjectBoardSelector
              currentProjectId={id}
              projects={projects.map((entry) => ({
                id: entry.id,
                name: entry.name,
              }))}
            />
          </div>
          <div className="h-4 w-px bg-outline-variant/30" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-on-surface">{project.name}</p>
          </div>
          <div className="relative ml-auto">
            <Icon
              name="search"
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
            <input
              type="text"
              className="w-64 rounded-sm border-none bg-surface-container-low py-1.5 pl-9 pr-4 text-xs placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-secondary/40"
              placeholder="Filter tasks, agents, or logs..."
            />
          </div>
        </div>

        <div className="scrollbar-thin flex-1 overflow-x-auto overflow-y-visible">
          <KanbanBoardShell initialColumns={buildColumns(projectTasks)} projectId={id} />
        </div>

        <AgentBar agents={agentsForBar} />
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}
