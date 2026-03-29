import type { TaskDetail } from "@/types";

const statusDot: Record<TaskDetail["status"], string> = {
  backlog: "bg-outline",
  todo: "bg-secondary",
  in_progress: "bg-primary animate-pulse",
  in_review: "bg-tertiary",
  done: "bg-tertiary",
};

export function TaskHeader({ task }: { task: TaskDetail }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono tracking-wider bg-surface-container-high text-secondary ghost uppercase">
          {task.id}
        </span>
        <span className={`w-1.5 h-1.5 rounded-full ${statusDot[task.status]}`} />
        <span className="text-[11px] uppercase tracking-[0.15em] text-on-surface-variant font-medium">
          {task.statusLabel}
        </span>
      </div>
      <h2 className="text-4xl font-extrabold text-on-surface tracking-tighter leading-[1.1]">
        {task.title}
      </h2>
    </div>
  );
}
