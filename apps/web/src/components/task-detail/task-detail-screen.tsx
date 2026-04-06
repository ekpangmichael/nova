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
  buildEventLog,
  formatRuntimeLabel,
} from "@/components/task-detail/task-run-events";
import {
  ApiError,
  type ApiAgent,
  type ApiRunEvent,
  getTaskCommentAttachmentContentUrl,
  type ApiTaskComment,
  type ApiTaskDetail,
  type ApiTaskRun,
  getRunEvents,
  getTask,
  resolveBackendWebsocketUrl,
  startTask,
  stopTask,
} from "@/lib/api";
import {
  DEFAULT_DISPLAY_PREFERENCES,
  formatAbsoluteTimestamp,
  formatTimestampForDisplay,
  readDisplayPreferencesFromBrowser,
  type DisplayPreferences,
} from "@/lib/display-preferences";
import type { ExecutionLogItem, TaskAttachment, TaskDetail } from "@/types";

type CommentView = {
  id: string;
  author: string;
  isAI: boolean;
  timeLabel: string;
  message: string;
  attachments: Array<{
    id: string;
    name: string;
    size: string;
    type: string;
    icon: string;
    isImage: boolean;
    contentUrl: string;
  }>;
};

type TaskDetailScreenProps = {
  projectId: string;
  initialTask: ApiTaskDetail;
  initialRunEvents: ApiRunEvent[];
  allAgents: ApiAgent[];
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

function buildRunStatusLog(
  task: ApiTaskDetail,
  preferences: DisplayPreferences
): ExecutionLogItem[] {
  const runs = task.currentRun
    ? [task.currentRun, ...task.recentRuns.filter((run) => run.id !== task.currentRun?.id)]
    : task.recentRuns;

  if (runs.length === 0) {
    return [
      {
        icon: "schedule",
        title: "No runs yet.",
        description: "This task is queued and waiting to be picked up by an agent.",
        timeAgo: formatTimestampForDisplay(task.createdAt, preferences),
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
      timeAgo: formatTimestampForDisplay(run.updatedAt, preferences),
      runtimeLabel: formatRuntimeLabel(run.runtimeKind) ?? undefined,
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

function buildTaskDetailView(
  task: ApiTaskDetail,
  runEvents: ApiRunEvent[],
  preferences: DisplayPreferences
): TaskDetail {
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
    handoffAgent: task.handoffAgent
      ? {
          name: task.handoffAgent.name,
          role: task.handoffAgent.role,
        }
      : null,
    workspace: task.resolvedExecutionTarget,
    branch: task.gitBranchName
      ? {
          name: task.gitBranchName,
          url: task.gitBranchUrl,
        }
      : null,
    deadline: task.dueAt
      ? formatAbsoluteTimestamp(task.dueAt, preferences, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "No deadline",
    attachments: buildTaskAttachments(task),
    executionLog:
      runEvents.length > 0
        ? buildEventLog(
            runEvents,
            preferences,
            task.currentRun?.runtimeKind ?? task.recentRuns[0]?.runtimeKind
          )
        : buildRunStatusLog(task, preferences),
  };
}

function buildCommentView(
  task: ApiTaskDetail,
  preferences: DisplayPreferences
): CommentView[] {
  return [...task.comments]
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    )
    .map((comment: ApiTaskComment) => ({
      id: comment.id,
      author:
        comment.authorLabel ??
        (comment.authorType === "system" ? "System" : "You"),
      isAI: comment.authorType === "agent",
      timeLabel: formatTimestampForDisplay(comment.createdAt, preferences),
      message: comment.body,
      attachments: comment.attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.fileName,
        size: formatFileSize(attachment.sizeBytes),
        type: attachment.mimeType,
        icon: getAttachmentIcon(attachment.mimeType),
        isImage: attachment.mimeType.startsWith("image/"),
        contentUrl: getTaskCommentAttachmentContentUrl(
          task.id,
          comment.id,
          attachment.id
        ),
      })),
    }));
}

export function TaskDetailScreen({
  projectId,
  initialTask,
  initialRunEvents,
  allAgents,
}: TaskDetailScreenProps) {
  const [displayPreferences, setDisplayPreferences] = useState<DisplayPreferences>(
    DEFAULT_DISPLAY_PREFERENCES
  );
  const [task, setTask] = useState(initialTask);
  const [runEvents, setRunEvents] = useState(initialRunEvents);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [resumeWatchUntil, setResumeWatchUntil] = useState<number | null>(null);

  useEffect(() => {
    setDisplayPreferences(readDisplayPreferencesFromBrowser());
  }, []);

  useEffect(() => {
    setTask(initialTask);
    setRunEvents(initialRunEvents);
  }, [initialTask, initialRunEvents]);

  useEffect(() => {
    void refreshTaskState().catch(() => {
      // Keep the initial server snapshot as a fallback if the client-side refresh fails.
    });
  }, [task.id]);

  useEffect(() => {
    if (task.currentRun && resumeWatchUntil !== null) {
      setResumeWatchUntil(null);
    }
  }, [task.currentRun, resumeWatchUntil]);

  async function refreshTaskState() {
    const nextTask = await getTask(task.id);
    setTask(nextTask);

    if (nextTask.currentRun) {
      setRunEvents(await getRunEvents(nextTask.currentRun.id));
    } else {
      setRunEvents([]);
    }
  }

  function safeRefreshTaskState() {
    void refreshTaskState().catch(() => {
      // Runtime execution should not surface a red dev overlay when a live refresh misses once.
    });
  }

  function safeLoadRunEvents(runId: string) {
    void getRunEvents(runId)
      .then((events) => {
        setRunEvents(events);
      })
      .catch(() => {
        // A dropped live fetch should not interrupt the task page; polling will reconcile shortly.
      });
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

  async function handleCommentCreated() {
    await refreshTaskState();

    if (!task.currentRun) {
      setResumeWatchUntil(Date.now() + 15_000);
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

        safeLoadRunEvents(nextTask.currentRun.id);
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
          safeRefreshTaskState();
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

  useEffect(() => {
    if (resumeWatchUntil === null || task.currentRun) {
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

        if (Date.now() >= resumeWatchUntil) {
          setResumeWatchUntil(null);
          return;
        }

        if (document.visibilityState === "visible") {
          try {
            await refreshTaskState();
          } catch {
            // Keep watching briefly for a backend-started resume after a comment is posted.
          }
        }

        scheduleRefresh();
      }, 1500);
    };

    scheduleRefresh();

    return () => {
      cancelled = true;

      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, [resumeWatchUntil, task.currentRun]);

  const taskView = buildTaskDetailView(task, runEvents, displayPreferences);
  const comments = buildCommentView(task, displayPreferences);
  const isRunActive = Boolean(task.currentRun);
  const idleActionLabel =
    task.status === "blocked" || task.status === "paused" ? "Resume" : "Start";

  return (
    <div className="h-full overflow-y-auto pr-2 scrollbar-thin">
      <div className="mx-auto max-w-4xl pb-16">
        {/* Nav */}
        <div className="mb-8 flex items-center justify-between anim-1">
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${projectId}/board`}
              className="flex items-center gap-1.5 text-[13px] text-on-surface-variant/40 transition-colors hover:text-on-surface-variant/70"
            >
              <Icon name="arrow_back" size={14} />
              Board
            </Link>
            <span className="text-outline-variant/15">|</span>
            <span className="text-[13px] text-on-surface-variant/30">
              {task.project.name}
            </span>
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
                className="flex items-center gap-2 rounded-md bg-secondary/15 px-4 py-2.5 text-[12px] font-semibold text-secondary transition-colors hover:bg-secondary/20 disabled:opacity-50"
              >
                <Icon name="play_arrow" size={16} />
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
          <div className="mb-6 rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-[13px] text-error">
            {actionError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <section className="space-y-6 lg:col-span-3 anim-2">
            <TaskHeader task={taskView} />
            <TaskDescription paragraphs={taskView.description} />
            <TaskAttachments attachments={taskView.attachments} />
            <CommentThread
              taskId={task.id}
              comments={comments}
              agents={allAgents}
              assignedAgentId={task.assignedAgentId}
              projectAgentIds={task.project.assignedAgentIds}
              onCommentCreated={handleCommentCreated}
              agentWorking={isRunActive}
              onStopAgent={() => void handleStop()}
              isStopping={isStopping}
            />
          </section>

          <aside className="space-y-4 lg:col-span-2 anim-3">
            <TaskMetadata task={taskView} />
            <TaskExecutionLog
              log={taskView.executionLog}
              href={`/projects/${projectId}/board/${task.id}/log`}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
