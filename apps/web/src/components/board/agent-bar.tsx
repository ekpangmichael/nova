import type { BoardAgent } from "@/types";

const dotColors: Record<BoardAgent["status"], string> = {
  working: "bg-tertiary animate-pulse shadow-[0_0_8px_#d1ffd7]",
  idle: "bg-secondary shadow-[0_0_8px_#7b99ff]",
  error: "bg-error shadow-[0_0_8px_#ee7d77]",
};

const nameColors: Record<BoardAgent["status"], string> = {
  working: "text-tertiary",
  idle: "text-secondary-dim",
  error: "text-error",
};

const activityColors: Record<BoardAgent["status"], string> = {
  working: "text-on-surface-variant/50",
  idle: "text-on-surface-variant/50",
  error: "text-error/60",
};

export function AgentBar({ agents }: { agents: BoardAgent[] }) {
  return (
    <footer className="fixed bottom-0 right-0 h-16 w-[calc(100%-16rem)] bg-surface-container-low ghost-t flex items-center justify-between px-6 z-40">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Active Agents
        </span>
        <div className="flex items-center gap-2">
          {agents.map((agent) => (
            <div
              key={agent.name}
              className="flex items-center gap-2 bg-surface-container-lowest px-2 py-1.5 rounded-sm ghost"
            >
              <div className={`w-2 h-2 rounded-full ${dotColors[agent.status]}`} />
              <span className={`text-[10px] font-mono ${nameColors[agent.status]}`}>
                {agent.name}
              </span>
              <span className={`text-[9px] font-mono ${activityColors[agent.status]}`}>
                {agent.activity}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-[10px] font-mono text-on-surface-variant">
          <span className="w-2 h-2 rounded-full bg-primary/20" />
          <span>SYSTEM STABLE</span>
        </div>
        <button className="bg-primary text-on-primary px-4 py-1.5 rounded-sm text-xs font-bold hover:opacity-80 transition-all active:scale-95 uppercase tracking-tight">
          Invoke Agent
        </button>
      </div>
    </footer>
  );
}
