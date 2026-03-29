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
    <div className="p-8 bg-surface-container-low/50 rounded-lg space-y-8">
      {/* Assigned Agent */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
          Assigned Agent
        </p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
            <Icon name="smart_toy" size={20} className="text-secondary" />
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface">
              {task.assignedAgent.name}
            </p>
            <p className="text-xs text-on-surface-variant">
              {task.assignedAgent.role}
            </p>
          </div>
        </div>
      </div>

      {/* Workspace */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
          Workspace
        </p>
        <div className="flex items-center gap-2 text-on-surface">
          <Icon name="layers" size={18} className="text-on-surface-variant" />
          <p className="text-sm font-medium">{task.workspace}</p>
        </div>
      </div>

      {/* Priority */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
          Priority
        </p>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${priorityDot[task.priorityColor]}`}
          />
          <p className="text-sm font-medium text-on-surface">{task.priority}</p>
        </div>
      </div>

      {/* Deadline */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
          Deadline
        </p>
        <div className="flex items-center gap-2 text-on-surface">
          <Icon
            name="calendar_today"
            size={18}
            className="text-on-surface-variant"
          />
          <p className="text-sm font-medium">{task.deadline}</p>
        </div>
      </div>
    </div>
  );
}
