"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import {
  ApiError,
  type ApiAgent,
  type ApiClaudeCatalog,
  type ApiCodexCatalog,
  type ApiOpenClawCatalog,
  type PatchAgentInput,
  type ApiThinkingLevel,
  getClaudeCatalog,
  getCodexCatalog,
  getOpenClawCatalog,
  patchAgent,
} from "@/lib/api";
import {
  formatThinkingLevelLabelForRuntime,
  getThinkingOptionsForRuntime,
  normalizeThinkingLevelForRuntime,
} from "@/lib/runtime-thinking";

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

const agentStatuses: Array<ApiAgent["status"]> = [
  "idle",
  "paused",
  "offline",
  "error",
  "working",
];

export function EditAgentForm({ agent }: { agent: ApiAgent }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<
    ApiOpenClawCatalog | ApiCodexCatalog | ApiClaudeCatalog | null
  >(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [selectedIcon, setSelectedIcon] = useState(agent.avatar || "smart_toy");
  const [status, setStatus] = useState<ApiAgent["status"]>(agent.status);
  const [systemInstructions, setSystemInstructions] = useState(agent.systemInstructions);
  const [personaText, setPersonaText] = useState(agent.personaText ?? "");
  const [userContextText, setUserContextText] = useState(agent.userContextText ?? "");
  const [identityText, setIdentityText] = useState(agent.identityText ?? "");
  const [toolsText, setToolsText] = useState(agent.toolsText ?? "");
  const [heartbeatText, setHeartbeatText] = useState(agent.heartbeatText ?? "");
  const [memoryText, setMemoryText] = useState(agent.memoryText ?? "");
  const [thinkingLevel, setThinkingLevel] = useState<ApiThinkingLevel>(
    normalizeThinkingLevelForRuntime(
      agent.runtime.kind,
      agent.runtime.defaultThinkingLevel
    )
  );
  const [selectedModelId, setSelectedModelId] = useState(
    agent.runtime.defaultModelId ?? ""
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconPickerRef = useRef<HTMLDivElement>(null);
  const thinkingOptions = getThinkingOptionsForRuntime(agent.runtime.kind);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setIsLoadingCatalog(true);

      try {
        const nextCatalog =
          agent.runtime.kind === "codex"
            ? await getCodexCatalog()
            : agent.runtime.kind === "claude-code"
              ? await getClaudeCatalog()
              : await getOpenClawCatalog();

        if (cancelled) {
          return;
        }

        setCatalog(nextCatalog);
        setCatalogError(null);
        setSelectedModelId((currentValue) => {
          if (
            currentValue &&
            nextCatalog.models.some((model) => model.id === currentValue)
          ) {
            return currentValue;
          }

          return (
            agent.runtime.defaultModelId ??
            nextCatalog.defaults.defaultModelId ??
            nextCatalog.models.find((model) => model.available)?.id ??
            ""
          );
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setCatalogError(
          error instanceof ApiError
            ? error.message
            : "Unable to load the runtime catalog."
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
  }, [agent.runtime.defaultModelId, agent.runtime.kind]);

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Agent name is required.");
      return;
    }

    if (!role.trim()) {
      setErrorMessage("Assigned role is required.");
      return;
    }

    if (!selectedModelId) {
      setErrorMessage("Select a default model.");
      return;
    }

    setIsSubmitting(true);

    try {
      const nextName = name.trim();
      const nextRole = role.trim();
      const nextSystemInstructions = systemInstructions.trim();
      const nextPersonaText = personaText.trim() || null;
      const nextUserContextText = userContextText.trim() || null;
      const nextIdentityText = identityText.trim() || null;
      const nextToolsText = toolsText.trim() || null;
      const nextHeartbeatText = heartbeatText.trim() || null;
      const nextMemoryText = memoryText.trim() || null;
      const patch: PatchAgentInput = {};

      if (nextName !== agent.name) {
        patch.name = nextName;
      }

      if (nextRole !== agent.role) {
        patch.role = nextRole;
      }

      if (selectedIcon !== (agent.avatar || "smart_toy")) {
        patch.avatar = selectedIcon;
      }

      if (status !== agent.status) {
        patch.status = status;
      }

      if (nextSystemInstructions !== agent.systemInstructions) {
        patch.systemInstructions = nextSystemInstructions;
      }

      if (nextPersonaText !== agent.personaText) {
        patch.personaText = nextPersonaText;
      }

      if (nextUserContextText !== agent.userContextText) {
        patch.userContextText = nextUserContextText;
      }

      if (nextIdentityText !== agent.identityText) {
        patch.identityText = nextIdentityText;
      }

      if (nextToolsText !== agent.toolsText) {
        patch.toolsText = nextToolsText;
      }

      if (nextHeartbeatText !== agent.heartbeatText) {
        patch.heartbeatText = nextHeartbeatText;
      }

      if (nextMemoryText !== agent.memoryText) {
        patch.memoryText = nextMemoryText;
      }

      if (
        selectedModelId !== (agent.runtime.defaultModelId ?? "") ||
        thinkingLevel !== agent.runtime.defaultThinkingLevel
      ) {
        patch.runtime = {};

        if (selectedModelId !== (agent.runtime.defaultModelId ?? "")) {
          patch.runtime.defaultModelId = selectedModelId;
        }

        if (thinkingLevel !== agent.runtime.defaultThinkingLevel) {
          patch.runtime.defaultThinkingLevel = thinkingLevel;
        }
      }

      const updatedAgent = await patchAgent(agent.id, patch);

      router.push(`/agents/${updatedAgent.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to save the agent right now."
      );
      setIsSubmitting(false);
    }
  }

  const modelOptions = catalog?.models ?? [];
  const hasSelectedModel =
    Boolean(selectedModelId) &&
    modelOptions.some((model) => model.id === selectedModelId);
  const runtimeLabel =
    agent.runtime.kind === "codex"
      ? "Codex"
      : agent.runtime.kind === "claude-code"
        ? "Claude Code"
        : "OpenClaw";

  return (
    <div className="mx-auto max-w-5xl py-12">
      <Link
        href={`/agents/${agent.id}`}
        className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5 text-sm mb-8 anim-1"
      >
        <Icon name="arrow_back" size={16} />
        {agent.name}
      </Link>

      <header className="mb-16 anim-1">
        <div className="flex items-center gap-3 mb-3">
          <span className="font-mono text-[10px] text-on-surface-variant/40 uppercase tracking-widest">
            {agent.runtime.runtimeAgentId}
          </span>
        </div>
        <h1 className="text-4xl font-light tracking-tight text-on-surface mb-3">
          Edit Agent
        </h1>
        <p className="text-on-surface-variant text-base leading-relaxed max-w-2xl">
          Update the agent’s role, runtime defaults, and workspace files.
          Runtime identity and paths cannot be changed after creation.
        </p>
      </header>

      <div className="mb-16 anim-2">
        <div className="bg-surface-container ghost p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-bold tracking-widest uppercase text-on-surface">
              Runtime Binding
            </h3>
            <span className="font-mono text-[10px] uppercase tracking-widest px-3 py-1 rounded-sm bg-secondary/15 text-secondary">
              {agent.runtime.kind}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">
                Runtime Agent ID
              </p>
              <p className="font-mono text-on-surface break-all">
                {agent.runtime.runtimeAgentId}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">
                Workspace
              </p>
              <p className="font-mono text-[13px] text-on-surface break-all">
                {agent.runtime.workspacePath}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">
                Runtime State
              </p>
              <p className="font-mono text-[13px] text-on-surface break-all">
                {agent.runtime.runtimeStatePath}
              </p>
            </div>
          </div>
        </div>
      </div>

      <form className="space-y-24" onSubmit={handleSubmit}>
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 anim-2">
          <div className="md:col-span-4">
            <h2 className="text-sm font-medium text-secondary tracking-widest uppercase mb-2">
              01 Identity
            </h2>
            <p className="text-xs text-on-surface-variant/60 leading-relaxed">
              Name, role, and icon for this agent.
            </p>
          </div>
          <div className="md:col-span-8 space-y-8">
            <div className="flex items-start gap-8">
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
                    className="w-full bg-transparent border-none border-b border-outline-variant/30 py-2 text-on-surface font-light placeholder:text-on-surface-variant/20 focus:ring-0 focus:outline-none focus:border-secondary transition-colors"
                    placeholder="e.g. Lead Technical Researcher"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <label className="space-y-1">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                      Agent Status
                    </span>
                    <div className="relative">
                      <select
                        value={status}
                        onChange={(event) =>
                          setStatus(event.target.value as ApiAgent["status"])
                        }
                        className="w-full appearance-none bg-surface-container-low border-none px-4 py-3 text-on-surface text-sm focus:ring-0 focus:outline-none"
                      >
                        {agentStatuses.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <Icon
                        name="expand_more"
                        size={18}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                      />
                    </div>
                  </label>
                  <div className="space-y-1">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                      Last Synced
                    </span>
                    <div className="bg-surface-container-low px-4 py-3 text-sm text-on-surface font-mono">
                      {agent.lastSyncedAt
                        ? new Intl.DateTimeFormat("en", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          }).format(new Date(agent.lastSyncedAt))
                        : "Never"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 anim-2">
          <div className="md:col-span-4">
            <h2 className="text-sm font-medium text-secondary tracking-widest uppercase mb-2">
              02 Intelligence
            </h2>
            <p className="text-xs text-on-surface-variant/60 leading-relaxed">
              Tune the model defaults and directive set used for future runs.
            </p>
          </div>
          <div className="md:col-span-8 space-y-10">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-2">
                Directive / AGENTS.md
              </label>
              <textarea
                value={systemInstructions}
                onChange={(event) => setSystemInstructions(event.target.value)}
                className="w-full bg-surface-container-low border-none p-4 text-on-surface font-light text-sm leading-relaxed resize-y min-h-[120px] focus:ring-0 focus:outline-none placeholder:text-on-surface-variant/20"
                placeholder="Define the core logic, behavioral constraints, and directive set of the agent..."
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
                    {!hasSelectedModel && selectedModelId ? (
                      <option value={selectedModelId}>{selectedModelId}</option>
                    ) : null}
                    {modelOptions.map((model) => (
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
                {catalogError ? (
                  <p className="text-xs text-on-surface-variant/60">
                    {catalogError}
                  </p>
                ) : isLoadingCatalog ? (
                  <p className="text-xs text-on-surface-variant/60">
                    Loading {runtimeLabel} models...
                  </p>
                ) : null}
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                    Thinking Level
                  </label>
                  <span className="text-xs text-secondary font-mono">
                    {formatThinkingLevelLabelForRuntime(
                      agent.runtime.kind,
                      thinkingLevel
                    )}
                  </span>
                </div>
                <div className="flex gap-2">
                  {thinkingOptions.map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setThinkingLevel(level.value)}
                      className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-medium transition-all ${
                        thinkingLevel === level.value
                          ? "bg-secondary/15 text-secondary"
                          : "bg-surface-container-low text-on-surface-variant/40 hover:text-on-surface-variant"
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 anim-3">
          <div className="md:col-span-4">
            <h2 className="text-sm font-medium text-secondary tracking-widest uppercase mb-2">
              03 Workspace Files
            </h2>
            <p className="text-xs text-on-surface-variant/60 leading-relaxed">
              These values sync into the {runtimeLabel} workspace on save.
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
                  placeholder={"- Name: Research Lead\n- Tone: calm, rigorous, precise"}
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

        {errorMessage ? (
          <div className="border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {errorMessage}
          </div>
        ) : null}

        <div className="pt-12 ghost-t flex flex-col md:flex-row items-center justify-between gap-6 anim-4">
          <p className="text-[10px] text-on-surface-variant/40 max-w-md">
            Saving will patch the Nova agent record and resync the bound OpenClaw
            workspace files for future runs.
          </p>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Link
              href={`/agents/${agent.id}`}
              className="flex-1 md:flex-none px-8 py-3 rounded-sm text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-all text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingCatalog}
              className="flex-1 md:flex-none px-8 py-3 rounded-sm text-sm font-medium bg-primary text-on-primary hover:opacity-80 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Agent"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
