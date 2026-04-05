import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { ApiError, getAgent, getProjects } from "@/lib/api";
import { AgentActionButtons } from "@/components/agents/agent-action-buttons";
import { CollapsibleMarkdownSection } from "@/components/agents/collapsible-markdown-section";
import { formatTimestampForDisplay } from "@/lib/display-preferences";
import { getServerDisplayPreferences } from "@/lib/display-preferences.server";
import { formatThinkingLevelLabelForRuntime } from "@/lib/runtime-thinking";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function loadAgent(id: string) {
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  try {
    return await getAgent(id);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      notFound();
    }

    throw error;
  }
}


export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const displayPreferences = await getServerDisplayPreferences();
  const [agent, projects] = await Promise.all([loadAgent(id), getProjects()]);
  const assignments = agent.projectIds.map((projectId) => ({
    id: projectId,
    project: projects.find((project) => project.id === projectId) ?? null,
  }));

  const statusConfig: Record<string, { className: string }> = {
    idle: { className: "bg-secondary/15 text-secondary" },
    working: { className: "bg-tertiary/15 text-tertiary" },
    paused: { className: "bg-on-surface-variant/10 text-on-surface-variant" },
    error: { className: "bg-error/15 text-error" },
    offline: { className: "bg-on-surface-variant/10 text-on-surface-variant" },
  };
  const statusStyle = statusConfig[agent.status] ?? statusConfig.idle;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back */}
      <Link
        href="/agents"
        className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5 text-sm mb-8 anim-1"
      >
        <Icon name="arrow_back" size={16} />
        Agents
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 mb-10 anim-1">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`font-mono text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-sm ${statusStyle.className}`}>
              {agent.status}
            </span>
            <span className="font-mono text-[10px] text-on-surface-variant/40 uppercase tracking-widest">
              {agent.runtime.runtimeAgentId}
            </span>
          </div>
          <AgentActionButtons agentId={agent.id} agentName={agent.name} />
        </div>
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-surface-container-high flex items-center justify-center rounded-sm shrink-0">
            <Icon name={agent.avatar || "smart_toy"} size={30} className="text-secondary" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tighter text-on-surface">
              {agent.name}
            </h1>
            <p className="text-on-surface-variant text-sm mt-1">{agent.role}</p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 anim-2">
        <div className="bg-surface-container-low p-5 ghost">
          <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-3">
            Model
          </p>
          <p className="font-mono text-sm text-on-surface truncate">
            {agent.runtime.defaultModelId ?? "Not set"}
          </p>
        </div>
        <div className="bg-surface-container-low p-5 ghost">
          <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-3">
            Thinking
          </p>
          <p className="font-mono text-sm text-on-surface">
            {formatThinkingLevelLabelForRuntime(
              agent.runtime.kind,
              agent.runtime.defaultThinkingLevel
            )}
          </p>
        </div>
        <div className="bg-surface-container-low p-5 ghost">
          <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-3">
            Projects
          </p>
          <p className="text-3xl font-black tracking-tight text-on-surface">
            {agent.projectIds.length}
          </p>
        </div>
        <div className="bg-surface-container-low p-5 ghost">
          <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-3">
            Last Synced
          </p>
            <p className="font-mono text-sm text-on-surface">
              {agent.lastSyncedAt
                ? formatTimestampForDisplay(agent.lastSyncedAt, displayPreferences, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "Never"}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <CollapsibleMarkdownSection
            title="Directive"
            content={agent.systemInstructions}
            empty="No system instructions configured."
          />

          {/* Persona & Tools */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 anim-3">
            <CollapsibleMarkdownSection
              title="Persona"
              content={agent.personaText}
              empty="Not configured."
            />
            <CollapsibleMarkdownSection
              title="Tools"
              content={agent.toolsText}
              empty="Not configured."
            />
          </div>

          {/* Runtime Paths */}
          <section className="bg-surface-container p-6 ghost anim-4">
            <h3 className="text-[11px] font-bold tracking-widest uppercase text-on-surface mb-4">
              Runtime Paths
            </h3>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">
                  Workspace
                </dt>
                <dd className="font-mono text-on-surface break-all">
                  {agent.runtime.workspacePath}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">
                  Runtime State
                </dt>
                <dd className="font-mono text-on-surface break-all">
                  {agent.runtime.runtimeStatePath}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 anim-3">
          {/* Runtime Settings */}
          <div className="bg-surface-container p-6 ghost">
            <h3 className="text-[11px] font-bold tracking-widest uppercase text-on-surface mb-4">
              Runtime Settings
            </h3>
            <dl className="space-y-4 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-on-surface-variant">Model Override</dt>
                <dd className="text-on-surface font-mono text-[13px]">
                  {agent.runtime.modelOverrideAllowed ? "Allowed" : "Locked"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-on-surface-variant">Sandbox</dt>
                <dd className="text-on-surface font-mono text-[13px]">{agent.runtime.sandboxMode}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-on-surface-variant">Runtime</dt>
                <dd className="text-on-surface font-mono text-[13px]">{agent.runtime.kind}</dd>
              </div>
            </dl>
          </div>

          {/* Project Assignments */}
          <div className="bg-surface-container p-6 ghost">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] font-bold tracking-widest uppercase text-on-surface">
                Project Assignments
              </h3>
              <span className="font-mono text-[9px] text-on-surface-variant/40 uppercase tracking-widest">
                {agent.projectIds.length} linked
              </span>
            </div>
            {assignments.length > 0 ? (
              <div className="space-y-3">
                {assignments.map(({ id: projectId, project }) => (
                  <Link
                    key={projectId}
                    href={`/projects/${projectId}`}
                    className="block bg-surface-container-low px-4 py-3 hover:border-secondary/20 ghost transition-colors"
                  >
                    <div className="text-sm font-semibold text-on-surface">
                      {project?.name ?? projectId}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-on-surface-variant/60">
                      {projectId}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">
                Not assigned to any project yet.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
