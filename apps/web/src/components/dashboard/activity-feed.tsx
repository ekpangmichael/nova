import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { ActivityEvent } from "@/types";

const iconMap: Record<ActivityEvent["status"], { name: string; color: string }> = {
  working: { name: "play_circle", color: "text-tertiary" },
  idle: { name: "pause_circle", color: "text-secondary/50" },
  error: { name: "error", color: "text-error" },
  scheduled: { name: "schedule", color: "text-primary/40" },
  neutral: { name: "check_circle", color: "text-on-surface-variant/40" },
};

const tagConfig: Record<ActivityEvent["status"], { label: string; className: string }> = {
  working: { label: "Active", className: "bg-tertiary/10 text-tertiary" },
  idle: { label: "Idle", className: "bg-secondary/10 text-secondary/60" },
  error: { label: "Error", className: "bg-error/10 text-error" },
  scheduled: { label: "Queued", className: "bg-primary/10 text-primary/50" },
  neutral: { label: "Update", className: "bg-on-surface-variant/8 text-on-surface-variant/50" },
};

const agentColors: Record<ActivityEvent["status"], string> = {
  working: "text-tertiary/60",
  idle: "text-secondary/40",
  error: "text-error/60",
  scheduled: "text-primary/40",
  neutral: "text-on-surface-variant/50",
};

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <section className="mb-12 anim-4 min-w-0 overflow-hidden">
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
        {events.length > 0 ? (
          <div className="divide-y divide-outline-variant/[0.04] overflow-hidden">
            {events.map((event, i) => {
              const icon = iconMap[event.status];
              const tag = tagConfig[event.status];
              const rowClassName =
                "flex items-center gap-4 px-5 py-3.5 min-w-0 overflow-hidden transition-colors " +
                (event.href
                  ? "hover:bg-surface-container/20 focus-visible:bg-surface-container/20 outline-none"
                  : "hover:bg-surface-container/20");
              const content = (
                <>
                  <Icon
                    name={icon.name}
                    size={16}
                    className={`shrink-0 ${icon.color}`}
                  />
                  <span className="font-mono text-[9px] text-outline/35 shrink-0 w-14 tabular-nums">
                    {event.timestamp}
                  </span>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-sm text-[8px] font-bold uppercase tracking-widest ${tag.className}`}
                  >
                    {tag.label}
                  </span>
                  <span className="text-[11px] text-on-surface-variant/60 min-w-0 truncate">
                    <span className={`font-mono font-medium ${agentColors[event.status]}`}>
                      {event.actorLabel}
                    </span>{" "}
                    {event.message}
                  </span>
                </>
              );

              if (event.href) {
                return (
                  <Link
                    key={event.id ?? `${event.timestamp}-${i}`}
                    href={event.href}
                    className={rowClassName}
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <div
                  key={event.id ?? `${event.timestamp}-${i}`}
                  className={rowClassName}
                >
                  {content}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-8 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-outline/50">
              No recent activity
            </p>
            <p className="mt-3 text-sm text-on-surface-variant/60">
              Recent runs, ticket comments, and agent assignments will appear here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
