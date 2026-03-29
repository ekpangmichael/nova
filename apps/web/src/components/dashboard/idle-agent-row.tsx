import { Icon } from "@/components/ui/icon";
import type { IdleAgent } from "@/types";

export function IdleAgentRow({ agent }: { agent: IdleAgent }) {
  return (
    <div className="bg-surface-container-low/60 p-3.5 flex items-center justify-between border-l-2 border-secondary/15 hover:bg-surface-container/30 transition-colors rounded-r">
      <div className="flex items-center gap-3.5">
        <Icon name="snooze" size={16} className="text-secondary/30" />
        <div>
          <p className="text-[12px] font-semibold text-on-surface/70">
            {agent.name}
          </p>
          <p className="font-mono text-[8px] text-outline/30 mt-0.5">
            {agent.agentId}
          </p>
        </div>
      </div>
      <span className="font-mono text-[8px] text-secondary/40 uppercase tracking-wider">
        {agent.statusText}
      </span>
    </div>
  );
}
