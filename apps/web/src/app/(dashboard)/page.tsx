import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { AgentCard } from "@/components/dashboard/agent-card";
import { NeedsAttentionCard } from "@/components/dashboard/needs-attention-card";
import { formatTimestampForDisplay } from "@/lib/display-preferences";
import { getServerDisplayPreferences } from "@/lib/display-preferences.server";
import {
  getDashboardActivity,
  getDashboardAttention,
  getDashboardStats,
  getDashboardWorkingRuns,
} from "@/lib/api";

const activityIcon: Record<string, { name: string; color: string }> = {
  working: { name: "play_circle", color: "text-tertiary" },
  idle: { name: "pause_circle", color: "text-secondary/50" },
  error: { name: "error", color: "text-error" },
  scheduled: { name: "schedule", color: "text-primary/40" },
  neutral: { name: "check_circle", color: "text-on-surface-variant/40" },
};

const activityTag: Record<string, { label: string; className: string }> = {
  working: { label: "Active", className: "bg-tertiary/10 text-tertiary" },
  idle: { label: "Idle", className: "bg-secondary/10 text-secondary/60" },
  error: { label: "Error", className: "bg-error/10 text-error" },
  scheduled: { label: "Queued", className: "bg-primary/10 text-primary/50" },
  neutral: {
    label: "Update",
    className: "bg-on-surface-variant/8 text-on-surface-variant/50",
  },
};

