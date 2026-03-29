import type { RunStatus, TaskStatus } from "@nova/shared";

const manualTaskTransitions: Record<TaskStatus, TaskStatus[]> = {
  backlog: ["todo", "canceled"],
  todo: ["backlog", "canceled"],
  in_progress: ["canceled"],
  in_review: ["done", "canceled"],
  done: ["in_review"],
  failed: ["todo"],
  blocked: ["todo"],
  paused: ["todo"],
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
