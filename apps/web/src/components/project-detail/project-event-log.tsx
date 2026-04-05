import { Icon } from "@/components/ui/icon";
import type { ProjectEvent } from "@/types";

const typeConfig: Record<
  ProjectEvent["type"],
  { icon: string; color: string; dotColor: string }
> = {
  task_completed: {
    icon: "check_circle",
    color: "text-tertiary",
    dotColor: "bg-tertiary",
  },
  handoff: {
    icon: "sync_alt",
    color: "text-secondary",
    dotColor: "bg-secondary",
  },
  anomaly: {
    icon: "warning",
    color: "text-error",
    dotColor: "bg-error",
  },
  routine: {
    icon: "schedule",
    color: "text-on-surface-variant/50",
    dotColor: "bg-on-surface-variant/40",
  },
};

export function ProjectEventLog({ events }: { events: ProjectEvent[] }) {
  return (
    <div className="anim-3">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[11px] font-bold tracking-widest uppercase text-on-surface">
          Event Logs
        </h3>
        <span className="font-mono text-[9px] ghost px-2 py-0.5 text-on-surface-variant/50">
          Live
        </span>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[11px] top-4 bottom-4 w-px bg-outline-variant/10" />

        <div className="space-y-6">
          {events.map((event, i) => {
            const config = typeConfig[event.type];
            return (
              <div key={i} className="relative pl-9">
                {/* Timeline dot */}
                <div
                  className={`absolute left-0 top-1 w-[22px] h-[22px] rounded-full flex items-center justify-center bg-surface-container-low`}
                >
                  <Icon
                    name={config.icon}
                    size={14}
                    className={config.color}
                  />
                </div>

                <p className="font-mono text-[9px] text-on-surface-variant/35 mb-0.5">
                  {event.timestamp}
                </p>
                <p
                  className={`text-[12px] font-bold uppercase tracking-wide mb-1 ${event.type === "anomaly" ? "text-error" : "text-on-surface/80"}`}
                >
                  {event.title}
                </p>
                <p className="font-mono text-[10px] text-on-surface-variant/50 leading-relaxed">
                  {event.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <button className="w-full mt-6 ghost py-2.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 hover:text-on-surface-variant/70 hover:bg-surface-container/30 transition-all rounded-sm">
        View All Logs
      </button>
    </div>
  );
}
