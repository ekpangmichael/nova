"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { TaskActionButtons } from "@/components/task-detail/task-action-buttons";
import { TaskAttachments } from "@/components/task-detail/task-attachments";
import { CommentThread } from "@/components/task-detail/comment-thread";
import { TaskDescription } from "@/components/task-detail/task-description";
import { TaskExecutionLog } from "@/components/task-detail/task-execution-log";
import { TaskHeader } from "@/components/task-detail/task-header";
import { TaskMetadata } from "@/components/task-detail/task-metadata";
import {
  ApiError,
  type ApiRunEvent,
  type ApiTaskComment,
  type ApiTaskDetail,
  type ApiTaskRun,
  getRunEvents,
  getTask,
  resolveBackendWebsocketUrl,
  startTask,
  stopTask,
} from "@/lib/api";
import type { ExecutionLogItem, TaskAttachment, TaskDetail } from "@/types";

type CommentView = {
  id: string;
  author: string;
  isAI: boolean;
  timeLabel: string;
  message: string;
};

type TaskDetailScreenProps = {
  projectId: string;
  initialTask: ApiTaskDetail;
  initialRunEvents: ApiRunEvent[];
};

type WebsocketEnvelope = {
  type: string;
  payload: unknown;
  sentAt: string;
};

function formatTaskStatusLabel(status: TaskDetail["status"]) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (value) => value.toUpperCase());
}

function formatPriority(task: ApiTaskDetail): Pick<TaskDetail, "priority" | "priorityColor"> {
  switch (task.priority) {
    case "critical":
      return { priority: "Critical", priorityColor: "error" };
    case "high":
      return { priority: "High", priorityColor: "tertiary" };
    case "medium":
      return { priority: "Medium", priorityColor: "secondary" };
    case "low":
      return { priority: "Low", priorityColor: "outline" };
    default:
      return { priority: "Unspecified", priorityColor: "outline" };
  }
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getAttachmentIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType.includes("json")) {
    return "data_object";
  }

  if (mimeType.includes("markdown") || mimeType.includes("text")) {
    return "description";
  }

  if (mimeType.includes("pdf")) {
    return "picture_as_pdf";
  }

  return "attach_file";
}

function buildTaskAttachments(task: ApiTaskDetail): TaskAttachment[] {
  return task.attachments.map((attachment) => ({
    name: attachment.fileName,
    size: formatFileSize(attachment.sizeBytes),
    type: attachment.mimeType,
    icon: getAttachmentIcon(attachment.mimeType),
  }));
}

function buildRunStatusLog(task: ApiTaskDetail): ExecutionLogItem[] {
  const runs = task.currentRun
    ? [task.currentRun, ...task.recentRuns.filter((run) => run.id !== task.currentRun?.id)]
    : task.recentRuns;

  if (runs.length === 0) {
    return [
      {
        icon: "schedule",
        title: "No runs yet.",
        description: "The task has been created and is waiting for execution.",
        timeAgo: new Date(task.createdAt).toLocaleString(),
      },
    ];
  }

  return runs.slice(0, 5).map((run: ApiTaskRun) => {
    const icon =
      run.status === "completed"
        ? "check_circle"
        : run.status === "failed"
          ? "error"
          : run.status === "aborted"
            ? "stop_circle"
            : "play_circle";

    return {
      icon,
      title: `Attempt ${run.attemptNumber}`,
      description: run.finalSummary
        ? run.finalSummary
        : run.failureReason
          ? `Ended with ${run.status}: ${run.failureReason}`
          : `Run entered ${run.status.replace(/_/g, " ")} state.`,
      timeAgo: new Date(run.updatedAt).toLocaleString(),
    };
  });
}

