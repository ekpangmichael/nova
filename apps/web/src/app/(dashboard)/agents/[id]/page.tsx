import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { agentDetails } from "@/lib/mock-data";
import { SkillToggles } from "@/components/agents/skill-toggles";

export function generateStaticParams() {
  return Object.keys(agentDetails).map((id) => ({ id }));
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = agentDetails[id];

  if (!agent) {
    notFound();
  }

  const isError = agent.status === "critical";

  return (
    <section className="max-w-5xl mx-auto w-full">
      {/* Hero Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 anim-1">
        <div className="flex items-center gap-8">
          <div className="relative">
            <div className={`w-24 h-24 bg-surface-container-high p-0.5 flex items-center justify-center ${isError ? "ring-1 ring-error/20" : ""}`}>
              <Icon
                name={agent.icon}
                size={40}
                className={isError ? "text-error/60" : "text-secondary/60"}
              />
            </div>
            <div
              className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-surface ${isError ? "bg-error" : "bg-secondary"}`}
            />
          </div>
          <div>
            <h2 className="text-4xl font-light tracking-tight text-on-surface">
              {agent.name}
            </h2>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs font-mono text-on-surface-variant uppercase tracking-widest">
                ID: {agent.agentCode}
              </span>
              <span className="h-1 w-1 rounded-full bg-outline-variant" />
              <span
                className={`text-xs font-mono uppercase tracking-widest ${isError ? "text-error" : "text-secondary"}`}
              >
                {agent.statusLabel}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <button className="px-6 py-2 text-xs uppercase tracking-widest bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-all">
            Export
          </button>
          <button className="px-6 py-2 text-xs uppercase tracking-widest bg-primary text-on-primary font-semibold hover:opacity-80 transition-all active:scale-95 rounded-sm">
            Deploy Agent
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-12 ghost-b mb-12 anim-1">
        <button className="pb-4 text-xs uppercase tracking-[0.2em] text-on-surface border-b border-secondary">
          Config
        </button>
        <button className="pb-4 text-xs uppercase tracking-[0.2em] text-on-surface-variant hover:text-on-surface transition-colors">
          Skills
        </button>
        <button className="pb-4 text-xs uppercase tracking-[0.2em] text-on-surface-variant hover:text-on-surface transition-colors">
          History
        </button>
        <button className="pb-4 text-xs uppercase tracking-[0.2em] text-on-surface-variant hover:text-on-surface transition-colors">
          Analytics
        </button>
      </div>

      {/* Main Grid: Config (7) + Sidebar (5) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left: Configuration */}
        <div className="md:col-span-7 space-y-12 anim-2">
          {/* Primary Identity */}
          <div className="space-y-8">
            <div>
              <label className="block text-xs uppercase tracking-widest text-on-surface-variant mb-2">
                Primary Identity
              </label>
              <p className="w-full py-2 border-b border-outline-variant/30 text-on-surface text-lg font-light">
                {agent.role}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <label className="block text-xs uppercase tracking-widest text-on-surface-variant mb-2">
                  Model Engine
                </label>
                <p className="text-on-surface py-2 border-b border-outline-variant/10">
                  {agent.model}
                </p>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-on-surface-variant mb-2">
                  Thinking Level
                </label>
                <p className="text-on-surface py-2 border-b border-outline-variant/10">
                  {agent.thinkingLevel}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-on-surface-variant mb-2">
                Core Directive
              </label>
              <div className="bg-surface-container-low p-4">
                <p className="text-on-surface-variant text-sm leading-relaxed">
                  {agent.coreDirective}
                </p>
              </div>
            </div>
          </div>

          {/* Operational Skills */}
          <SkillToggles initialSkills={agent.skills} />
        </div>

        {/* Right: History & Metrics */}
        <div className="md:col-span-5 space-y-12 anim-3">
          {/* Recent History */}
          <div className="bg-surface-container-low p-8">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xs uppercase tracking-widest text-on-surface-variant">
                Recent History
              </h3>
              <span className="text-[10px] text-secondary underline cursor-pointer">
                View Archive
              </span>
            </div>
            <div className="space-y-6">
              {agent.history.map((entry, i) => (
                <div key={i} className="flex justify-between items-baseline">
                  <div className="space-y-1">
                    <p className="text-sm text-on-surface font-light">
                      {entry.task}
                    </p>
                    <p className="text-[10px] uppercase tracking-tighter text-on-surface-variant">
                      {entry.date}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-widest ${
                      entry.status === "success"
                        ? "text-secondary"
                        : "text-error"
                    }`}
                  >
                    {entry.status === "success" ? "Success" : "Fail"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Mini Analytics */}
          <div className="space-y-6 px-4">
            <div className="space-y-4">
              <div className="flex justify-between text-xs font-mono uppercase text-on-surface-variant">
                <span>Compute Load</span>
                <span>{agent.computeLoad}%</span>
              </div>
              <div className="w-full h-px bg-outline-variant/20 relative">
                <div
                  className={`absolute left-0 top-0 h-px ${isError ? "bg-error" : "bg-secondary"}`}
                  style={{ width: `${agent.computeLoad}%` }}
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between text-xs font-mono uppercase text-on-surface-variant">
                <span>Reliability</span>
                <span>{agent.reliability}%</span>
              </div>
              <div className="w-full h-px bg-outline-variant/20 relative">
                <div
                  className="absolute left-0 top-0 h-px bg-secondary"
                  style={{ width: `${agent.reliability}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-24 pt-6 ghost-t flex justify-between items-center text-[10px] uppercase tracking-widest text-on-surface-variant anim-4">
        <div className="flex gap-8">
          <span>Latency: {agent.latency}</span>
          <span>Uptime: {agent.uptime}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-1.5 h-1.5 rounded-full ${isError ? "bg-error" : "bg-secondary animate-pulse"}`}
          />
          <span>
            {isError
              ? "Connection Degraded"
              : "Encrypted Connection Established"}
          </span>
        </div>
      </footer>
    </section>
  );
}
