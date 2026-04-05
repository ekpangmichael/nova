"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import {
  type ApiOpenClawCatalog,
  ApiError,
  type ApiThinkingLevel,
  getAgents,
  getOpenClawCatalog,
  importOpenClawAgent,
} from "@/lib/api";

/* ── Types ── */

type DiscoveredAgent = ApiOpenClawCatalog["existingAgents"][number];

type ImportStep = "discover" | "configure";

/* ── Helpers ── */

function slugifyAgentId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

const agentIcons = [
  "smart_toy", "terminal", "code", "hub", "memory", "psychology",
  "analytics", "bolt", "security", "explore", "rocket_launch", "model_training",
];

/* ── Main page ── */

export default function ImportAgentsPage() {
  const [step, setStep] = useState<ImportStep>("discover");
  const [catalog, setCatalog] = useState<ApiOpenClawCatalog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alreadyImported, setAlreadyImported] = useState<Set<string>>(new Set());

  // Discover step
  const [selectedAgent, setSelectedAgent] = useState<DiscoveredAgent | null>(null);

  // Configure step
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("smart_toy");
  const [systemInstructions, setSystemInstructions] = useState("");
  const [thinkingLevel, setThinkingLevel] = useState<ApiThinkingLevel>("medium");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const [catalogResult, existingAgents] = await Promise.all([
          getOpenClawCatalog(),
          getAgents(),
        ]);
        if (cancelled) return;
        setCatalog(catalogResult);

        // Build set of already-imported runtime agent IDs
        const imported = new Set(
          existingAgents
            .filter((a) => a.runtime.kind === "openclaw-native")
            .map((a) => a.runtime.runtimeAgentId)
        );
        setAlreadyImported(imported);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Unable to load the OpenClaw runtime catalog."
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const availableAgents = catalog?.existingAgents.filter(
    (a) => !alreadyImported.has(a.runtimeAgentId)
  ) ?? [];

  const alreadyImportedAgents = catalog?.existingAgents.filter(
    (a) => alreadyImported.has(a.runtimeAgentId)
  ) ?? [];

  function handleSelectAgent(agent: DiscoveredAgent) {
    setSelectedAgent(agent);
    setName(agent.displayName || agent.runtimeAgentId);
    setSelectedModelId(agent.defaultModelId || catalog?.defaults.defaultModelId || "");
    setRole("");
    setSystemInstructions("");
    setSelectedIcon("smart_toy");
    setThinkingLevel("medium");
    setSubmitError(null);
    setStep("configure");
  }

  function handleBackToDiscover() {
    setStep("discover");
    setSelectedAgent(null);
    setSubmitError(null);
  }

  async function handleImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAgent || !catalog) return;

    setSubmitError(null);
    if (!name.trim()) { setSubmitError("Agent name is required."); return; }
    if (!role.trim()) { setSubmitError("Assigned role is required."); return; }
    if (!selectedModelId) { setSubmitError("Select a default model."); return; }

    setIsSubmitting(true);
    try {
      const agent = await importOpenClawAgent({
        name: name.trim(),
        role: role.trim(),
        avatar: selectedIcon,
        systemInstructions: systemInstructions.trim(),
        personaText: null,
        userContextText: null,
        identityText: null,
        toolsText: null,
        heartbeatText: null,
        memoryText: null,
        runtime: {
          runtimeAgentId: selectedAgent.runtimeAgentId,
          defaultModelId: selectedModelId,
          sandboxMode: "off",
          modelOverrideAllowed: true,
          defaultThinkingLevel: thinkingLevel,
        },
      });
      window.location.assign(`/agents/${agent.id}`);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Failed to import the agent."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto pr-2 scrollbar-thin">
      <div className="mx-auto max-w-3xl pb-16">
        {/* Header */}
        <div className="mb-8 anim-1">
          <Link
            href="/agents"
            className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-on-surface-variant/40 transition-colors hover:text-on-surface-variant/70"
          >
            <Icon name="arrow_back" size={14} />
            Back to agents
          </Link>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-[-0.03em] text-on-surface">
                Import Agent
              </h1>
              <p className="mt-1.5 text-[13px] text-on-surface-variant/40">
                Discover and import existing OpenClaw agents into Nova.
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-3">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-all ${
                  step === "discover"
                    ? "bg-secondary text-white"
                    : "bg-secondary/15 text-secondary"
                }`}
              >
                {step === "configure" ? <Icon name="check" size={14} /> : 1}
              </div>
              <div className={`h-px w-8 transition-colors ${step === "configure" ? "bg-secondary/40" : "bg-outline-variant/15"}`} />
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-all ${
                  step === "configure"
                    ? "bg-secondary text-white"
                    : "bg-surface-container-high/40 text-on-surface-variant/30"
                }`}
              >
                2
              </div>
            </div>
          </div>
        </div>

        {/* Loading state — animated scanner */}
        {isLoading && (
          <div className="overflow-hidden rounded-xl bg-surface-container-low ghost anim-2">
            {/* Radar / scanner visual */}
            <div className="relative flex flex-col items-center px-8 pt-10 pb-8">
              {/* Animated rings */}
              <div className="relative mb-6 flex h-28 w-28 items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-secondary/10 animate-ping [animation-duration:2.5s]" />
                <div className="absolute inset-3 rounded-full border border-secondary/8 animate-ping [animation-duration:2.5s] [animation-delay:0.4s]" />
                <div className="absolute inset-6 rounded-full border border-secondary/6 animate-ping [animation-duration:2.5s] [animation-delay:0.8s]" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-secondary/12">
                  <Icon name="radar" size={28} className="text-secondary animate-[spin_3s_linear_infinite]" />
                </div>
              </div>

              <p className="text-[14px] font-semibold tracking-tight text-on-surface">
                Scanning OpenClaw runtime
              </p>
              <p className="mt-1.5 text-[12px] text-on-surface-variant/40">
                Looking for agents not yet managed by Nova...
              </p>

              {/* Simulated scan lines */}
              <div className="mt-6 w-full max-w-xs space-y-2.5">
                {[
                  { label: "Connecting to runtime", delay: "0ms" },
                  { label: "Reading agent registry", delay: "300ms" },
                  { label: "Resolving workspaces", delay: "600ms" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 animate-pulse"
                    style={{ animationDelay: item.delay }}
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-secondary/50" />
                    <div className="flex-1">
                      <p className="text-[11px] font-mono text-on-surface-variant/30">
                        {item.label}
                      </p>
                    </div>
                    <div className="h-px flex-1 max-w-[60px] bg-gradient-to-r from-secondary/20 to-transparent" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="rounded-xl border border-error/20 bg-error/5 p-6 text-center anim-2">
            <Icon name="error" size={28} className="mx-auto mb-3 text-error/60" />
            <p className="text-sm text-error">{error}</p>
            <p className="mt-2 text-[12px] text-on-surface-variant/40">
              Make sure the OpenClaw runtime is configured and healthy.
            </p>
          </div>
        )}

        {/* Step 1: Discover */}
        {!isLoading && !error && step === "discover" && (
          <div className="space-y-6 anim-2">
            {/* Available agents */}
            {availableAgents.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Icon name="download" size={16} className="text-secondary/60" />
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                    Available to import
                  </h2>
                  <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-secondary">
                    {availableAgents.length}
                  </span>
                </div>

                <div className="grid gap-3">
                  {availableAgents.map((agent) => (
                    <button
                      key={agent.runtimeAgentId}
                      type="button"
                      onClick={() => handleSelectAgent(agent)}
                      className="group w-full overflow-hidden rounded-xl bg-surface-container-low ghost text-left transition-all duration-200 hover:bg-surface-container-low/80 hover:ring-1 hover:ring-secondary/20"
                    >
                      <div className="flex items-center gap-4 p-5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-tertiary/10">
                          <Icon name="smart_toy" size={22} className="text-tertiary/70" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-[15px] font-semibold tracking-tight text-on-surface">
                              {agent.displayName || agent.runtimeAgentId}
                            </h3>
                            {agent.isDefault && (
                              <span className="shrink-0 rounded-full bg-tertiary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-tertiary">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-[11px]">
                            <span className="font-mono text-on-surface-variant/35">
                              @{agent.runtimeAgentId}
                            </span>
                            {agent.defaultModelId && (
                              <>
                                <span className="text-outline-variant/15">|</span>
                                <span className="font-mono uppercase tracking-wider text-on-surface-variant/30">
                                  {agent.defaultModelId}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="mt-1.5 truncate font-mono text-[10px] text-on-surface-variant/25">
                            {agent.workspacePath}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-secondary opacity-0 transition-opacity group-hover:opacity-100">
                            Import
                          </span>
                          <Icon
                            name="arrow_forward"
                            size={16}
                            className="text-on-surface-variant/20 transition-all group-hover:translate-x-0.5 group-hover:text-secondary"
                          />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Already imported */}
            {alreadyImportedAgents.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Icon name="check_circle" size={16} className="text-on-surface-variant/30" />
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/35">
                    Already in Nova
                  </h2>
                  <span className="rounded-full bg-surface-container-high/40 px-2 py-0.5 text-[10px] font-bold tabular-nums text-on-surface-variant/30">
                    {alreadyImportedAgents.length}
                  </span>
                </div>

                <div className="grid gap-2">
                  {alreadyImportedAgents.map((agent) => (
                    <div
                      key={agent.runtimeAgentId}
                      className="flex items-center gap-4 rounded-xl bg-surface-container-low/50 p-4 opacity-50"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-high/40">
                        <Icon name="smart_toy" size={18} className="text-on-surface-variant/30" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[13px] font-medium text-on-surface-variant/50">
                          {agent.displayName || agent.runtimeAgentId}
                        </h3>
                        <span className="font-mono text-[10px] text-on-surface-variant/25">
                          @{agent.runtimeAgentId}
                        </span>
                      </div>
                      <span className="rounded-full bg-tertiary/8 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-tertiary/50">
                        Imported
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty: no agents found at all */}
            {catalog && catalog.existingAgents.length === 0 && (
              <div className="rounded-xl bg-surface-container-low ghost p-10 text-center">
                <Icon name="search_off" size={32} className="mx-auto mb-3 text-on-surface-variant/20" />
                <p className="text-[13px] font-medium text-on-surface-variant/50">
                  No existing OpenClaw agents found.
                </p>
                <p className="mt-1 text-[12px] text-on-surface-variant/30">
                  Create agents with the OpenClaw CLI first, or create a new one in Nova.
                </p>
                <Link
                  href="/agents/new"
                  className="mt-5 inline-flex items-center gap-2 text-[12px] font-semibold text-secondary hover:text-secondary/80 transition-colors"
                >
                  <Icon name="add" size={14} />
                  Create new agent instead
                </Link>
              </div>
            )}

            {/* All already imported */}
            {catalog && availableAgents.length === 0 && alreadyImportedAgents.length > 0 && (
              <div className="rounded-xl bg-surface-container-low ghost p-8 text-center">
                <Icon name="check_circle" size={28} className="mx-auto mb-3 text-tertiary/40" />
                <p className="text-[13px] font-medium text-on-surface-variant/50">
                  All discovered agents have already been imported.
                </p>
                <Link
                  href="/agents"
                  className="mt-4 inline-flex items-center gap-2 text-[12px] font-semibold text-secondary hover:text-secondary/80 transition-colors"
                >
                  View your agents
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Configure */}
        {!isLoading && !error && step === "configure" && selectedAgent && (
          <form onSubmit={handleImport} className="space-y-8 anim-2">
            {/* Source card */}
            <div className="rounded-xl border border-secondary/10 bg-secondary/[0.03] p-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-secondary/50">
                Importing from OpenClaw
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tertiary/10">
                  <Icon name="smart_toy" size={18} className="text-tertiary/70" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-on-surface">
                    {selectedAgent.displayName || selectedAgent.runtimeAgentId}
                  </p>
                  <p className="truncate font-mono text-[10px] text-on-surface-variant/30">
                    {selectedAgent.workspacePath}
                  </p>
                </div>
              </div>
            </div>

            {/* 01 Identity */}
            <section>
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-high/40 text-[10px] font-bold text-on-surface-variant/40">
                  01
                </span>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                  Identity
                </h2>
              </div>

              <div className="space-y-5 rounded-xl bg-surface-container-low ghost p-5">
                {/* Icon picker */}
                <div>
                  <label className="mb-2 block text-[11px] font-medium text-on-surface-variant/40">
                    Icon
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {agentIcons.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setSelectedIcon(icon)}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
                          selectedIcon === icon
                            ? "bg-secondary/15 text-secondary ring-1 ring-secondary/30"
                            : "bg-surface-container-high/30 text-on-surface-variant/30 hover:text-on-surface-variant/50"
                        }`}
                      >
                        <Icon name={icon} size={18} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-on-surface-variant/40">
                    Agent name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Research Lead"
                    className="w-full border-b border-outline-variant/15 bg-transparent pb-2 text-[15px] font-medium text-on-surface placeholder:text-on-surface-variant/20 focus:border-secondary/40 focus:outline-none transition-colors"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-on-surface-variant/40">
                    Assigned role
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Lead Technical Research"
                    className="w-full border-b border-outline-variant/15 bg-transparent pb-2 text-[15px] font-medium text-on-surface placeholder:text-on-surface-variant/20 focus:border-secondary/40 focus:outline-none transition-colors"
                  />
                </div>

                {/* Runtime Agent ID (read-only) */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-on-surface-variant/40">
                    Runtime agent ID
                  </label>
                  <div className="flex items-center gap-2 border-b border-outline-variant/10 pb-2">
                    <Icon name="lock" size={14} className="text-on-surface-variant/25" />
                    <span className="font-mono text-[13px] text-on-surface-variant/50">
                      {selectedAgent.runtimeAgentId}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-on-surface-variant/25">
                    Locked to the existing OpenClaw agent identity.
                  </p>
                </div>
              </div>
            </section>

            {/* 02 Intelligence */}
            <section>
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-high/40 text-[10px] font-bold text-on-surface-variant/40">
                  02
                </span>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                  Intelligence
                </h2>
              </div>

              <div className="space-y-5 rounded-xl bg-surface-container-low ghost p-5">
                {/* System instructions */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-on-surface-variant/40">
                    System instructions
                    <span className="ml-1 text-on-surface-variant/20">(optional)</span>
                  </label>
                  <textarea
                    value={systemInstructions}
                    onChange={(e) => setSystemInstructions(e.target.value)}
                    placeholder="High-level guidance for how this agent should behave..."
                    rows={3}
                    className="w-full resize-none rounded-lg bg-surface-container/60 px-3 py-2.5 text-[13px] text-on-surface placeholder:text-on-surface-variant/20 focus:ring-1 focus:ring-secondary/20 focus:outline-none transition-all"
                  />
                </div>

                {/* Model */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-on-surface-variant/40">
                    Default model
                  </label>
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    className="w-full rounded-lg bg-surface-container/60 px-3 py-2.5 text-[13px] text-on-surface focus:ring-1 focus:ring-secondary/20 focus:outline-none transition-all"
                  >
                    {catalog?.models
                      .filter((m) => m.available)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.id}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Thinking level */}
                <div>
                  <label className="mb-2 block text-[11px] font-medium text-on-surface-variant/40">
                    Thinking level
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(["off", "minimal", "low", "medium", "high", "xhigh"] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setThinkingLevel(level)}
                        className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-all ${
                          thinkingLevel === level
                            ? "bg-secondary/15 text-secondary ring-1 ring-secondary/25"
                            : "bg-surface-container-high/30 text-on-surface-variant/35 hover:text-on-surface-variant/50"
                        }`}
                      >
                        {level === "xhigh" ? "X-High" : level.charAt(0).toUpperCase() + level.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* 03 Paths (read-only) */}
            <section>
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-high/40 text-[10px] font-bold text-on-surface-variant/40">
                  03
                </span>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                  Paths
                </h2>
              </div>

              <div className="space-y-3 rounded-xl bg-surface-container-low ghost p-5">
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-on-surface-variant/30">
                    Agent Home
                  </label>
                  <p className="truncate font-mono text-[12px] text-on-surface-variant/50">
                    {selectedAgent.workspacePath}
                  </p>
                </div>
                <div className="h-px bg-outline-variant/10" />
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-on-surface-variant/30">
                    Runtime state
                  </label>
                  <p className="truncate font-mono text-[12px] text-on-surface-variant/50">
                    {selectedAgent.runtimeStatePath}
                  </p>
                </div>
              </div>
            </section>

            {/* Error */}
            {submitError && (
              <div className="rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-[13px] text-error">
                {submitError}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={handleBackToDiscover}
                className="flex items-center gap-2 rounded-md px-4 py-2.5 text-[12px] font-medium text-on-surface-variant/40 transition-colors hover:text-on-surface-variant/70"
              >
                <Icon name="arrow_back" size={14} />
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim() || !role.trim()}
                className="flex items-center gap-2 rounded-md bg-secondary/15 px-6 py-2.5 text-[12px] font-semibold text-secondary transition-colors hover:bg-secondary/20 disabled:opacity-40 disabled:hover:bg-secondary/15"
              >
                {isSubmitting ? (
                  <>
                    <Icon name="progress_activity" size={14} className="animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Icon name="download" size={14} />
                    Import agent
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
