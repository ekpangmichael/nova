import { Icon } from "@/components/ui/icon";
import type { ExecutionLogItem } from "@/types";

export function TaskExecutionLog({ log }: { log: ExecutionLogItem[] }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-[10px] uppercase tracking-widest text-on-surface-variant/50 font-bold">
          Execution Log
        </h3>
        <button className="text-[10px] uppercase tracking-widest text-secondary/80 hover:text-secondary transition-colors">
          View All
        </button>
      </div>
      <div className="space-y-4 relative before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-outline-variant/15">
        {log.map((item, i) => (
          <div key={i} className="relative pl-7">
            <div className="absolute left-0 top-1 w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center ring-3 ring-surface">
              <Icon name={item.icon} size={10} className="text-on-surface-variant" />
            </div>
            <p className="text-xs text-on-surface-variant leading-tight">
              <span className="text-on-surface font-medium">{item.title}</span>{" "}
              {item.description}
            </p>
            <p className="text-[10px] text-outline-variant mt-1">
              {item.timeAgo}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
