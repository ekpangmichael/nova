import type { RunStatus, TaskStatus } from "@nova/shared";

const manualTaskTransitions: Record<TaskStatus, TaskStatus[]> = {
  backlog: ["todo", "blocked", "canceled"],
  todo: ["backlog", "in_progress", "blocked", "paused", "canceled"],
  in_progress: ["todo", "in_review", "blocked", "paused", "canceled"],
  in_review: ["in_progress", "done", "blocked", "paused", "canceled"],
  done: ["in_review"],
  failed: ["todo", "backlog", "blocked", "canceled"],
  blocked: ["todo", "in_progress", "canceled"],
  paused: ["todo", "in_progress", "canceled"],
  canceled: [],
};

export const canManuallyTransitionTask = (
  from: TaskStatus,
  to: TaskStatus
) => {
  if (from === to) {
    return true;
  }

  return manualTaskTransitions[from].includes(to);
};

export const ACTIVE_RUN_STATUSES: RunStatus[] = [
  "requested",
  "preparing",
  "starting",
  "running",
];
