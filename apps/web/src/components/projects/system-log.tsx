import type { SystemLogEntry } from "@/types";

const levelColors: Record<SystemLogEntry["level"], string> = {
  success: "text-tertiary",
  info: "text-secondary",
  warning: "text-error",
  cleanup: "text-on-surface-variant",
};

const levelLabels: Record<SystemLogEntry["level"], string> = {
  success: "SUCCESS:",
  info: "INFO:",
  warning: "WARNING:",
  cleanup: "CLEANUP:",
};

export function SystemLog({ entries }: { entries: SystemLogEntry[] }) {
  return (
    <div className="mt-12 bg-surface-container-lowest border-l-2 border-secondary p-4 rounded-sm anim-5">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-secondary pulse-blue" />
          <p className="font-mono text-[10px] text-secondary tracking-widest uppercase">
            System Operations Log
          </p>
        </div>
        <p className="font-mono text-[10px] text-on-surface-variant uppercase">
          Session ID: 0x8FA2B
        </p>
      </div>
      <div className="font-mono text-[11px] space-y-1 text-on-surface-variant">
        {entries.map((entry, i) => (
          <p key={`${entry.timestamp}-${i}`}>
            <span className="text-on-surface/40">[{entry.timestamp}]</span>{" "}
            <span className={levelColors[entry.level]}>
              {levelLabels[entry.level]}
            </span>{" "}
            {entry.message}
          </p>
        ))}
      </div>
    </div>
  );
}
