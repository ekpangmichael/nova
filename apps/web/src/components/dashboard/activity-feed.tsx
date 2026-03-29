import type { ActivityEvent } from "@/types";

const dotColors: Record<ActivityEvent["status"], string> = {
  working: "bg-tertiary",
  idle: "bg-secondary/50",
  error: "bg-error",
  scheduled: "bg-on-surface-variant/20",
  neutral: "bg-tertiary/50",
};

const agentColors: Record<ActivityEvent["status"], string> = {
  working: "text-tertiary/50",
  idle: "text-secondary/40",
  error: "text-error/50",
  scheduled: "text-primary/30",
  neutral: "text-on-surface-variant/40",
};

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <section className="mb-12 anim-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="w-1 h-5 bg-on-surface-variant/20 rounded-full" />
          <h2 className="text-[13px] font-bold tracking-tight uppercase text-on-surface">
            Activity Feed
          </h2>
        </div>
        <button className="text-[10px] font-mono text-on-surface-variant/25 hover:text-on-surface-variant/50 transition-colors uppercase tracking-wider">
          Full Log
        </button>
      </div>

      <div className="bg-surface-container-lowest/40 rounded-lg overflow-hidden ghost">
        <div className="divide-y divide-outline-variant/[0.04]">
          {events.map((event, i) => (
            <div
              key={`${event.timestamp}-${i}`}
              className="flex items-center gap-4 px-5 py-3 hover:bg-surface-container/20 transition-colors"
            >
              <div
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[event.status]} ${event.status === "working" && i === 0 ? "pulse-green" : ""}`}
              />
              <span className="font-mono text-[9px] text-outline/35 shrink-0 w-14 tabular-nums">
                {event.timestamp}
              </span>
              <span className="text-[11px] text-on-surface-variant/60">
                <span className={`font-mono ${agentColors[event.status]}`}>
                  {event.agentId}
                </span>{" "}
                {event.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
