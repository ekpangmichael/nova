import Link from "next/link";

type NeedsAttentionItem = {
  title: string;
  message: string;
  timestamp: string;
  href: string | null;
  actionLabel: string;
  severity: "error" | "warning";
};

export function NeedsAttentionCard({ item }: { item: NeedsAttentionItem }) {
  const accentClass =
    item.severity === "error"
      ? "bg-error/[0.03] border-error/[0.08]"
      : "bg-primary/[0.03] border-primary/[0.08]";
  const iconWrapClass =
    item.severity === "error"
      ? "bg-error/[0.08] text-error"
      : "bg-primary/[0.08] text-primary";
  const titleClass = item.severity === "error" ? "text-error" : "text-primary/80";
  const buttonClass =
    item.severity === "error"
      ? "bg-error/[0.12] text-error hover:bg-error/[0.18]"
      : "bg-primary/[0.12] text-primary hover:bg-primary/[0.18]";

  return (
    <div className={`ghost rounded-sm border overflow-hidden mb-2 ${accentClass}`}>
      <div className="px-5 py-4 flex items-center gap-4">
        <div className={`p-2 rounded-sm shrink-0 ${iconWrapClass}`}>
          <span className="material-symbols-outlined text-[16px] leading-none">warning</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h4 className={`font-bold text-[13px] tracking-tight truncate ${titleClass}`}>
              {item.title}
            </h4>
            <span className="font-mono text-[8px] text-outline/30 shrink-0">
              {item.timestamp}
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant/55 mt-0.5 truncate">
            {item.message}
          </p>
        </div>
        {item.href ? (
          <Link
            href={item.href}
            className={`px-3 py-1.5 rounded-sm text-[9px] font-bold uppercase tracking-wider transition-colors ${buttonClass}`}
          >
            {item.actionLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
