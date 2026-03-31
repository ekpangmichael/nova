"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import {
  ApiError,
  type ApiOpenClawCatalog,
  type ApiThinkingLevel,
  createAgent,
  getOpenClawCatalog,
  selectDirectory,
} from "@/lib/api";

const agentIcons = [
  "smart_toy",
  "terminal",
  "code",
  "hub",
  "memory",
  "psychology",
  "analytics",
  "bolt",
  "security",
  "explore",
  "rocket_launch",
  "model_training",
];

const thinkingLevels: ApiThinkingLevel[] = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

function slugifyAgentId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function applyAgentIdTemplate(template: string, runtimeAgentId: string) {
  return template.replace("<agentId>", runtimeAgentId || "new-agent");
}

export default function NewAgentPage() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<ApiOpenClawCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("smart_toy");
  const [systemInstructions, setSystemInstructions] = useState("");
  const [personaText, setPersonaText] = useState("");
  const [userContextText, setUserContextText] = useState("");
  const [identityText, setIdentityText] = useState("");
  const [toolsText, setToolsText] = useState("");
  const [heartbeatText, setHeartbeatText] = useState("");
  const [memoryText, setMemoryText] = useState("");
  const [thinkingLevel, setThinkingLevel] = useState<ApiThinkingLevel>("medium");
  const [runtimeAgentIdInput, setRuntimeAgentIdInput] = useState("");
  const [workspacePathOverride, setWorkspacePathOverride] = useState("");
  const [runtimeStatePathOverride, setRuntimeStatePathOverride] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [showAdvancedPaths, setShowAdvancedPaths] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickingWorkspace, setIsPickingWorkspace] = useState(false);
  const iconPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setIsLoadingCatalog(true);

      try {
        const nextCatalog = await getOpenClawCatalog();

        if (cancelled) {
          return;
        }

        setCatalog(nextCatalog);
        setCatalogError(null);
        setSelectedModelId(
          nextCatalog.defaults.defaultModelId ??
            nextCatalog.models.find((model) => model.available)?.id ??
            ""
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        setCatalogError(
          error instanceof ApiError
            ? error.message
            : "Unable to load the OpenClaw runtime catalog."
        );
      } finally {
        if (!cancelled) {
          setIsLoadingCatalog(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (iconPickerRef.current && !iconPickerRef.current.contains(event.target as Node)) {
        setShowIconPicker(false);
      }
    }

    if (showIconPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showIconPicker]);

  const runtimeAgentId =
    slugifyAgentId(runtimeAgentIdInput) || slugifyAgentId(name) || "new-agent";
  const previewWorkspacePath = !catalog
    ? workspacePathOverride
    : workspacePathOverride ||
      applyAgentIdTemplate(catalog.defaults.workspacePathTemplate, runtimeAgentId);
  const previewRuntimeStatePath = !catalog
    ? runtimeStatePathOverride
    : runtimeStatePathOverride ||
      applyAgentIdTemplate(catalog.defaults.runtimeStatePathTemplate, runtimeAgentId);

  async function handleBrowseWorkspace() {
    setErrorMessage(null);
    setIsPickingWorkspace(true);

    try {
      const selection = await selectDirectory();

      if (selection.path) {
        setWorkspacePathOverride(selection.path);
        setShowAdvancedPaths(true);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to open the directory picker."
      );
    } finally {
      setIsPickingWorkspace(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!catalog) {
      setErrorMessage("OpenClaw catalog has not finished loading.");
      return;
    }

    if (!catalog.available) {
      setErrorMessage("OpenClaw is not available. Fix the runtime health first.");
      return;
    }

    if (!name.trim()) {
      setErrorMessage("Agent name is required.");
      return;
    }

    if (!role.trim()) {
      setErrorMessage("Assigned role is required.");
      return;
    }

    if (!runtimeAgentId) {
      setErrorMessage("Runtime agent id could not be generated.");
      return;
    }

    if (!selectedModelId) {
      setErrorMessage("Select a default model.");
      return;
    }

    setIsSubmitting(true);

    try {
      const agent = await createAgent({
        name: name.trim(),
        role: role.trim(),
        avatar: selectedIcon,
        systemInstructions: systemInstructions.trim(),
        personaText: personaText.trim() || null,
        userContextText: userContextText.trim() || null,
        identityText: identityText.trim() || null,
        toolsText: toolsText.trim() || null,
        heartbeatText: heartbeatText.trim() || null,
        memoryText: memoryText.trim() || null,
        runtime: {
          kind: "openclaw-native",
          runtimeAgentId,
          workspacePath: previewWorkspacePath,
          runtimeStatePath: previewRuntimeStatePath,
          defaultModelId: selectedModelId,
          sandboxMode: "off",
          modelOverrideAllowed: true,
          defaultThinkingLevel: thinkingLevel,
        },
      });

      router.push(`/agents/${agent.id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to provision the agent. Confirm the backend is running and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Back */}
      <Link
        href="/agents"
        className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5 text-sm mb-8 anim-1"
      >
        <Icon name="arrow_back" size={16} />
        Agent Fleet
      </Link>

      {/* Header */}
      <header className="mb-16 anim-1">
        <h1 className="text-3xl font-thin text-on-surface tracking-tight mb-2">
          Onboard New Agent
        </h1>
        <p className="text-on-surface-variant font-light max-w-lg">
          Define the parameters, cognitive boundaries, and operational
          permissions for the new autonomous node.
        </p>
      </header>

      {/* Runtime Status */}
      <div className="mb-16 anim-2">
        <div className="bg-surface-container ghost p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-bold tracking-widest uppercase text-on-surface">
              Runtime Status
            </h3>
            {isLoadingCatalog ? (
              <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/50">
                Loading...
              </span>
            ) : catalog ? (
              <span
                className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1 rounded-sm ${
                  catalog.available
                    ? "bg-tertiary/15 text-tertiary"
                    : "bg-error/15 text-error"
                }`}
              >
                {catalog.health.status}
              </span>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-widest px-3 py-1 bg-error/15 text-error rounded-sm">
                Offline
              </span>
            )}
          </div>
          {isLoadingCatalog ? (
            <p className="text-sm text-on-surface-variant">Loading OpenClaw catalog...</p>
          ) : catalog ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Binary</p>
                <p className="font-mono text-on-surface">{catalog.health.binaryVersion ?? "Unavailable"}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Gateway</p>
                <p className="font-mono text-on-surface">{catalog.gateway.url ?? "Not configured"}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Config</p>
                <p className="font-mono text-[13px] text-on-surface break-all">{catalog.configPath ?? "Unknown"}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-error">
              {catalogError ?? "Unable to load the runtime catalog."}
            </p>
          )}
        </div>
      </div>

      <form className="space-y-24" onSubmit={handleSubmit}>
        {/* 01 Identity */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 anim-2">
          <div className="md:col-span-4">
            <h2 className="text-sm font-medium text-secondary tracking-widest uppercase mb-2">
              01 Identity
            </h2>
            <p className="text-xs text-on-surface-variant/60 leading-relaxed">
              Public face and designation within the system network.
            </p>
          </div>
          <div className="md:col-span-8 space-y-8">
            <div className="flex items-start gap-8">
              {/* Icon picker */}
              <div className="relative shrink-0" ref={iconPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowIconPicker((value) => !value)}
                  className="w-24 h-24 bg-surface-container-low flex items-center justify-center ghost hover:border-secondary/30 transition-all cursor-pointer group"
                >
                  <Icon
                    name={selectedIcon}
                    size={36}
                    className="text-secondary/70 group-hover:text-secondary transition-colors"
                  />
                </button>
                <div className="absolute -bottom-1 -right-1 bg-secondary text-white w-6 h-6 rounded-full flex items-center justify-center pointer-events-none">
                  <Icon name="edit" size={12} />
                </div>

                {showIconPicker ? (
                  <div className="absolute top-full left-0 mt-2 z-50 bg-surface-container-lowest ghost p-3 w-[280px] shadow-xl">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-3">
                      Select Icon
                    </p>
                    <div className="grid grid-cols-6 gap-1">
                      {agentIcons.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => {
                            setSelectedIcon(icon);
                            setShowIconPicker(false);
                          }}
                          className={`w-10 h-10 flex items-center justify-center rounded-sm transition-all ${
                            selectedIcon === icon
                              ? "bg-secondary/15 text-secondary"
                              : "text-on-surface-variant/60 hover:bg-surface-container-high hover:text-on-surface"
                          }`}
                        >
                          <Icon name={icon} size={20} />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex-1 space-y-6">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                    Agent Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full bg-transparent border-none border-b border-outline-variant/30 py-2 text-on-surface text-lg font-light placeholder:text-on-surface-variant/20 focus:ring-0 focus:outline-none focus:border-secondary transition-colors"
                    style={{ borderBottom: "1px solid rgba(72,72,75,0.3)" }}
                    onFocus={(e) => (e.target.style.borderBottom = "1px solid #7b99ff")}
                    onBlur={(e) => (e.target.style.borderBottom = "1px solid rgba(72,72,75,0.3)")}
                    placeholder="e.g. Research-Lead"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                    Assigned Role
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    className="w-full bg-transparent border-none py-2 text-on-surface font-light placeholder:text-on-surface-variant/20 focus:ring-0 focus:outline-none"
                    style={{ borderBottom: "1px solid rgba(72,72,75,0.3)" }}
                    onFocus={(e) => (e.target.style.borderBottom = "1px solid #7b99ff")}
                    onBlur={(e) => (e.target.style.borderBottom = "1px solid rgba(72,72,75,0.3)")}
                    placeholder="e.g. Lead Technical Researcher"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                    Runtime Agent ID
                  </label>
                  <input
                    type="text"
                    value={runtimeAgentIdInput}
                    onChange={(event) => setRuntimeAgentIdInput(event.target.value)}
                    className="w-full bg-transparent border-none py-2 text-on-surface font-mono text-sm font-light placeholder:text-on-surface-variant/20 focus:ring-0 focus:outline-none"
                    style={{ borderBottom: "1px solid rgba(72,72,75,0.3)" }}
                    onFocus={(e) => (e.target.style.borderBottom = "1px solid #7b99ff")}
                    onBlur={(e) => (e.target.style.borderBottom = "1px solid rgba(72,72,75,0.3)")}
                    placeholder="Auto-derived from agent name"
                    spellCheck={false}
                  />
                  <p className="text-[11px] text-on-surface-variant/50 pt-1">
                    Effective: <span className="font-mono text-on-surface/70">{runtimeAgentId}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 02 Intelligence */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 anim-2">
          <div className="md:col-span-4">
            <h2 className="text-sm font-medium text-secondary tracking-widest uppercase mb-2">
              02 Intelligence
            </h2>
            <p className="text-xs text-on-surface-variant/60 leading-relaxed">
              Configure the cognitive engine and reasoning behavior.
            </p>
          </div>
          <div className="md:col-span-8 space-y-10">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-2">
                System Instructions
              </label>
              <textarea
                value={systemInstructions}
                onChange={(event) => setSystemInstructions(event.target.value)}
                className="w-full bg-surface-container-low border-none p-4 text-on-surface font-light text-sm leading-relaxed resize-y min-h-[120px] focus:ring-0 focus:outline-none placeholder:text-on-surface-variant/20"
                placeholder="Define the core logic, behavioral constraints, and personality of the agent..."
                rows={5}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                  Default Model
                </label>
                <div className="relative">
                  <select
                    value={selectedModelId}
                    onChange={(event) => setSelectedModelId(event.target.value)}
                    className="w-full appearance-none bg-surface-container-low border-none px-4 py-3 text-on-surface text-sm focus:ring-0 focus:outline-none"
                  >
                    {(catalog?.models ?? []).map((model) => (
                      <option key={model.id} value={model.id} disabled={!model.available}>
                        {model.name} {model.available ? "" : "(Unavailable)"}
                      </option>
                    ))}
                  </select>
                  <Icon
                    name="expand_more"
                    size={18}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                    Thinking Level
                  </label>
                  <span className="text-xs text-secondary font-mono">
                    {thinkingLevel}
                  </span>
                </div>
                <div className="flex gap-2">
                  {thinkingLevels.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setThinkingLevel(level)}
                      className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-medium transition-all ${
                        thinkingLevel === level
                          ? "bg-secondary/15 text-secondary"
                          : "bg-surface-container-low text-on-surface-variant/40 hover:text-on-surface-variant"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 03 Runtime Paths */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 anim-3">
          <div className="md:col-span-4">
            <h2 className="text-sm font-medium text-secondary tracking-widest uppercase mb-2">
              03 Runtime
            </h2>
            <p className="text-xs text-on-surface-variant/60 leading-relaxed">
              Workspace and runtime state paths derived from the agent ID.
            </p>
          </div>
          <div className="md:col-span-8">
            <div className="bg-surface-container-low ghost p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                  Path Preview
                </p>
                <button
                  type="button"
                  onClick={() => setShowAdvancedPaths((value) => !value)}
                  className="text-[10px] uppercase tracking-widest text-secondary hover:text-secondary/80 transition-colors"
                >
                  {showAdvancedPaths ? "Hide" : "Override"}
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/50 mb-1">Workspace</p>
                  <p className="font-mono text-[13px] text-on-surface break-all">
                    {previewWorkspacePath || "Waiting for runtime catalog"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/50 mb-1">Runtime State</p>
                  <p className="font-mono text-[13px] text-on-surface break-all">
                    {previewRuntimeStatePath || "Waiting for runtime catalog"}
                  </p>
                </div>
              </div>

              {showAdvancedPaths ? (
                <div className="border-t border-outline-variant/15 pt-4 space-y-4">
                  <div className="flex gap-3 items-end">
                    <label className="flex-1 space-y-1">
                      <span className="text-[10px] uppercase tracking-widest text-on-surface-variant/50">
                        Workspace Override
                      </span>
                      <input
                        type="text"
                        value={workspacePathOverride}
                        onChange={(event) => setWorkspacePathOverride(event.target.value)}
                        className="ghost w-full bg-surface-container px-4 py-2.5 font-mono text-[13px] text-on-surface outline-none"
                        placeholder={catalog?.defaults.workspacePathTemplate}
                        spellCheck={false}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleBrowseWorkspace}
                      disabled={isPickingWorkspace || isSubmitting}
                      className="ghost px-4 py-2.5 text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50"
                    >
                      {isPickingWorkspace ? "Picking..." : "Browse"}
                    </button>
                  </div>
                  <label className="block space-y-1">
                    <span className="text-[10px] uppercase tracking-widest text-on-surface-variant/50">
                      Runtime State Override
                    </span>
                    <input
                      type="text"
                      value={runtimeStatePathOverride}
                      onChange={(event) => setRuntimeStatePathOverride(event.target.value)}
                      className="ghost w-full bg-surface-container px-4 py-2.5 font-mono text-[13px] text-on-surface outline-none"
                      placeholder={catalog?.defaults.runtimeStatePathTemplate}
                      spellCheck={false}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* 04 Workspace Files */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 anim-3">
          <div className="md:col-span-4">
            <h2 className="text-sm font-medium text-secondary tracking-widest uppercase mb-2">
              04 Workspace Files
            </h2>
            <p className="text-xs text-on-surface-variant/60 leading-relaxed">
              Identity and behavior files synced to the OpenClaw workspace.
            </p>
          </div>
          <div className="md:col-span-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                  Persona / SOUL.md
                </span>
                <textarea
                  value={personaText}
                  onChange={(event) => setPersonaText(event.target.value)}
                  className="w-full bg-surface-container-low border-none p-4 text-on-surface font-light text-sm leading-relaxed resize-y min-h-[100px] focus:ring-0 focus:outline-none placeholder:text-on-surface-variant/20"
                  placeholder="Reasoning style, personality..."
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                  Tools / TOOLS.md
                </span>
                <textarea
                  value={toolsText}
                  onChange={(event) => setToolsText(event.target.value)}
                  className="w-full bg-surface-container-low border-none p-4 text-on-surface font-light text-sm leading-relaxed resize-y min-h-[100px] focus:ring-0 focus:outline-none placeholder:text-on-surface-variant/20"
                  placeholder="Tool safety rules, operating limits..."
                />
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                  User Context / USER.md
                </span>
                <textarea
                  value={userContextText}
                  onChange={(event) => setUserContextText(event.target.value)}
                  className="w-full bg-surface-container-low border-none p-4 text-on-surface font-light text-sm leading-relaxed resize-y min-h-[100px] focus:ring-0 focus:outline-none placeholder:text-on-surface-variant/20"
                  placeholder="Environment notes, preferences..."
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                  Identity / IDENTITY.md
                </span>
                <textarea
                  value={identityText}
                  onChange={(event) => setIdentityText(event.target.value)}
                  className="w-full bg-surface-container-low border-none p-4 text-on-surface font-light text-sm leading-relaxed resize-y min-h-[100px] focus:ring-0 focus:outline-none placeholder:text-on-surface-variant/20"
                  placeholder={"- Name: Research Lead\n- Vibe: calm, rigorous, precise\n- Emoji: 🔬\n- Avatar: avatars/research-lead.png"}
                />
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                  Heartbeat / HEARTBEAT.md
                </span>
                <textarea
                  value={heartbeatText}
                  onChange={(event) => setHeartbeatText(event.target.value)}
                  className="w-full bg-surface-container-low border-none p-4 text-on-surface font-light text-sm leading-relaxed resize-y min-h-[80px] focus:ring-0 focus:outline-none placeholder:text-on-surface-variant/20"
                  placeholder="Automation or check-in instructions..."
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                  Memory / MEMORY.md
                </span>
                <textarea
                  value={memoryText}
                  onChange={(event) => setMemoryText(event.target.value)}
                  className="w-full bg-surface-container-low border-none p-4 text-on-surface font-light text-sm leading-relaxed resize-y min-h-[80px] focus:ring-0 focus:outline-none placeholder:text-on-surface-variant/20"
                  placeholder="Durable operating notes..."
                />
              </label>
            </div>
          </div>
        </section>

        {/* Error */}
        {errorMessage || catalogError ? (
          <div className="border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {errorMessage ?? catalogError}
          </div>
        ) : null}

        {/* Action Footer */}
        <div className="pt-12 ghost-t flex flex-col md:flex-row items-center justify-between gap-6 anim-4">
          <p className="text-[10px] text-on-surface-variant/40 max-w-sm">
            By finalizing onboarding, you confirm this agent adheres to the
            Nova Protocol safety standards and alignment requirements.
          </p>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Link
              href="/agents"
              className="flex-1 md:flex-none px-8 py-3 rounded-sm text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-all text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingCatalog || !catalog?.available}
              className="flex-1 md:flex-none px-8 py-3 rounded-sm text-sm font-medium bg-primary text-on-primary hover:opacity-80 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Provisioning..." : "Deploy Agent"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
