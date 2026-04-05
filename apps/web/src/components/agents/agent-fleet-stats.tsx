"use client";

import { useAnimatedCounter } from "@/hooks/use-animated-counter";
import { Icon } from "@/components/ui/icon";
import type { RegisteredAgent } from "@/types";

type FleetStat = {
  label: string;
  value: number;
  icon: string;
  color: string;
  iconColor: string;
};

export function AgentFleetStats({ agents }: { agents: RegisteredAgent[] }) {
  const working = agents.filter((a) => a.status === "working").length;
  const idle = agents.filter((a) => a.status === "idle").length;
  const errors = agents.filter((a) => a.status === "error").length;
  const offline = agents.filter((a) => a.status === "offline").length;

  const stats: FleetStat[] = [
    { label: "Total Agents", value: agents.length, icon: "groups", color: "border-primary", iconColor: "text-primary" },
    { label: "Working", value: working, icon: "play_circle", color: "border-tertiary", iconColor: "text-tertiary" },
    { label: "Idle", value: idle, icon: "pause_circle", color: "border-secondary", iconColor: "text-secondary" },
    { label: "Errors", value: errors, icon: "error", color: "border-error", iconColor: "text-error" },
  ];

  if (offline > 0) {
    stats.push({ label: "Offline", value: offline, icon: "cloud_off", color: "border-outline-variant", iconColor: "text-outline" });
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4 mb-10 anim-2">
      {stats.map((stat) => (
        <StatCard key={stat.label} stat={stat} />
      ))}
    </div>
  );
}

function StatCard({ stat }: { stat: FleetStat }) {
  const display = useAnimatedCounter(stat.value);

  return (
    <div className={`bg-surface-container-low p-5 border-l-2 ${stat.color}`}>
      <div className="flex justify-between items-start mb-2">
        <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest">
          {stat.label}
        </p>
        <Icon name={stat.icon} size={18} className={`${stat.iconColor} opacity-50`} />
      </div>
      <span className="text-3xl font-black tracking-tight text-on-surface">
        {display}
      </span>
    </div>
  );
}
