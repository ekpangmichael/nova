import type { TaskDetail } from "@/types";

const statusDot: Record<TaskDetail["status"], string> = {
  backlog: "bg-outline",
  todo: "bg-secondary",
  in_progress: "bg-primary animate-pulse",
  in_review: "bg-tertiary",
  done: "bg-tertiary",
  blocked: "bg-primary",
  paused: "bg-outline",
  failed: "bg-error",
  canceled: "bg-outline-variant",
};

export function TaskHeader({ task }: { task: TaskDetail }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2.5">
        <span className="rounded-md bg-surface-container-high/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-secondary">
          {task.id}
        </span>
        <div className={`h-1.5 w-1.5 rounded-full ${statusDot[task.status]}`} />
        <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/50">
          {task.statusLabel}
        </span>
      </div>
      <h2 className="text-xl font-bold tracking-[-0.02em] text-on-surface">
        {task.title}
      </h2>
    </div>
  );
}
