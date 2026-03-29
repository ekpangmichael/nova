import Link from "next/link";
import { AgentMonitorCard } from "@/components/agents/agent-monitor-card";

import { monitoredAgents } from "@/lib/mock-data";

export default function AgentsPage() {
  const activeCount = monitoredAgents.filter(
    (a) => a.status === "active" || a.status === "syncing" || a.status === "patrolling"
  ).length;

  return (
    <>
      {/* Header */}
      <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6 anim-1">
        <div>
          <h2 className="text-3xl font-extralight tracking-tight text-on-surface mb-2">
            Agent Monitoring
          </h2>
          <p className="text-on-surface-variant max-w-md font-light leading-relaxed">
            Observing active neural pathways. Currently overseeing{" "}
            <span className="text-secondary font-medium">
              {activeCount} active entities
            </span>{" "}
            across secondary clusters.
          </p>
        </div>
        <div className="flex gap-4">
          <button className="px-6 py-2 bg-surface-container-high text-on-surface text-xs tracking-widest uppercase hover:bg-surface-bright transition-all">
            Filter By Task
          </button>
          <Link
            href="/agents/new"
            className="bg-primary text-on-primary font-bold px-6 py-2 rounded-sm text-xs tracking-widest uppercase hover:opacity-80 transition-all active:scale-95"
          >
            Deploy New Agent
          </Link>
        </div>
      </div>

      {/* Bento Monitoring Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 anim-2">
        {/* First 3 agent cards */}
        {monitoredAgents.slice(0, 3).map((agent) => (
          <AgentMonitorCard key={agent.id} agent={agent} />
        ))}

        {/* Remaining agent cards */}
        {monitoredAgents.slice(3).map((agent) => (
          <AgentMonitorCard key={agent.id} agent={agent} />
        ))}
      </div>

      {/* Footer System Meta */}
      <footer className="mt-24 pt-12 ghost-t flex flex-col md:flex-row justify-between items-center gap-8 anim-3">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-[0.2em] text-on-surface-variant mb-1">
              Last Kernel Update
            </span>
            <span className="text-xs font-mono text-on-surface">
              2024-05-24 04:12:01 UTC
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-[0.2em] text-on-surface-variant mb-1">
              System Load
            </span>
            <span className="text-xs font-mono text-on-surface">
              0.42 / 1.00
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
