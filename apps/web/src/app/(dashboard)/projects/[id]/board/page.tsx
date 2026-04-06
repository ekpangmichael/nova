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
      <div className="relative flex h-full flex-col">
        <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin">
          <div className="mx-auto max-w-4xl pb-16">
            {/* Header */}
            <div className="mb-6 anim-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/projects/${id}`}
                    className="flex shrink-0 items-center gap-1.5 text-[13px] text-on-surface-variant/40 transition-colors hover:text-on-surface-variant/70"
                  >
                    <Icon name="arrow_back" size={14} />
                  </Link>
                  <ProjectBoardSelector
                    currentProjectId={id}
                    projects={projects.map((entry) => ({
                      id: entry.id,
                      name: entry.name,
                    }))}
                  />
                  <span className="text-outline-variant/15">|</span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-on-surface-variant/40">{project.name}</p>
                  </div>
                </div>
                <Link
                  href={`/tasks/new?projectId=${id}`}
                  className="flex items-center gap-2 rounded-md bg-secondary/15 px-4 py-2.5 text-[12px] font-semibold text-secondary transition-colors hover:bg-secondary/20"
                >
                  <Icon name="add" size={16} />
                  New task
                </Link>
              </div>
            </div>

            {/* Board – no anim wrapper; CSS transforms break DragOverlay fixed positioning */}
            <div>
              <KanbanBoardShell initialColumns={buildColumns(projectTasks)} projectId={id} />
            </div>
          </div>
        </div>

        {/* Agent bar — full width, pinned to bottom */}
        <div className="shrink-0 border-t border-outline-variant/8 bg-surface/60 backdrop-blur-xl">
          <AgentBar agents={agentsForBar} />
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
