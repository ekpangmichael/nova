import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { MonitoredAgent } from "@/types";

const statusDot: Record<string, string> = {
  active: "bg-secondary shadow-[0_0_8px_rgba(123,153,255,0.4)]",
  syncing: "bg-secondary/40",
  critical: "bg-error",
  patrolling: "bg-secondary shadow-[0_0_8px_rgba(123,153,255,0.4)]",
  idle: "bg-outline/40",
  offline: "bg-outline/20",
};

const statusText: Record<string, string> = {
  active: "text-on-surface-variant",
  syncing: "text-on-surface-variant",
  critical: "text-error/80",
  patrolling: "text-on-surface-variant",
  idle: "text-outline",
  offline: "text-outline",
};

export function AgentMonitorCard({ agent }: { agent: MonitoredAgent }) {
  const isError = agent.isError;

  return (
    <Link
      href={`/agents/${agent.id}`}
      className={`bg-surface-container-low p-10 flex flex-col gap-8 group hover:bg-surface-container-high transition-all duration-500 rounded-lg ${isError ? "border-l-2 border-error/20" : ""}`}
    >
      {/* Header: icon + name + status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 bg-surface-container-lowest flex items-center justify-center ghost group-hover:border-secondary/30 transition-colors ${isError ? "!border-error/10" : ""}`}
          >
            <Icon
              name={agent.icon}
              size={22}
              className={isError ? "text-error/70" : "text-secondary/70"}
            />
          </div>
          <div>
            <h3 className="text-sm font-medium tracking-tight text-on-surface">
              {agent.name}
            </h3>
            <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-tighter">
              ID: {agent.agentCode}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${statusDot[agent.status]}`} />
          <span
            className={`text-[10px] uppercase tracking-widest font-medium ${statusText[agent.status]}`}
          >
            {agent.statusLabel}
          </span>
        </div>
      </div>

      {/* Task description */}
      <div>
        <span
          className={`text-[10px] uppercase tracking-widest block mb-2 ${isError ? "text-error/60" : "text-on-surface-variant"}`}
        >
          {agent.taskLabel}
        </span>
        <p className="text-on-surface font-light">{agent.currentTask}</p>
      </div>

      {/* Progress / metric bar */}
      <div className="mt-auto">
        <div
          className={`flex justify-between text-[10px] font-mono mb-2 ${isError ? "text-error/60" : "text-on-surface-variant"}`}
        >
          <span>{agent.metricLabel}</span>
          <span>{agent.metricValue}</span>
        </div>
        <div className="w-full h-0.5 bg-surface-container-highest">
          <div
            className={`h-full transition-all duration-1000 ${isError ? "bg-error" : "bg-secondary"}`}
            style={{ width: `${Math.min(agent.progress, 100)}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
