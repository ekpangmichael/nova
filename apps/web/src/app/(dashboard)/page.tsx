import { HeroStats } from "@/components/dashboard/hero-stats";
import { AgentCard } from "@/components/dashboard/agent-card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { FAB } from "@/components/dashboard/fab";
import { NeedsAttentionCard } from "@/components/dashboard/needs-attention-card";
import {
  getDashboardActivity,
  getDashboardAttention,
  getDashboardStats,
  getDashboardWorkingRuns,
} from "@/lib/api";

export default async function DashboardPage() {
  const [
    dashboardStats,
    dashboardWorkingRuns,
    dashboardActivity,
    dashboardAttention,
  ] = await Promise.all([
    getDashboardStats(),
    getDashboardWorkingRuns(),
    getDashboardActivity(),
    getDashboardAttention(),
  ]);
  const heroStats = [
    {
      label: "Total Projects",
      value: dashboardStats.totalProjectCount,
      unit: `${dashboardStats.activeProjectCount} active`,
      accentColor: "secondary" as const,
    },
    {
      label: "Active Agents",
      value: dashboardStats.activeAgentCount,
      unit: `/ ${dashboardStats.totalAgentCount} deployed`,
      accentColor: "tertiary" as const,
    },
    {
      label: "Open Tasks",
      value: dashboardStats.openTaskCount,
      unit: "across projects",
      accentColor: "on-surface-variant" as const,
    },
    {
      label: "Completed This Week",
      value: dashboardStats.completedThisWeekCount,
      unit: "tasks",
      accentColor: "tertiary" as const,
    },
  ];
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const formatLogTimestamp = (value: string) => timeFormatter.format(new Date(value));
  const workingAgents = dashboardWorkingRuns.map((run) => ({
    agentId: run.runtimeAgentId || run.agentSlug,
    name: run.agentName,
    taskId: run.taskId,
    taskHref: `/projects/${run.projectId}/board/${run.taskId}`,
    taskLabel: `${run.projectName} · TASK-${String(run.taskNumber).padStart(3, "0")} ${run.taskTitle}`,
    statusText: run.status.replace(/_/g, " "),
    progress: null,
    logs: run.logs.map((log) => ({
      timestamp: formatLogTimestamp(log.at),
      message: log.message,
      level: log.level,
    })),
  }));
  const activityEvents = dashboardActivity.map((item) => ({
    id: item.id,
    timestamp: formatLogTimestamp(item.createdAt),
    actorLabel: item.actorLabel,
    message: item.message,
    status: item.status,
    href: item.href,
  }));
  const attentionItems = dashboardAttention.map((item) => ({
    ...item,
    timestamp: formatLogTimestamp(item.createdAt),
  }));

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
        {workingAgents.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {workingAgents.map((agent) => (
              <AgentCard key={agent.taskId} agent={agent} />
            ))}
          </div>
        ) : (
          <div className="ghost rounded-lg border border-outline-variant/[0.08] bg-surface-container-low p-8 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-outline/50">
              No active runs
            </p>
            <p className="mt-3 text-sm text-on-surface-variant/60">
              Agents that are actively working on tasks will appear here with their live runtime logs.
            </p>
          </div>
        )}
      </section>

      {/* Activity Feed */}
      <ActivityFeed events={activityEvents} />

      {/* Needs Attention */}
      <section className="anim-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-1 h-5 bg-error rounded-full glow-red" />
          <h2 className="text-[13px] font-bold tracking-tight uppercase text-on-surface">
            Needs Attention
          </h2>
          <span className="font-mono text-[9px] text-error/70">
            {attentionItems.length} Requiring Action
          </span>
        </div>
        {attentionItems.length > 0 ? (
          attentionItems.map((item) => (
            <NeedsAttentionCard key={`${item.kind}-${item.id}`} item={item} />
          ))
        ) : (
          <div className="ghost rounded-lg border border-outline-variant/[0.08] bg-surface-container-low p-8 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-outline/50">
              No issues requiring action
            </p>
            <p className="mt-3 text-sm text-on-surface-variant/60">
              Failed runs, blocked tasks, and agent faults will appear here when they need operator attention.
            </p>
          </div>
        )}
      </section>

      {/* FAB */}
      <FAB />
    </>
  );
}
