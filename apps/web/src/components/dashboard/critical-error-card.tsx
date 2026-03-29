"use client";

import { Icon } from "@/components/ui/icon";
import type { CriticalError } from "@/types";

export function CriticalErrorCard({ error }: { error: CriticalError }) {
  return (
    <div
      className="bg-error-container/[0.03] ghost rounded-lg overflow-hidden"
      style={{ borderColor: "rgba(238,125,119,0.08)" }}
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-error/[0.08] text-error rounded-sm shrink-0">
            <Icon name="report" filled size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start mb-1">
              <h4 className="font-bold text-[14px] text-error tracking-tight">
                {error.title} ({error.code})
              </h4>
              <span className="font-mono text-[9px] text-outline/30 shrink-0 ml-4">
                {error.timestamp}
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant/50 mb-5 leading-relaxed max-w-2xl">
              {error.message}
            </p>
            <div className="flex gap-3">
              <button
                className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-on-error rounded-sm"
                style={{
                  background: "linear-gradient(to bottom, #ee7d77, #c45e59)",
                }}
                onClick={() => {}}
              >
                Retry Auth
              </button>
              <button
                className="px-4 py-1.5 ghost text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/50 hover:text-on-surface-variant/80 hover:bg-surface-container-high/40 transition-all rounded-sm"
                onClick={() => {}}
              >
                View Stack Trace
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
