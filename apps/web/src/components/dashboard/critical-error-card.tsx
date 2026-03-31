"use client";

import { Icon } from "@/components/ui/icon";
import type { CriticalError } from "@/types";

export function CriticalErrorCard({ error }: { error: CriticalError }) {
  return (
    <div className="bg-error/[0.03] ghost rounded-sm overflow-hidden mb-2">
      <div className="px-5 py-4 flex items-center gap-4">
        <div className="p-2 bg-error/[0.08] text-error rounded-sm shrink-0">
          <Icon name="report" filled size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h4 className="font-bold text-[13px] text-error tracking-tight truncate">
              {error.title} ({error.code})
            </h4>
            <span className="font-mono text-[8px] text-outline/30 shrink-0">
              {error.timestamp}
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant/45 mt-0.5 truncate">
            {error.message}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-on-error rounded-sm"
            style={{
              background: "linear-gradient(to bottom, #ee7d77, #c45e59)",
            }}
            onClick={() => {}}
          >
            Retry
          </button>
          <button
            className="px-3 py-1.5 ghost text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/40 hover:text-on-surface-variant/70 transition-all rounded-sm"
            onClick={() => {}}
          >
            Details
          </button>
        </div>
      </div>
    </div>
  );
}