export default async function DashboardPage() {
  const displayPreferences = await getServerDisplayPreferences();
  const [stats, workingRuns, activity, attention] = await Promise.all([
    getDashboardStats(),
    getDashboardWorkingRuns(),
    getDashboardActivity(),
    getDashboardAttention(),
  ]);

  const fmt = (value: string) =>
    formatTimestampForDisplay(value, displayPreferences, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

  const workingAgents = workingRuns.map((run) => ({
    agentId: run.runtimeAgentId || run.agentSlug,
    name: run.agentName,
    taskId: run.taskId,
    taskHref: `/projects/${run.projectId}/board/${run.taskId}`,
    taskLabel: `${run.projectName} · TASK-${String(run.taskNumber).padStart(3, "0")} ${run.taskTitle}`,
    statusText: run.status.replace(/_/g, " "),
    progress: null,
    logs: run.logs.map((log) => ({
      timestamp: fmt(log.at),
      message: log.message,
      level: log.level,
    })),
  }));

  const attentionItems = attention.map((item) => ({
    ...item,
    timestamp: fmt(item.createdAt),
  }));

  return (
    <div className="h-full overflow-y-auto pr-2 scrollbar-thin">
      <div className="mx-auto max-w-4xl pb-16">
        {/* Header */}
        <div className="mb-10 anim-1">
          <div className="flex items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl font-bold tracking-[-0.03em] text-on-surface">
                Dashboard
              </h1>
              <p className="mt-1.5 text-[13px] text-on-surface-variant/40">
                Your projects, agents, and tasks at a glance.
              </p>
            </div>
            <Link
              href="/tasks/new"
              className="flex items-center gap-2 rounded-md bg-secondary/15 px-4 py-2.5 text-[12px] font-semibold text-secondary transition-colors hover:bg-secondary/20"
            >
              <Icon name="add" size={16} />
              New task
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-10 grid grid-cols-4 gap-3 anim-2">
          {[
            {
              label: "Projects",
              value: stats.totalProjectCount,
              sub: `${stats.activeProjectCount} active`,
              tone: "text-on-surface",
            },
            {
              label: "Agents",
              value: stats.activeAgentCount,
              sub: `of ${stats.totalAgentCount}`,
              tone: "text-tertiary",
            },
            {
              label: "Open tasks",
              value: stats.openTaskCount,
              sub: null,
              tone: "text-secondary",
            },
            {
              label: "Done this week",
              value: stats.completedThisWeekCount,
              sub: null,
              tone: "text-tertiary",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl bg-surface-container-low px-5 py-4 ghost"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
                {s.label}
              </p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className={`text-2xl font-semibold ${s.tone}`}>
                  {s.value}
                </span>
                {s.sub && (
                  <span className="font-mono text-[10px] text-on-surface-variant/25">
                    {s.sub}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Currently working */}
        <section className="mb-10 anim-3">
          <div className="mb-4 flex items-center gap-3">
            <span className="h-4 w-0.5 rounded-full bg-tertiary" />
            <h2 className="text-[13px] font-semibold tracking-tight text-on-surface">
              Currently working
            </h2>
            {workingAgents.length > 0 && (
              <span className="rounded-full bg-tertiary/8 px-2 py-0.5 font-mono text-[9px] text-tertiary">
                {workingAgents.length} active
              </span>
            )}
          </div>

          {workingAgents.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {workingAgents.map((agent) => (
                <AgentCard key={agent.taskId} agent={agent} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-surface-container-low ghost p-8 text-center">
              <Icon
                name="play_circle"
                size={28}
                className="mx-auto mb-2 text-on-surface-variant/15"
              />
              <p className="text-[13px] text-on-surface-variant/35">
                No agents are currently running.
              </p>
            </div>
          )}
        </section>

        {/* Needs attention — only visible when there are issues */}
        {attentionItems.length > 0 && (
          <section className="mb-10 anim-4">
            <div className="mb-4 flex items-center gap-3">
              <span className="h-4 w-0.5 rounded-full bg-error" />
              <h2 className="text-[13px] font-semibold tracking-tight text-on-surface">
                Needs attention
              </h2>
              <span className="font-mono text-[9px] text-error/60">
                {attentionItems.length} issue{attentionItems.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="space-y-2">
              {attentionItems.map((item) => (
                <NeedsAttentionCard
                  key={`${item.kind}-${item.id}`}
                  item={item}
                />
              ))}
            </div>
          </section>
        )}

        {/* Activity feed */}
        <section className="anim-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="h-4 w-0.5 rounded-full bg-on-surface-variant/20" />
            <h2 className="text-[13px] font-semibold tracking-tight text-on-surface">
              Recent activity
            </h2>
          </div>

          {activity.length > 0 ? (
            <div className="overflow-hidden rounded-xl bg-surface-container-low ghost">
              <div className="divide-y divide-outline-variant/[0.06]">
                {activity.map((event, i) => {
                  const icon =
                    activityIcon[event.status] ?? activityIcon.neutral;
                  const tag = activityTag[event.status] ?? activityTag.neutral;
                  const inner = (
                    <div className="flex items-center gap-3 px-4 py-3 min-w-0">
                      <Icon
                        name={icon.name}
                        size={15}
                        className={`shrink-0 ${icon.color}`}
                      />
                      <span className="shrink-0 flex items-center gap-1.5 whitespace-nowrap w-[88px]">
                        <Icon name="schedule" size={11} className="text-on-surface-variant/15 shrink-0" />
                        <span className="font-mono text-[10px] text-on-surface-variant/30 tabular-nums lowercase tracking-wide">
                          {fmt(event.createdAt)}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest ${tag.className}`}
                      >
                        {tag.label}
                      </span>
                      <span className="min-w-0 truncate text-[11px] text-on-surface-variant/50">
                        <span className="font-medium text-on-surface-variant/60">
                          {event.actorLabel}
                        </span>{" "}
                        {event.message}
                      </span>
                    </div>
                  );

                  return event.href ? (
                    <Link
                      key={event.id ?? `${event.createdAt}-${i}`}
                      href={event.href}
                      className="block transition-colors hover:bg-surface-container-high/30"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div key={event.id ?? `${event.createdAt}-${i}`}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-surface-container-low ghost p-8 text-center">
              <Icon
                name="history"
                size={28}
                className="mx-auto mb-2 text-on-surface-variant/15"
              />
              <p className="text-[13px] text-on-surface-variant/35">
                No recent activity.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
