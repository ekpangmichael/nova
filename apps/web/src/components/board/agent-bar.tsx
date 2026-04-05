import type { BoardAgent } from "@/types";

const dotColors: Record<BoardAgent["status"], string> = {
  working: "bg-tertiary animate-pulse shadow-[0_0_8px_#d1ffd7]",
  idle: "bg-secondary shadow-[0_0_6px_rgba(123,153,255,0.3)]",
  error: "bg-error shadow-[0_0_6px_rgba(238,125,119,0.3)]",
};

const nameColors: Record<BoardAgent["status"], string> = {
  working: "text-tertiary",
  idle: "text-secondary/60",
  error: "text-error",
};

const activityColors: Record<BoardAgent["status"], string> = {
  working: "text-on-surface-variant/40",
  idle: "text-on-surface-variant/25",
  error: "text-error/50",
};

export function AgentBar({ agents }: { agents: BoardAgent[] }) {
  if (agents.length === 0) return null;

  return (
    <div className="flex items-center px-5 py-3">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[9px] uppercase tracking-wider text-on-surface-variant/30">
          Agents
        </span>
        <div className="flex items-center gap-2">
          {agents.map((agent) => (
            <div
              key={agent.name}
              className="flex items-center gap-2 rounded-md bg-surface-container-lowest/40 px-2.5 py-1"
            >
              <div className={`h-1.5 w-1.5 rounded-full ${dotColors[agent.status]}`} />
              <span className={`font-mono text-[10px] ${nameColors[agent.status]}`}>
                {agent.name}
              </span>
              <span className={`font-mono text-[9px] ${activityColors[agent.status]}`}>
                {agent.activity}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
