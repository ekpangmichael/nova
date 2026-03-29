import { HeroStats } from "@/components/dashboard/hero-stats";
import { AgentCard } from "@/components/dashboard/agent-card";
import { IdleAgentRow } from "@/components/dashboard/idle-agent-row";
import { ScheduledAgentRow } from "@/components/dashboard/scheduled-agent-row";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { CriticalErrorCard } from "@/components/dashboard/critical-error-card";
import { FAB } from "@/components/dashboard/fab";
import {
  heroStats,
  workingAgents,
  idleAgents,
  scheduledAgents,
  activityFeed,
  criticalErrors,
} from "@/lib/mock-data";

export default function DashboardPage() {
  return (
    <>
      {/* Hero Stats */}
      <HeroStats stats={heroStats} />

      {/* Currently Working */}
      <section className="mb-12 anim-2">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="w-1 h-5 bg-tertiary rounded-full glow-green" />
            <h2 className="text-[13px] font-bold tracking-tight uppercase text-on-surface">
              Currently Working
            </h2>
            <span className="font-mono text-[9px] px-2 py-0.5 text-tertiary bg-tertiary/[0.06] rounded-full">
              {workingAgents.length} Active
            </span>
          </div>
          <button className="text-[10px] font-mono text-on-surface-variant/25 hover:text-on-surface-variant/50 transition-colors uppercase tracking-wider">
            View All
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {workingAgents.map((agent) => (
            <AgentCard key={agent.agentId} agent={agent} />
          ))}
        </div>
      </section>

      {/* Idle + Scheduled */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 anim-3">
        {/* Idle */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-1 h-5 bg-secondary rounded-full" />
            <h2 className="text-[13px] font-bold tracking-tight uppercase text-on-surface">
              Idle
            </h2>
            <span className="font-mono text-[9px] text-on-surface-variant/30">
              {idleAgents.length} Standby
            </span>
          </div>
          <div className="space-y-1.5">
            {idleAgents.map((agent) => (
              <IdleAgentRow key={agent.agentId} agent={agent} />
            ))}
          </div>
        </section>

        {/* Scheduled */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-1 h-5 bg-primary/40 rounded-full" />
            <h2 className="text-[13px] font-bold tracking-tight uppercase text-on-surface">
              Scheduled
            </h2>
            <span className="font-mono text-[9px] text-on-surface-variant/30">
              {scheduledAgents.length} Queued
            </span>
          </div>
          <div className="space-y-1.5">
            {scheduledAgents.map((agent) => (
              <ScheduledAgentRow key={agent.agentId} agent={agent} />
            ))}
          </div>
        </section>
      </div>

      {/* Activity Feed */}
      <ActivityFeed events={activityFeed} />

      {/* Critical Errors */}
      <section className="anim-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-1 h-5 bg-error rounded-full glow-red" />
          <h2 className="text-[13px] font-bold tracking-tight uppercase text-on-surface">
            Critical Errors
          </h2>
          <span className="font-mono text-[9px] text-error/70">
            {criticalErrors.length} Requiring Action
          </span>
        </div>
        {criticalErrors.map((error) => (
          <CriticalErrorCard key={error.code} error={error} />
        ))}
      </section>

      {/* FAB */}
      <FAB />
    </>
  );
}
