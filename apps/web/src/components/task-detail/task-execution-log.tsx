import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { ExecutionLogItem } from "@/types";

export function TaskExecutionLog({
  log,
  href,
}: {
  log: ExecutionLogItem[];
  href: string;
}) {
  return (
    <div className="rounded-xl bg-surface-container-low ghost">
      <div className="flex items-center justify-between px-5 py-4 ghost-b">
        <h3 className="text-[12px] font-semibold tracking-tight text-on-surface">
          Execution log
        </h3>
        <Link
          href={href}
          className="font-mono text-[9px] uppercase tracking-wider text-secondary/60 transition-colors hover:text-secondary"
        >
          View all
        </Link>
      </div>
      <div className="px-5 py-3">
        <div className="relative space-y-3 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-outline-variant/10">
          {log.map((item, i) => (
            <div key={i} className="relative pl-6">
              <div className="absolute left-0 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-surface-container-high">
                <Icon
                  name={item.icon}
                  size={9}
                  className="text-on-surface-variant/50"
                />
              </div>
              <p className="text-[11px] text-on-surface-variant/50">
                {item.runtimeLabel ? (
                  <span className="mr-2 inline-flex rounded-sm bg-secondary/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-secondary/70">
                    {item.runtimeLabel}
                  </span>
                ) : null}
                <span className="font-medium text-on-surface/70">
                  {item.title}
                </span>{" "}
                <span className="line-clamp-1">{item.description}</span>
              </p>
              <p className="mt-0.5 font-mono text-[9px] text-on-surface-variant/20">
                {item.timeAgo}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