function buildEventLog(events: ApiRunEvent[]): ExecutionLogItem[] {
  const visibleEvents = [...events].slice(-12).reverse();

  return visibleEvents.map((event) => {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const description =
      typeof payload.message === "string"
        ? payload.message
        : typeof payload.delta === "string"
          ? payload.delta
          : typeof payload.reason === "string"
            ? payload.reason
            : typeof payload.finalSummary === "string"
              ? payload.finalSummary
              : typeof payload.toolName === "string"
                ? payload.toolName
                : typeof payload.path === "string"
                  ? payload.path
                  : "Runtime event received.";

    const icon =
      event.eventType === "run.completed"
        ? "check_circle"
        : event.eventType === "run.failed"
          ? "error"
          : event.eventType === "run.aborted"
            ? "stop_circle"
            : event.eventType.startsWith("tool.")
              ? "build"
              : event.eventType === "artifact.created"
                ? "draft"
                : event.eventType === "message.completed"
                  ? "forum"
                  : "play_circle";

    return {
      icon,
      title: event.eventType.replace(/\./g, " "),
      description,
      timeAgo: new Date(event.createdAt).toLocaleString(),
    };
  });
}

function splitDescription(description: string) {
  const parts = description
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : ["No description provided."];
}

function buildTaskDetailView(task: ApiTaskDetail, runEvents: ApiRunEvent[]): TaskDetail {
  const priority = formatPriority(task);

  return {
    id: `TASK-${String(task.taskNumber).padStart(3, "0")}`,
    title: task.title,
    status: task.status,
    statusLabel: formatTaskStatusLabel(task.status),
    description: splitDescription(task.description),
    priority: priority.priority,
    priorityColor: priority.priorityColor,
    assignedAgent: {
      name: task.assignedAgent?.name ?? "Unassigned",
      role: task.assignedAgent?.role ?? "No role",
    },
    workspace: task.resolvedExecutionTarget,
    deadline: task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "No deadline",
    attachments: buildTaskAttachments(task),
    executionLog: runEvents.length > 0 ? buildEventLog(runEvents) : buildRunStatusLog(task),
  };
}

function buildCommentView(task: ApiTaskDetail): CommentView[] {
  return [...task.comments]
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    )
    .map((comment: ApiTaskComment) => ({
      id: comment.id,
      author:
        comment.authorType === "agent"
          ? task.assignedAgent?.name ?? "Agent"
          : comment.authorType === "system"
            ? "System"
            : comment.authorId ?? "Operator",
      isAI: comment.authorType === "agent",
      timeLabel: new Date(comment.createdAt).toLocaleString(),
      message: comment.body,
    }));
}

