import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { WorkingAgent, LogEntry } from "@/types";

export function AgentCard({ agent }: { agent: WorkingAgent }) {
  const showProgress = typeof agent.progress === "number";

  return (
    <div className="card-scan bg-surface-container rounded-lg ghost group hover:shadow-[0_0_0_1px_rgba(209,255,215,0.04)] transition-all duration-300">
      {/* Top accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-tertiary/20 to-transparent" />

      <div className="p-5 ghost-b">
        <div className="flex justify-between items-start mb-1.5">
          <span className="font-mono text-[10px] text-tertiary/60">
            {agent.agentId}
          </span>
          {agent.taskHref ? (
            <Link
              href={agent.taskHref}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Icon name="open_in_new" size={14} className="text-on-surface-variant/30" />
            </Link>
          ) : (
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Icon name="open_in_new" size={14} className="text-on-surface-variant/30" />
            </span>
          )}
        </div>

        <h3 className="font-bold text-[15px] tracking-tight mb-4 text-on-surface/90">
          {agent.name}
        </h3>

        {showProgress ? (
          <>
            <div className="w-full bg-surface-container-lowest h-1 rounded-full overflow-hidden shimmer">
              <div
                className="bg-tertiary h-full rounded-full glow-green"
                style={{ width: `${agent.progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 font-mono text-[8px] text-outline/50 uppercase tracking-wider gap-3">
              <span className="truncate">{agent.taskLabel}</span>
              <span className="text-tertiary/60 shrink-0">{agent.progress}%</span>
            </div>
          </>
        ) : (
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-on-surface-variant/70 truncate">
              {agent.taskLabel}
            </p>
            <span className="shrink-0 rounded-full bg-tertiary/[0.08] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.18em] text-tertiary/75">
              {agent.statusText ?? "live"}
            </span>
          </div>
        )}
      </div>

      {/* Log viewer */}
      <AgentLogViewer logs={agent.logs} />
    </div>
  );
}

function AgentLogViewer({ logs }: { logs: LogEntry[] }) {
  const levelColors: Record<LogEntry["level"], string> = {
    dim: "text-outline/25",
    info: "text-on-surface-variant/50",
    success: "text-tertiary/50",
    warning: "text-error/50",
    active: "text-tertiary/70",
  };

  return (
    <div className="bg-surface-container-lowest/60 p-4 font-mono text-[9px] h-28 scrollbar-thin overflow-y-auto space-y-1.5 leading-relaxed">
      {logs.map((log, i) => {
        const isLast = i === logs.length - 1;
        return (
          <p
            key={`${log.timestamp}-${i}`}
            className={`${levelColors[log.level]} ${isLast ? "log-cursor" : ""}`}
          >
            [{log.timestamp}] {log.message}
          </p>
        );
      })}
    </div>
  );
}
