import { Icon } from "@/components/ui/icon";
import { TaskCard } from "./task-card";
import type { BoardColumn } from "@/types";

const countBg: Record<BoardColumn["accentColor"], string> = {
  "outline-variant": "bg-surface-container-high text-primary",
  secondary: "bg-surface-container-high text-primary",
  tertiary: "bg-tertiary-container/20 text-tertiary",
  primary: "bg-surface-container-high text-primary",
};

export function KanbanColumn({ column }: { column: BoardColumn }) {
  return (
    <section
      className={`min-w-[248px] max-w-[248px] flex flex-col gap-4 ${column.dimmed ? "opacity-70 hover:opacity-100 transition-opacity" : ""}`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            {column.title}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${countBg[column.accentColor]}`}
          >
            {String(column.count).padStart(2, "0")}
          </span>
        </div>
        {column.id === "backlog" && (
          <button className="text-on-surface-variant hover:text-on-surface transition-colors">
            <Icon name="add" size={16} />
          </button>
        )}
      </div>

      {/* Task Cards */}
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto scrollbar-thin pr-2">
        {column.tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            accentColor={column.accentColor}
            isDone={column.dimmed}
          />
        ))}
      </div>
    </section>
  );
}
