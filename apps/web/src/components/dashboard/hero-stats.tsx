"use client";

import { useAnimatedCounter } from "@/hooks/use-animated-counter";
import type { HeroStat } from "@/types";

const unitColorMap: Record<string, string> = {
  tertiary: "text-tertiary/60",
  secondary: "text-secondary/60",
  "on-surface-variant": "text-on-surface-variant/35",
};

export function HeroStats({ stats }: { stats: HeroStat[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12 anim-1">
      {stats.map((stat) => (
        <StatCard key={stat.label} stat={stat} />
      ))}
    </div>
  );
}

function StatCard({ stat }: { stat: HeroStat }) {
  const display = useAnimatedCounter(stat.value, {
    decimals: stat.decimals,
  });

  const unitColor = stat.accentColor
    ? unitColorMap[stat.accentColor] ?? "text-on-surface-variant/35"
    : "text-on-surface-variant/35";

  return (
    <div className="flex flex-col">
      <span className="text-[8px] font-mono text-outline/50 uppercase tracking-[0.2em] mb-2">
        {stat.label}
      </span>
      <div className="flex items-end gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[2.75rem] font-extrabold tracking-[-0.04em] leading-none font-headline">
            {display}
          </span>
          <span className={`text-[10px] font-mono ${unitColor}`}>
            {stat.unit}
          </span>
        </div>
        {stat.label === "Completed This Week" && <Sparkline />}
        {stat.label === "Open Tasks" && <MiniBarChart />}
      </div>
    </div>
  );
}

function Sparkline() {
  return (
    <svg viewBox="0 0 64 20" className="w-14 h-4 mb-1.5 opacity-40">
      <polyline
        points="0,16 8,12 16,14 24,8 32,10 40,5 48,11 56,4 64,7"
        fill="none"
        stroke="#d1ffd7"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MiniBarChart() {
  return (
    <svg viewBox="0 0 40 20" className="w-10 h-4 mb-1.5 opacity-30">
      <rect x="0" y="10" width="4" height="10" fill="#acaaae" rx="1" />
      <rect x="6" y="6" width="4" height="14" fill="#acaaae" rx="1" />
      <rect x="12" y="8" width="4" height="12" fill="#acaaae" rx="1" />
      <rect x="18" y="4" width="4" height="16" fill="#acaaae" rx="1" />
      <rect x="24" y="12" width="4" height="8" fill="#acaaae" rx="1" />
      <rect x="30" y="2" width="4" height="18" fill="#7b99ff" rx="1" />
      <rect x="36" y="6" width="4" height="14" fill="#acaaae" rx="1" />
    </svg>
  );
}
