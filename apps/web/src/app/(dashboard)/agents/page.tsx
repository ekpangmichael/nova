import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { getAgents } from "@/lib/api";

const statusTone: Record<string, string> = {
  idle: "text-secondary",
  working: "text-primary",
  paused: "text-tertiary",
  error: "text-error",
  offline: "text-on-surface-variant",
};

export default async function AgentsPage() {
  const agents = await getAgents();
  const workingCount = agents.filter((agent) => agent.status === "working").length;
  const idleCount = agents.filter((agent) => agent.status === "idle").length;
  const errorCount = agents.filter((agent) => agent.status === "error").length;

  return (
    <section className="max-w-6xl mx-auto w-full">
      <div className="mb-14 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.28em] text-secondary">
            Runtime Fleet
          </p>
          <h1 className="text-4xl font-light tracking-tight text-on-surface">
            OpenClaw Agents
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-on-surface-variant">
            Nova provisions runtime-backed agents against your local OpenClaw
            installation. Each agent owns its workspace, runtime state, and model
            defaults without duplicating OpenClaw’s own control plane.
          </p>
        </div>

        <Link
          href="/agents/new"
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-on-primary transition-opacity hover:opacity-85"
        >
          <Icon name="add" size={16} />
          Create Agent
        </Link>
      </div>

      <div className="mb-12 grid gap-4 md:grid-cols-3">
        <article className="ghost bg-surface-container-low p-6">
          <p className="text-[10px] uppercase tracking-[0.24em] text-on-surface-variant">
            Working
          </p>
          <p className="mt-3 text-3xl font-light text-on-surface">{workingCount}</p>
        </article>
        <article className="ghost bg-surface-container-low p-6">
          <p className="text-[10px] uppercase tracking-[0.24em] text-on-surface-variant">
            Idle
          </p>
          <p className="mt-3 text-3xl font-light text-on-surface">{idleCount}</p>
        </article>
        <article className="ghost bg-surface-container-low p-6">
          <p className="text-[10px] uppercase tracking-[0.24em] text-on-surface-variant">
            Errors
          </p>
          <p className="mt-3 text-3xl font-light text-on-surface">{errorCount}</p>
        </article>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            href={`/agents/${agent.id}`}
            className="ghost group bg-surface-container-low p-6 transition-colors hover:bg-surface-container"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-surface-container-high text-secondary">
                    <Icon name={agent.avatar || "smart_toy"} size={22} />
                  </span>
                  <div>
                    <h2 className="text-xl font-light tracking-tight text-on-surface">
                      {agent.name}
                    </h2>
                    <p className="text-sm text-on-surface-variant">{agent.role}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] uppercase tracking-[0.18em]">
                  <span className={statusTone[agent.status] ?? "text-on-surface-variant"}>
                    {agent.status.replace("_", " ")}
                  </span>
                  <span className="text-on-surface-variant">
                    {agent.runtime.defaultModelId ?? "No model"}
                  </span>
                  <span className="text-on-surface-variant">
                    {agent.projectIds.length} project{agent.projectIds.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <Icon
                name="arrow_forward"
                size={18}
                className="mt-1 text-on-surface-variant transition-transform group-hover:translate-x-1"
              />
            </div>

            <div className="mt-6 grid gap-3 text-sm text-on-surface-variant">
              <div className="flex items-start justify-between gap-4">
                <span>Runtime Agent ID</span>
                <span className="font-mono text-[13px] text-on-surface">
                  {agent.runtime.runtimeAgentId}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span>Workspace</span>
                <span className="max-w-[60%] truncate font-mono text-[13px] text-on-surface">
                  {agent.runtime.workspacePath}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span>Thinking Default</span>
                <span className="font-mono text-[13px] text-on-surface">
                  {agent.runtime.defaultThinkingLevel}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {agents.length === 0 ? (
        <div className="ghost mt-8 bg-surface-container-low p-8 text-sm text-on-surface-variant">
          No agents have been provisioned yet.
        </div>
      ) : null}
    </section>
  );
}
