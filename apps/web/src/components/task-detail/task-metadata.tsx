import { Icon } from "@/components/ui/icon";
import type { TaskDetail } from "@/types";

const priorityDot: Record<string, string> = {
  error: "bg-error",
  tertiary: "bg-tertiary",
  secondary: "bg-secondary",
  primary: "bg-primary",
  outline: "bg-outline",
};

export function TaskMetadata({ task }: { task: TaskDetail }) {
  return (
    <div className="rounded-xl bg-surface-container-low ghost">
      <div className="divide-y divide-outline-variant/[0.06]">
        {/* Agent */}
        <div className="px-5 py-4">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-on-surface-variant/35">
            Assigned agent
          </p>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/8">
              <Icon name="smart_toy" size={16} className="text-secondary/60" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-on-surface">
                {task.assignedAgent.name}
              </p>
              <p className="truncate text-[11px] text-on-surface-variant/35">
                {task.assignedAgent.role}
              </p>
            </div>
          </div>
        </div>

        {task.handoffAgent ? (
          <div className="px-5 py-4">
            <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-on-surface-variant/35">
              Auto handoff
            </p>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8">
                <Icon name="share" size={16} className="text-primary/60" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-on-surface">
                  {task.handoffAgent.name}
                </p>
                <p className="truncate text-[11px] text-on-surface-variant/35">
                  {task.handoffAgent.role}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Workspace */}
        <div className="px-5 py-4">
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-on-surface-variant/35">
            Workspace
          </p>
          <p
            className="truncate font-mono text-[12px] text-on-surface/60"
            title={task.workspace}
          >
            {task.workspace}
          </p>
        </div>

        <div className="px-5 py-4">
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-on-surface-variant/35">
            Git mode
          </p>
          <p className="text-[12px] text-on-surface/60">
            {task.useGitWorktree ? "Isolated worktree" : "Shared checkout"}
          </p>
        </div>

        {task.branch ? (
          <div className="px-5 py-4">
            <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-on-surface-variant/35">
              Task branch
            </p>
            {task.branch.url ? (
              <a
                href={task.branch.url}
                target="_blank"
                rel="noreferrer"
                className="truncate font-mono text-[12px] text-secondary transition hover:text-secondary/80"
                title={task.branch.url}
              >
                {task.branch.name}
              </a>
            ) : (
              <p
                className="truncate font-mono text-[12px] text-on-surface/60"
                title={task.branch.name}
              >
                {task.branch.name}
              </p>
            )}
          </div>
        ) : null}

        {task.gitWorktreePath ? (
          <div className="px-5 py-4">
            <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-on-surface-variant/35">
              Git worktree
            </p>
            <p
              className="truncate font-mono text-[12px] text-on-surface/60"
              title={task.gitWorktreePath}
            >
              {task.gitWorktreePath}
            </p>
          </div>
        ) : null}

        {/* Priority + Deadline */}
        <div className="flex divide-x divide-outline-variant/[0.06]">
          <div className="flex-1 px-5 py-4">
            <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-on-surface-variant/35">
              Priority
            </p>
            <div className="flex items-center gap-2">
              <div
                className={`h-1.5 w-1.5 rounded-full ${priorityDot[task.priorityColor]}`}
              />
              <span className="text-[13px] font-medium text-on-surface">
                {task.priority}
              </span>
            </div>
          </div>
          <div className="flex-1 px-5 py-4">
            <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-on-surface-variant/35">
              Deadline
            </p>
            <span className="text-[13px] font-medium text-on-surface">
              {task.deadline}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
