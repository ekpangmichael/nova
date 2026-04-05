import { Icon } from "@/components/ui/icon";
import type { ProjectAgent } from "@/types";

const statusConfig: Record<
  ProjectAgent["status"],
  { label: string; bg: string; text: string; dot: string }
> = {
  working: {
    label: "Working",
    bg: "bg-tertiary/10",
    text: "text-tertiary",
    dot: "bg-tertiary pulse-green",
  },
  idle: {
    label: "Idle",
    bg: "bg-secondary/10",
    text: "text-secondary",
    dot: "bg-secondary/50",
  },
  error: {
    label: "Error",
    bg: "bg-error/10",
    text: "text-error",
    dot: "bg-error",
  },
};

const iconBg: Record<ProjectAgent["status"], string> = {
  working: "bg-tertiary/10 text-tertiary",
  idle: "bg-secondary/10 text-secondary/50",
  error: "bg-error/10 text-error",
};

export function ProjectAgentsList({ agents }: { agents: ProjectAgent[] }) {
  return (
    <section className="anim-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[11px] font-bold tracking-widest uppercase text-on-surface">
          Assigned Agents
        </h3>
        <span className="font-mono text-[9px] text-on-surface-variant/40 uppercase">
          Total: {String(agents.length).padStart(2, "0")} Active
        </span>
      </div>
      <div className="space-y-2">
        {agents.map((agent) => (
          <AgentRow key={agent.agentId} agent={agent} />
        ))}
      </div>
    </section>
  );
}

function AgentRow({ agent }: { agent: ProjectAgent }) {
  const config = statusConfig[agent.status];

  return (
    <div className="bg-surface-container p-4 flex items-center justify-between ghost hover:bg-surface-container-high/60 transition-colors">
      <div className="flex items-center gap-3.5">
        <div
          className={`w-9 h-9 rounded-sm flex items-center justify-center ${iconBg[agent.status]}`}
        >
          <Icon name="smart_toy" size={18} />
        </div>
        <div>
          <p className="font-mono text-[13px] font-bold text-on-surface">
            {agent.name}
          </p>
          <p className="font-mono text-[9px] text-on-surface-variant/40 uppercase tracking-widest">
            {agent.role}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-mono text-[9px] text-on-surface-variant/40 uppercase">
            Load
          </p>
          <p
            className={`font-mono text-xs font-bold ${agent.status === "error" ? "text-error" : "text-on-surface"}`}
          >
            {agent.load}
          </p>
        </div>
        <span
          className={`${config.bg} ${config.text} font-mono text-[9px] font-bold uppercase px-2.5 py-1 rounded-full flex items-center gap-1.5`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
          {config.label}
        </span>
        <button className="text-on-surface-variant/30 hover:text-on-surface-variant transition-colors">
          <Icon name="more_vert" size={16} />
        </button>
      </div>
    </div>
  );
}
