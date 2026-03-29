import { Icon } from "@/components/ui/icon";
import type { RegisteredAgent } from "@/types";

const statusConfig: Record<
  RegisteredAgent["status"],
  { label: string; dot: string; text: string; bg: string }
> = {
  working: { label: "Working", dot: "bg-tertiary pulse-green", text: "text-tertiary", bg: "bg-tertiary/10" },
  idle: { label: "Idle", dot: "bg-secondary/50", text: "text-secondary", bg: "bg-secondary/10" },
  error: { label: "Error", dot: "bg-error", text: "text-error", bg: "bg-error/10" },
  offline: { label: "Offline", dot: "bg-outline/40", text: "text-outline", bg: "bg-outline/5" },
};

export function AgentTable({ agents }: { agents: RegisteredAgent[] }) {
  return (
    <div className="anim-3">
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-5 py-3 text-[9px] font-mono text-on-surface-variant/40 uppercase tracking-widest">
        <div className="col-span-3">Agent</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-1">Load</div>
        <div className="col-span-2">Project</div>
        <div className="col-span-1">Uptime</div>
        <div className="col-span-1">Tasks</div>
        <div className="col-span-2">Model</div>
      </div>

      {/* Rows */}
      <div className="space-y-1.5">
        {agents.map((agent) => (
          <AgentRow key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}

function AgentRow({ agent }: { agent: RegisteredAgent }) {
  const config = statusConfig[agent.status];

  return (
    <div className="grid grid-cols-12 gap-4 px-5 py-4 bg-surface-container/50 hover:bg-surface-container-high/60 transition-colors items-center group cursor-pointer">
      {/* Agent name + role */}
      <div className="col-span-3 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 ${config.bg}`}>
          <Icon name="smart_toy" size={18} className={config.text} />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[13px] font-bold text-on-surface truncate group-hover:text-secondary transition-colors">
            {agent.name}
          </p>
          <p className="text-[9px] text-on-surface-variant/40 truncate uppercase tracking-widest">
            {agent.role}
          </p>
        </div>
      </div>

      {/* Status */}
      <div className="col-span-2">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg} ${config.text} font-mono text-[9px] font-bold uppercase`}>
          <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
          {config.label}
        </span>
      </div>

      {/* Load */}
      <div className="col-span-1">
        <span className={`font-mono text-xs ${agent.status === "error" ? "text-error" : "text-on-surface"}`}>
          {agent.load}
        </span>
      </div>

      {/* Project */}
      <div className="col-span-2">
        <span className="text-xs text-on-surface-variant truncate block">
          {agent.assignedProject ?? <span className="text-outline/40 italic">Unassigned</span>}
        </span>
      </div>

      {/* Uptime */}
      <div className="col-span-1">
        <span className="font-mono text-[10px] text-on-surface-variant/60">
          {agent.uptime}
        </span>
      </div>

      {/* Tasks */}
      <div className="col-span-1">
        <span className="font-mono text-xs text-on-surface">
          {agent.tasksCompleted.toLocaleString()}
        </span>
      </div>

      {/* Model */}
      <div className="col-span-2 flex items-center justify-between">
        <span className="font-mono text-[10px] text-on-surface-variant/50 truncate">
          {agent.model}
        </span>
        <button className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant/30 hover:text-on-surface-variant">
          <Icon name="more_vert" size={16} />
        </button>
      </div>
    </div>
  );
}