export function TaskDetailScreen({
  projectId,
  initialTask,
  initialRunEvents,
}: TaskDetailScreenProps) {
  const [task, setTask] = useState(initialTask);
  const [runEvents, setRunEvents] = useState(initialRunEvents);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  useEffect(() => {
    setTask(initialTask);
    setRunEvents(initialRunEvents);
  }, [initialTask, initialRunEvents]);

  async function refreshTaskState() {
    const nextTask = await getTask(task.id);
    setTask(nextTask);

    if (nextTask.currentRun) {
      setRunEvents(await getRunEvents(nextTask.currentRun.id));
    } else {
      setRunEvents([]);
    }
  }

  async function handleStart() {
    if (isStarting || task.currentRun) {
      return;
    }

    setActionError(null);
    setIsStarting(true);

    try {
      const run = await startTask(task.id);
      setRunEvents(await getRunEvents(run.id));
      await refreshTaskState();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : "Unable to start the task right now."
      );
    } finally {
      setIsStarting(false);
    }
  }

  async function handleStop() {
    if (isStopping || !task.currentRun) {
      return;
    }

    setActionError(null);
    setIsStopping(true);

    try {
      await stopTask(task.id);
      await refreshTaskState();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : "Unable to stop the task right now."
      );
    } finally {
      setIsStopping(false);
    }
  }

  useEffect(() => {
    const backendWebsocketUrl = resolveBackendWebsocketUrl();
    const socket = new WebSocket(backendWebsocketUrl);

    socket.onmessage = (rawEvent) => {
      let envelope: WebsocketEnvelope;

      try {
        envelope = JSON.parse(rawEvent.data as string) as WebsocketEnvelope;
      } catch {
        return;
      }

      if (envelope.type === "task.updated") {
        const nextTask = envelope.payload as ApiTaskDetail;

        if (nextTask.id !== task.id) {
          return;
        }

        setTask(nextTask);

        if (!nextTask.currentRun) {
          setRunEvents([]);
          return;
        }

        void getRunEvents(nextTask.currentRun.id).then((events) => {
          setRunEvents(events);
        });
        return;
      }

      if (envelope.type === "run.event") {
        const payload = envelope.payload as {
          runId: string;
          taskId: string;
          seq: number;
          event: {
            type: string;
            at: string;
            data: unknown;
          };
        };

        if (payload.taskId !== task.id) {
          return;
        }

        setRunEvents((previous) => {
          const nextEvent = {
            id: `${payload.runId}:${payload.seq}`,
            taskRunId: payload.runId,
            seq: payload.seq,
            eventType: payload.event.type,
            payload: payload.event.data,
            createdAt: payload.event.at,
          } satisfies ApiRunEvent;

          const nextEvents = previous.filter((event) => event.seq !== nextEvent.seq);
          nextEvents.push(nextEvent);
          nextEvents.sort((left, right) => left.seq - right.seq);
          return nextEvents;
        });
        return;
      }

      if (envelope.type === "run.created" || envelope.type === "run.updated") {
        const payload = envelope.payload as { task?: { id?: string } };

        if (payload.task?.id === task.id) {
          void refreshTaskState();
        }
      }
    };

    return () => {
      socket.close();
    };
  }, [task.id]);

  useEffect(() => {
    if (!task.currentRun) {
      return;
    }

    let cancelled = false;
    let refreshTimer: number | null = null;

    const scheduleRefresh = () => {
      if (cancelled) {
        return;
      }

      refreshTimer = window.setTimeout(async () => {
        if (cancelled) {
          return;
        }

        if (document.visibilityState === "visible") {
          try {
            await refreshTaskState();
          } catch {
            // Keep the polling loop resilient; the websocket remains the primary path.
          }
        }

        scheduleRefresh();
      }, 2000);
    };

    scheduleRefresh();

    return () => {
      cancelled = true;

      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, [task.id, task.currentRun?.id]);

  const taskView = buildTaskDetailView(task, runEvents);
  const comments = buildCommentView(task);
  const isRunActive = Boolean(task.currentRun);
  const idleActionLabel =
    task.status === "blocked" || task.status === "paused" ? "Resume" : "Start";

  return (
    <>
      <div className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href={`/projects/${projectId}/board`}
            className="flex items-center gap-1 text-sm text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <Icon name="arrow_back" size={16} />
            Board
          </Link>
          <div className="h-4 w-px bg-outline-variant/30" />
          <span className="border-secondary pb-1 text-sm font-semibold text-on-surface ghost-b">
            Task Detail
          </span>
          <span className="text-sm text-on-surface-variant/40">{task.project.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <TaskActionButtons
            taskId={task.id}
            taskTitle={task.title}
            projectId={projectId}
          />
          {!isRunActive ? (
            <button
              type="button"
              onClick={() => void handleStart()}
              disabled={isStarting}
              className="flex items-center gap-2 rounded-sm bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary transition-all hover:opacity-85 active:scale-[0.98] disabled:opacity-50"
            >
              <Icon name="play_arrow" size={18} />
              {isStarting
                ? idleActionLabel === "Resume"
                  ? "Resuming..."
                  : "Starting..."
                : idleActionLabel}
            </button>
          ) : null}
        </div>
      </div>

      {actionError ? (
        <div className="mb-8 rounded-sm border border-error/30 bg-error/8 px-4 py-3 text-sm text-error">
          {actionError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
        <section className="space-y-8 md:col-span-8">
          <TaskHeader task={taskView} />
          <TaskDescription paragraphs={taskView.description} />
          <TaskAttachments attachments={taskView.attachments} />
          <CommentThread
            taskId={task.id}
            comments={comments}
            onCommentCreated={refreshTaskState}
            agentWorking={isRunActive}
            onStopAgent={() => void handleStop()}
            isStopping={isStopping}
          />
        </section>

        <aside className="space-y-6 md:col-span-4">
          <TaskMetadata task={taskView} />
          <TaskExecutionLog log={taskView.executionLog} />

          <div className="flex flex-col gap-3 pt-4">
            <Link
              href={`/tasks/new?projectId=${task.project.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-sm px-4 py-3 text-xs font-medium text-on-surface-variant transition-all ghost hover:bg-surface-container-high hover:text-on-surface"
            >
              <Icon name="add" size={16} />
              Create Related Task
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
