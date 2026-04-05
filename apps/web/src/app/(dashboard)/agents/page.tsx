import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { getAgents } from "@/lib/api";
import { Pagination } from "@/components/pagination";
import { formatThinkingLevelLabelForRuntime } from "@/lib/runtime-thinking";

const statusDot: Record<string, string> = {
  idle: "bg-secondary shadow-[0_0_6px_rgba(123,153,255,0.3)]",
  working: "bg-tertiary shadow-[0_0_6px_rgba(209,255,215,0.4)]",
  paused: "bg-outline/40",
  error: "bg-error shadow-[0_0_6px_rgba(238,125,119,0.3)]",
  offline: "bg-outline/20",
};

const statusLabel: Record<string, string> = {
  idle: "text-secondary",
  working: "text-tertiary",
  paused: "text-on-surface-variant/40",
  error: "text-error",
  offline: "text-on-surface-variant/30",
};

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
  }>;
}) {
  const { page, pageSize } = await searchParams;
  const agents = await getAgents();

  const parsePositiveInt = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const currentPage = parsePositiveInt(page, 1);
  const currentPageSize = parsePositiveInt(pageSize, 12);
  const totalAgents = agents.length;
  const totalPages = Math.max(1, Math.ceil(totalAgents / currentPageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedAgents = agents.slice(
    (safeCurrentPage - 1) * currentPageSize,
    safeCurrentPage * currentPageSize,
  );

  const workingCount = agents.filter((a) => a.status === "working").length;
  const idleCount = agents.filter((a) => a.status === "idle").length;
  const errorCount = agents.filter((a) => a.status === "error").length;

  return (
    <div className="h-full overflow-y-auto pr-2 scrollbar-thin">
      <div className="mx-auto max-w-4xl pb-16">
        {/* Header */}
        <div className="mb-10 anim-1">
          <div className="flex items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl font-bold tracking-[-0.03em] text-on-surface">
                Agents
              </h1>
              <p className="mt-1.5 text-[13px] text-on-surface-variant/40">
                Create, configure, and monitor your AI agents.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/agents/import"
                className="flex items-center gap-2 rounded-md bg-surface-container-high/40 px-4 py-2.5 text-[12px] font-medium text-on-surface-variant/50 transition-colors hover:bg-surface-container-high/60 hover:text-on-surface-variant/70"
              >
                <Icon name="download" size={16} />
                Import
              </Link>
              <Link
                href="/agents/new"
                className="flex items-center gap-2 rounded-md bg-secondary/15 px-4 py-2.5 text-[12px] font-semibold text-secondary transition-colors hover:bg-secondary/20"
              >
                <Icon name="add" size={16} />
                New agent
              </Link>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-3 gap-3 anim-2">
          {[
            { label: "Working", value: workingCount, tone: "text-tertiary" },
            { label: "Idle", value: idleCount, tone: "text-secondary" },
            { label: "Errors", value: errorCount, tone: errorCount > 0 ? "text-error" : "text-on-surface-variant/40" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-surface-container-low px-5 py-4 ghost"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
                {stat.label}
              </p>
              <p className={`mt-1.5 text-2xl font-semibold ${stat.tone}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Agent grid */}
        <div className="grid gap-3 lg:grid-cols-2 anim-3">
          {paginatedAgents.map((agent) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="group overflow-hidden rounded-xl bg-surface-container-low ghost transition-all duration-200 hover:bg-surface-container-low/80"
            >
              <div className="p-5">
                {/* Top row: icon + name + arrow */}
                <div className="mb-3 flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/8">
                    <Icon
                      name={agent.avatar || "smart_toy"}
                      size={20}
                      className="text-secondary/75"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[15px] font-semibold tracking-tight text-on-surface">
                      {agent.name}
                    </h2>
                    <p className="truncate text-[12px] text-on-surface-variant/40">
                      {agent.role}
                    </p>
                  </div>
                  <Icon
                    name="arrow_forward"
                    size={16}
                    className="shrink-0 text-on-surface-variant/20 transition-all group-hover:translate-x-0.5 group-hover:text-on-surface-variant/50"
                  />
                </div>

                {/* Status + meta */}
                <div className="mb-4 flex items-center gap-3 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${statusDot[agent.status] ?? "bg-outline/20"}`}
                    />
                    <span
                      className={`font-mono uppercase tracking-wider ${statusLabel[agent.status] ?? "text-on-surface-variant/30"}`}
                    >
                      {agent.status.replace("_", " ")}
                    </span>
                  </div>
                  <span className="text-outline-variant/15">|</span>
                  <span className="truncate font-mono uppercase tracking-wider text-on-surface-variant/30">
                    {agent.runtime.defaultModelId ?? "No model"}
                  </span>
                </div>

                {/* Tags */}
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-surface-container-high/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-on-surface-variant/30">
                    {agent.runtime.kind === "openclaw-native" ? "OpenClaw" : agent.runtime.kind}
                  </span>
                  {agent.projectIds.length > 0 && (
                    <span className="rounded-md bg-surface-container-high/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-on-surface-variant/30">
                      {agent.projectIds.length} project{agent.projectIds.length === 1 ? "" : "s"}
                    </span>
                  )}
                  {agent.runtime.defaultThinkingLevel && agent.runtime.defaultThinkingLevel !== "off" && (
                    <span className="rounded-md bg-surface-container-high/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-on-surface-variant/30">
                      Think: {formatThinkingLevelLabelForRuntime(
                        agent.runtime.kind,
                        agent.runtime.defaultThinkingLevel
                      )}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Pagination */}
        {agents.length > 0 && (
          <Pagination
            total={totalAgents}
            pageSize={currentPageSize}
            currentPage={safeCurrentPage}
            pages={totalPages}
            queryMode="url"
          />
        )}

        {agents.length === 0 && (
          <div className="mt-8 rounded-xl bg-surface-container-low ghost p-8 text-center">
            <Icon name="smart_toy" size={32} className="mx-auto mb-3 text-on-surface-variant/20" />
            <p className="text-sm text-on-surface-variant/40">
              No agents created yet.
            </p>
            <Link
              href="/agents/new"
              className="mt-4 inline-flex items-center gap-2 text-[12px] font-semibold text-secondary hover:text-secondary/80 transition-colors"
            >
              <Icon name="add" size={14} />
              Create your first agent
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
