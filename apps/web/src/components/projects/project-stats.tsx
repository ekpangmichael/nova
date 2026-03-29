"use client";

import { useAnimatedCounter } from "@/hooks/use-animated-counter";
import { Icon } from "@/components/ui/icon";
import type { ProjectStat } from "@/types";

const borderColors: Record<ProjectStat["accentColor"], string> = {
  secondary: "border-secondary",
  tertiary: "border-tertiary",
  primary: "border-primary",
};

const iconColors: Record<ProjectStat["accentColor"], string> = {
  secondary: "text-secondary",
  tertiary: "text-tertiary",
  primary: "text-primary",
};

const unitColors: Record<ProjectStat["accentColor"], string> = {
  secondary: "text-secondary/70",
  tertiary: "text-tertiary/70",
  primary: "text-primary/70",
};

export function ProjectStats({ stats }: { stats: ProjectStat[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 anim-2">
      {stats.map((stat) => (
        <ProjectStatCard key={stat.label} stat={stat} />
      ))}
    </div>
  );
}

function ProjectStatCard({ stat }: { stat: ProjectStat }) {
  const display = useAnimatedCounter(stat.value, { decimals: stat.decimals });

  return (
    <div
      className={`bg-surface-container-low p-5 border-l-2 ${borderColors[stat.accentColor]}`}
    >
      <div className="flex justify-between items-start mb-2">
        <p className="font-mono text-[10px] tracking-widest text-on-surface-variant uppercase">
          {stat.label}
        </p>
        <Icon
          name={stat.icon}
          size={20}
          className={iconColors[stat.accentColor]}
        />
      </div>
      <div className="flex items-baseline gap-2">
        <h3 className="text-3xl font-black tracking-tight text-on-surface">
          {display}
        </h3>
        <span className={`font-mono text-xs ${unitColors[stat.accentColor]}`}>
          {stat.unit}
        </span>
      </div>
    </div>
  );
}
