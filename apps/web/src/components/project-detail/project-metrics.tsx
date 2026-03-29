"use client";

import { useAnimatedCounter } from "@/hooks/use-animated-counter";
import { Icon } from "@/components/ui/icon";
import type { ProjectDetail } from "@/types";

export function ProjectMetrics({
  metrics,
}: {
  metrics: ProjectDetail["metrics"];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-10 anim-2">
      <AgentsMetric
        current={metrics.activeAgents.current}
        max={metrics.activeAgents.max}
      />
      <TasksMetric
        openTasks={metrics.openTasks}
        trend={metrics.taskTrend}
      />
      <CompletedMetric
        count={metrics.completedTasks7d}
        chart={metrics.completedChart}
      />
      <CostMetric
        total={metrics.tokenCost.total}
        dailyAvg={metrics.tokenCost.dailyAvg}
      />
    </div>
  );
}

function AgentsMetric({ current, max }: { current: number; max: number }) {
  const display = useAnimatedCounter(current);
  const pct = max > 0 ? Math.round((current / max) * 100) : 0;

  return (
    <div className="bg-surface-container-low p-5 ghost">
      <div className="flex justify-between items-start mb-3">
        <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest">
          Active Agents
        </p>
        <Icon name="smart_toy" size={18} className="text-secondary/50" />
      </div>
      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="text-3xl font-black tracking-tight text-on-surface">
          {display}
        </span>
        <span className="text-on-surface-variant/40 font-bold">/ {max}</span>
        <span className="font-mono text-[9px] text-on-surface-variant/40 ml-1">
          {pct}% CAP
        </span>
      </div>
      <div className="h-1 bg-surface-variant w-full overflow-hidden rounded-full">
        <div
          className="h-full bg-secondary rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TasksMetric({
  openTasks,
  trend,
}: {
  openTasks: number;
  trend: number;
}) {
  const display = useAnimatedCounter(openTasks);
  const isUp = trend > 0;

  return (
    <div className="bg-surface-container-low p-5 ghost">
      <div className="flex justify-between items-start mb-3">
        <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest">
          Open Tasks
        </p>
        <Icon name="assignment" size={18} className="text-tertiary/50" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black tracking-tight text-on-surface">
          {display}
        </span>
        {trend !== 0 && (
          <span
            className={`font-mono text-[10px] ${isUp ? "text-tertiary/70" : "text-error/70"}`}
          >
            {isUp ? "+" : ""}
            {trend}% Trend
          </span>
        )}
      </div>
      <p className="font-mono text-[8px] text-on-surface-variant/30 mt-1 uppercase">
        Load factor {isUp ? "increasing" : "decreasing"}
      </p>
    </div>
  );
}

function CompletedMetric({
  count,
  chart,
}: {
  count: number;
  chart: number[];
}) {
  const display = useAnimatedCounter(count);
  const maxVal = Math.max(...chart, 1);

  return (
    <div className="bg-surface-container-low p-5 ghost">
      <div className="flex justify-between items-start mb-3">
        <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest">
          Completed 7D
        </p>
        <Icon name="check_circle" size={18} className="text-tertiary/50" />
      </div>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-black tracking-tight text-on-surface">
          {display}
        </span>
        {/* Mini bar chart */}
        <div className="flex items-end gap-[3px] h-8">
          {chart.map((v, i) => (
            <div
              key={i}
              className="w-[5px] bg-on-surface-variant/20 rounded-sm"
              style={{ height: `${Math.max((v / maxVal) * 100, 8)}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CostMetric({
  total,
  dailyAvg,
}: {
  total: number;
  dailyAvg: number;
}) {
  return (
    <div className="bg-surface-container-low p-5 ghost">
      <div className="flex justify-between items-start mb-3">
        <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest">
          Est. Token Cost
        </p>
        <Icon name="payments" size={18} className="text-error/50" />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-black tracking-tight text-on-surface">
          ${total.toFixed(2)}
        </span>
      </div>
      <p className="font-mono text-[9px] text-on-surface-variant/40 mt-1">
        Daily Avg{" "}
        <span className="text-on-surface-variant/60">${dailyAvg.toFixed(2)}</span>
      </p>
    </div>
  );
}
