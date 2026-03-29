import { Icon } from "@/components/ui/icon";
import type { ScheduledAgent } from "@/types";

export function ScheduledAgentRow({ agent }: { agent: ScheduledAgent }) {
  return (
    <div className="bg-surface-container-low/60 p-3.5 flex items-center justify-between border-l-2 border-primary/10 hover:bg-surface-container/30 transition-colors rounded-r">
      <div className="flex items-center gap-3.5">
        <Icon
          name="calendar_today"
          size={16}
          className="text-on-surface-variant/25"
        />
        <div>
          <p className="text-[12px] font-semibold text-on-surface/70">
            {agent.name}
          </p>
          <p className="font-mono text-[8px] text-outline/30 mt-0.5">
            {agent.agentId}
          </p>
        </div>
      </div>
      <span className="font-mono text-[8px] text-on-surface-variant/90 uppercase tracking-wider">
        Starting in {agent.timeUntilStart}
      </span>
    </div>
  );
}
