"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import {
  type ApiClaudeCatalog,
  type ApiClaudeConfigSnapshot,
  ApiError,
  type ApiCodexCatalog,
  type ApiCodexConfigSnapshot,
  type ApiOpenClawCatalog,
  type ApiOpenClawConfigSnapshot,
  type ApiRuntimeKind,
  type ApiThinkingLevel,
  createAgent,
  getClaudeCatalog,
  getClaudeConfig,
  getCodexCatalog,
  getCodexConfig,
  getOpenClawCatalog,
  getOpenClawConfig,
  selectDirectory,
} from "@/lib/api";
import {
  formatThinkingLevelLabelForRuntime,
  getThinkingOptionsForRuntime,
} from "@/lib/runtime-thinking";

/* ── Constants ── */

type RuntimeOption = "openclaw" | "codex" | "claude";

type RuntimeMeta = {
  id: RuntimeOption;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  features: string[];
  accent: string;
  apiKind: ApiRuntimeKind;
};

const runtimeOptions: RuntimeMeta[] = [
  {
    id: "openclaw",
    name: "OpenClaw",
    icon: "terminal",
    tagline: "Local execution runtime",
    description:
      "Execute agent tasks locally using the OpenClaw CLI with built-in workspace sync and run history.",
    features: ["Local execution", "Workspace sync", "Run history", "Gateway support"],
    accent: "tertiary",
    apiKind: "openclaw-native",
  },
  {
    id: "codex",
    name: "Codex",
    icon: "code",
    tagline: "OpenAI-powered runtime",
    description:
      "Execute agent tasks using the Codex CLI, authenticated through your local ChatGPT account.",
    features: ["Local execution", "Sandbox mode", "ChatGPT auth", "Workspace sync"],
    accent: "secondary",
    apiKind: "codex",
  },
  {
    id: "claude",
    name: "Claude Code",
    icon: "cloud",
    tagline: "Anthropic-powered runtime",
    description:
      "Execute agent tasks using the Claude Code CLI, authenticated through your local Anthropic account.",
    features: ["Local execution", "Workspace sync", "Claude auth", "Sandbox mode"],
    accent: "secondary",
    apiKind: "claude-code",
  },
];

const agentIcons = [
  "smart_toy", "terminal", "code", "hub", "memory", "psychology",
  "analytics", "bolt", "security", "explore", "rocket_launch", "model_training",
];

const openclawThinkingOptions = getThinkingOptionsForRuntime("openclaw-native");
const codexThinkingOptions = getThinkingOptionsForRuntime("codex");
const claudeThinkingOptions = getThinkingOptionsForRuntime("claude-code");

function slugifyAgentId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

function applyAgentIdTemplate(template: string, runtimeAgentId: string) {
  return template.replace("<agentId>", runtimeAgentId || "new-agent");
}

/* ── Step indicator ── */

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div key={step} className="flex items-center gap-3">
            {i > 0 && (
              <div
                className={`h-px w-8 transition-colors ${
                  isDone ? "bg-secondary/40" : "bg-outline-variant/15"
                }`}
              />
            )}
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-all ${
                isActive
                  ? "bg-secondary text-white"
                  : isDone
                    ? "bg-secondary/15 text-secondary"
                    : "bg-surface-container-high/40 text-on-surface-variant/30"
              }`}
            >
              {isDone ? <Icon name="check" size={14} /> : step}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Step 1: Runtime Selection ── */

function RuntimeSelectionStep({
  onSelect,
  runtimeEnabled,
}: {
  onSelect: (runtime: RuntimeOption) => void;
  runtimeEnabled: Record<RuntimeOption, boolean | null>;
}) {
  const [hovered, setHovered] = useState<RuntimeOption | null>(null);

  return (
    <div className="anim-2">
      <div className="mb-8">
        <h2 className="text-lg font-semibold tracking-tight text-on-surface mb-1">
          Choose execution runtime
        </h2>
        <p className="text-[13px] text-on-surface-variant/40">
          Select the runtime environment this agent will use to execute tasks.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {runtimeOptions.map((rt) => {
          const isHovered = hovered === rt.id;
          const isDisabled = runtimeEnabled[rt.id] === false;
          return (
            <button
              key={rt.id}
              type="button"
              onClick={() => {
                if (!isDisabled) {
                  onSelect(rt.id);
                }
              }}
              onMouseEnter={() => setHovered(rt.id)}
              onMouseLeave={() => setHovered(null)}
              disabled={isDisabled}
              className={`group relative overflow-hidden rounded-xl bg-surface-container-low ghost p-6 text-left transition-all duration-200 ${
                isDisabled
                  ? "cursor-not-allowed opacity-45"
                  : "hover:bg-surface-container-low/80"
              } ${isHovered && !isDisabled ? "shadow-lg shadow-black/10" : ""}
              }`}
            >
              {/* Top accent glow on hover */}
              <div
                className={`absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent to-transparent transition-opacity duration-300 ${
                  isHovered ? "opacity-100" : "opacity-0"
                } ${rt.accent === "tertiary" ? "via-tertiary/40" : "via-secondary/40"}`}
              />

              <div className="mb-5 flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
                    rt.accent === "tertiary"
                      ? "bg-tertiary/8 group-hover:bg-tertiary/12"
                      : "bg-secondary/8 group-hover:bg-secondary/12"
                  }`}
                >
                  <Icon
                    name={rt.icon}
                    size={22}
                    className={
                      rt.accent === "tertiary"
                        ? "text-tertiary/75"
                        : "text-secondary/75"
                    }
                  />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold tracking-tight text-on-surface">
                    {rt.name}
                  </h3>
                  <p className="text-[11px] text-on-surface-variant/35">{rt.tagline}</p>
                </div>
              </div>

              <p className="mb-5 text-[13px] leading-relaxed text-on-surface-variant/45">
                {rt.description}
              </p>

              <div className="mb-5 flex flex-wrap gap-1.5">
                {rt.features.map((f) => (
                  <span
                    key={f}
                    className="rounded-md bg-surface-container-high/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-on-surface-variant/30"
                  >
                    {f}
                  </span>
                ))}
              </div>

              {isDisabled ? (
                <div className="text-[12px] font-medium text-error/80">
                  Disabled in runtime settings
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[12px] font-medium text-secondary opacity-0 transition-opacity group-hover:opacity-100">
                  <span>Select runtime</span>
                  <Icon name="arrow_forward" size={14} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Shared form components ── */

function FormSection({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-12 gap-8">
      <div className="md:col-span-4">
        <h2 className="text-sm font-medium text-secondary tracking-widest uppercase mb-2">
          {step} {title}
        </h2>
        <p className="text-xs text-on-surface-variant/60 leading-relaxed">{description}</p>
      </div>
      <div className="md:col-span-8">{children}</div>
    </section>
  );
}

function UnderlineInput({
  value,
  onChange,
  placeholder,
  mono,
  large,
  spellCheck,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  mono?: boolean;
  large?: boolean;
  spellCheck?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-transparent border-none py-2 text-on-surface font-light placeholder:text-on-surface-variant/20 focus:ring-0 focus:outline-none ${
        mono ? "font-mono text-sm" : ""
      } ${large ? "text-lg" : ""}`}
      style={{ borderBottom: "1px solid rgba(72,72,75,0.3)" }}
      onFocus={(e) => (e.target.style.borderBottom = "1px solid #7b99ff")}
      onBlur={(e) => (e.target.style.borderBottom = "1px solid rgba(72,72,75,0.3)")}
      placeholder={placeholder}
      spellCheck={spellCheck ?? undefined}
    />
  );
}

/* ── Identity section (shared across runtimes) ── */

function IdentitySection({
  name, setName, role, setRole, selectedIcon, setSelectedIcon,
  runtimeAgentIdInput, setRuntimeAgentIdInput, runtimeAgentId,
}: {
  name: string; setName: (v: string) => void;
  role: string; setRole: (v: string) => void;
  selectedIcon: string; setSelectedIcon: (v: string) => void;
  runtimeAgentIdInput: string; setRuntimeAgentIdInput: (v: string) => void;
  runtimeAgentId: string;
}) {
  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconPickerRef = useRef<HTMLDivElement>(null);

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

  return (
    <FormSection step="01" title="Identity" description="Name, role, and icon for this agent.">
      <div className="flex items-start gap-8">
        <div className="relative shrink-0" ref={iconPickerRef}>
          <button
            type="button"
            onClick={() => setShowIconPicker((v) => !v)}
            className="w-24 h-24 bg-surface-container-low flex items-center justify-center ghost hover:border-secondary/30 transition-all cursor-pointer group"
          >
            <Icon name={selectedIcon} size={36} className="text-secondary/70 group-hover:text-secondary transition-colors" />
          </button>
          <div className="absolute -bottom-1 -right-1 bg-secondary text-white w-6 h-6 rounded-full flex items-center justify-center pointer-events-none">
            <Icon name="edit" size={12} />
          </div>
          {showIconPicker && (
            <div className="absolute top-full left-0 mt-2 z-50 bg-surface-container-lowest ghost p-3 w-[280px] shadow-xl">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-3">Select Icon</p>
              <div className="grid grid-cols-6 gap-1">
                {agentIcons.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => { setSelectedIcon(icon); setShowIconPicker(false); }}
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
          )}
        </div>
        <div className="flex-1 space-y-6">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Agent Name</label>
            <UnderlineInput value={name} onChange={setName} placeholder="e.g. Research-Lead" large />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Assigned Role</label>
            <UnderlineInput value={role} onChange={setRole} placeholder="e.g. Lead Technical Researcher" />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Runtime Agent ID</label>
            <UnderlineInput value={runtimeAgentIdInput} onChange={setRuntimeAgentIdInput} placeholder="Auto-derived from agent name" mono spellCheck={false} />
            <p className="text-[11px] text-on-surface-variant/50 pt-1">
              Effective: <span className="font-mono text-on-surface/70">{runtimeAgentId}</span>
            </p>
          </div>
        </div>
      </div>
    </FormSection>
  );
}

function WorkspaceFilesSection({
  personaText,
  setPersonaText,
  toolsText,
  setToolsText,
  userContextText,
  setUserContextText,
  identityText,
  setIdentityText,
  heartbeatText,
  setHeartbeatText,
  memoryText,
  setMemoryText,
  runtimeLabel,
}: {
  personaText: string;
  setPersonaText: (v: string) => void;
  toolsText: string;
  setToolsText: (v: string) => void;
  userContextText: string;
  setUserContextText: (v: string) => void;
  identityText: string;
  setIdentityText: (v: string) => void;
  heartbeatText: string;
  setHeartbeatText: (v: string) => void;
  memoryText: string;
  setMemoryText: (v: string) => void;
  runtimeLabel: string;
}) {
  return (
    <FormSection
      step="04"
      title="Workspace Files"
      description={`Identity and behavior files Nova will sync into the ${runtimeLabel} workspace.`}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {[
            {
              label: "Persona / SOUL.md",
              value: personaText,
              set: setPersonaText,
              ph: "Reasoning style, personality, collaboration tone...",
            },
            {
              label: "Tools / TOOLS.md",
              value: toolsText,
              set: setToolsText,
              ph: "Tool safety rules, repo boundaries, operating limits...",
            },
            {
              label: "User Context / USER.md",
              value: userContextText,
              set: setUserContextText,
              ph: "Environment notes, user preferences, local setup details...",
            },
            {
              label: "Identity / IDENTITY.md",
              value: identityText,
              set: setIdentityText,
              ph: "- Name: Research Lead\n- Tone: calm, rigorous",
            },
            {
              label: "Heartbeat / HEARTBEAT.md",
              value: heartbeatText,
              set: setHeartbeatText,
              ph: "Automation or check-in instructions...",
            },
            {
              label: "Memory / MEMORY.md",
              value: memoryText,
              set: setMemoryText,
              ph: "Durable operating notes...",
            },
          ].map((f) => (
            <label key={f.label} className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                {f.label}
              </span>
              <textarea
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className="min-h-[100px] w-full resize-y border-none bg-surface-container-low p-4 text-sm font-light leading-relaxed text-on-surface placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-0"
                placeholder={f.ph}
              />
            </label>
          ))}
        </div>
      </div>
    </FormSection>
  );
}

/* ── OpenClaw agent form ── */

function OpenClawAgentForm({
  onBack,
  runtimeConfig,
}: {
  onBack: () => void;
  runtimeConfig: ApiOpenClawConfigSnapshot | null;
}) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<ApiOpenClawCatalog | null>(null);
  const [config, setConfig] = useState<ApiOpenClawConfigSnapshot | null>(runtimeConfig);
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickingWorkspace, setIsPickingWorkspace] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      setIsLoadingCatalog(true);
      try {
        const [nextCatalog, nextConfig] = await Promise.all([
          getOpenClawCatalog(),
          getOpenClawConfig(),
        ]);
        if (cancelled) return;
        setCatalog(nextCatalog);
        setConfig(nextConfig);
        setCatalogError(null);
        setSelectedModelId(
          nextCatalog.defaults.defaultModelId ??
            nextCatalog.models.find((m) => m.available)?.id ?? ""
        );
      } catch (error) {
        if (cancelled) return;
        setCatalogError(
          error instanceof ApiError ? error.message : "Unable to load the OpenClaw runtime catalog."
        );
      } finally {
        if (!cancelled) setIsLoadingCatalog(false);
      }
    }
    void loadCatalog();
    return () => { cancelled = true; };
  }, []);

  const runtimeAgentId = slugifyAgentId(runtimeAgentIdInput) || slugifyAgentId(name) || "new-agent";
  const previewWorkspacePath = !catalog
    ? workspacePathOverride
    : workspacePathOverride || applyAgentIdTemplate(catalog.defaults.workspacePathTemplate, runtimeAgentId);
  const previewRuntimeStatePath = !catalog
    ? runtimeStatePathOverride
    : runtimeStatePathOverride || applyAgentIdTemplate(catalog.defaults.runtimeStatePathTemplate, runtimeAgentId);

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
      setErrorMessage(error instanceof ApiError ? error.message : "Unable to open the directory picker.");
    } finally {
      setIsPickingWorkspace(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!catalog) { setErrorMessage("OpenClaw catalog has not finished loading."); return; }
    if (config?.enabled === false) { setErrorMessage("OpenClaw is disabled in runtime settings."); return; }
    if (!catalog.available) { setErrorMessage("OpenClaw is not available. Fix the runtime health first."); return; }
    if (!name.trim()) { setErrorMessage("Agent name is required."); return; }
    if (!role.trim()) { setErrorMessage("Assigned role is required."); return; }
    if (!runtimeAgentId) { setErrorMessage("Runtime agent id could not be generated."); return; }
    if (!selectedModelId) { setErrorMessage("Select a default model."); return; }

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
        error instanceof ApiError ? error.message : "Unable to create the agent. Confirm the backend is running and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-24 anim-2" onSubmit={handleSubmit}>
      {/* Runtime badge */}
      <div className="flex items-center gap-3 rounded-lg bg-tertiary/6 px-4 py-3 ghost">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-tertiary/10">
          <Icon name="terminal" size={16} className="text-tertiary/75" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-medium text-on-surface">OpenClaw Runtime</p>
          <p className="text-[11px] text-on-surface-variant/40">
            {isLoadingCatalog
              ? "Loading catalog..."
              : config?.enabled === false
                ? "Disabled in runtime settings"
              : catalog
                ? `${catalog.health.status === "healthy" ? "Connected" : "Not connected"} · ${catalog.models.length} models available`
                : "Offline"}
          </p>
        </div>
        {!isLoadingCatalog && catalog && (
          <div className={`h-2 w-2 rounded-full ${catalog.health.status === "healthy" ? "bg-tertiary shadow-[0_0_6px_rgba(209,255,215,0.3)]" : "bg-error"}`} />
        )}
      </div>

      {/* 01 Identity */}
      <IdentitySection
        name={name} setName={setName}
        role={role} setRole={setRole}
        selectedIcon={selectedIcon} setSelectedIcon={setSelectedIcon}
        runtimeAgentIdInput={runtimeAgentIdInput} setRuntimeAgentIdInput={setRuntimeAgentIdInput}
        runtimeAgentId={runtimeAgentId}
      />

      {/* 02 Intelligence */}
      <FormSection step="02" title="Intelligence" description="Choose the model and reasoning level.">
        <div className="space-y-10">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-2">Directive / AGENTS.md</label>
            <textarea
              value={systemInstructions}
              onChange={(e) => setSystemInstructions(e.target.value)}
              className="w-full bg-surface-container-low border-none p-4 text-on-surface font-light text-sm leading-relaxed resize-y min-h-[120px] focus:ring-0 focus:outline-none placeholder:text-on-surface-variant/20"
              placeholder="System instructions that guide how this agent behaves..."
              rows={5}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Default Model</label>
              <div className="relative">
                <select
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  className="w-full appearance-none bg-surface-container-low border-none px-4 py-3 text-on-surface text-sm focus:ring-0 focus:outline-none"
                >
                  {(catalog?.models ?? []).map((model) => (
                    <option key={model.id} value={model.id} disabled={!model.available}>
                      {model.name} {model.available ? "" : "(Unavailable)"}
                    </option>
                  ))}
                </select>
                <Icon name="expand_more" size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Thinking Level</label>
                <span className="text-xs text-secondary font-mono">
                  {formatThinkingLevelLabelForRuntime("openclaw-native", thinkingLevel)}
                </span>
              </div>
              <div className="flex gap-2">
                {openclawThinkingOptions.map((level) => (
                  <button
                    key={level.value} type="button" onClick={() => setThinkingLevel(level.value)}
                    className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-medium transition-all ${
                      thinkingLevel === level.value ? "bg-secondary/15 text-secondary" : "bg-surface-container-low text-on-surface-variant/40 hover:text-on-surface-variant"
                    }`}
                  >{level.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </FormSection>

      {/* 03 Runtime Paths */}
      <FormSection step="03" title="Runtime" description="File paths for the agent workspace and state.">
        <div className="bg-surface-container-low ghost p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Path Preview</p>
            <button type="button" onClick={() => setShowAdvancedPaths((v) => !v)} className="text-[10px] uppercase tracking-widest text-secondary hover:text-secondary/80 transition-colors">
              {showAdvancedPaths ? "Hide" : "Override"}
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/50 mb-1">Workspace</p>
              <p className="font-mono text-[13px] text-on-surface break-all">{previewWorkspacePath || "Waiting for runtime catalog"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/50 mb-1">Runtime State</p>
              <p className="font-mono text-[13px] text-on-surface break-all">{previewRuntimeStatePath || "Waiting for runtime catalog"}</p>
            </div>
          </div>
          {showAdvancedPaths && (
            <div className="border-t border-outline-variant/15 pt-4 space-y-4">
              <div className="flex gap-3 items-end">
                <label className="flex-1 space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-on-surface-variant/50">Workspace Override</span>
                  <input type="text" value={workspacePathOverride} onChange={(e) => setWorkspacePathOverride(e.target.value)}
                    className="ghost w-full bg-surface-container px-4 py-2.5 font-mono text-[13px] text-on-surface outline-none"
                    placeholder={catalog?.defaults.workspacePathTemplate} spellCheck={false} />
                </label>
                <button type="button" onClick={handleBrowseWorkspace} disabled={isPickingWorkspace || isSubmitting}
                  className="ghost px-4 py-2.5 text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50">
                  {isPickingWorkspace ? "Picking..." : "Browse"}
                </button>
              </div>
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-widest text-on-surface-variant/50">Runtime State Override</span>
                <input type="text" value={runtimeStatePathOverride} onChange={(e) => setRuntimeStatePathOverride(e.target.value)}
                  className="ghost w-full bg-surface-container px-4 py-2.5 font-mono text-[13px] text-on-surface outline-none"
                  placeholder={catalog?.defaults.runtimeStatePathTemplate} spellCheck={false} />
              </label>
            </div>
          )}
        </div>
      </FormSection>

      <WorkspaceFilesSection
        personaText={personaText}
        setPersonaText={setPersonaText}
        toolsText={toolsText}
        setToolsText={setToolsText}
        userContextText={userContextText}
        setUserContextText={setUserContextText}
        identityText={identityText}
        setIdentityText={setIdentityText}
        heartbeatText={heartbeatText}
        setHeartbeatText={setHeartbeatText}
        memoryText={memoryText}
        setMemoryText={setMemoryText}
        runtimeLabel="OpenClaw"
      />

      {/* Error */}
      {(errorMessage || catalogError) && (
        <div className="border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {errorMessage ?? catalogError}
        </div>
      )}

      {/* Footer */}
      <div className="pt-12 ghost-t flex flex-col md:flex-row items-center justify-between gap-6">
        <button type="button" onClick={onBack}
          className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
          <Icon name="arrow_back" size={16} /> Change runtime
        </button>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Link href="/agents" className="flex-1 md:flex-none px-8 py-3 rounded-sm text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-all text-center">
            Cancel
          </Link>
          <button type="submit" disabled={isSubmitting || isLoadingCatalog || !catalog?.available || config?.enabled === false}
            className="flex-1 md:flex-none px-8 py-3 rounded-sm text-sm font-medium bg-primary text-on-primary hover:opacity-80 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
            {isSubmitting ? "Creating..." : "Create Agent"}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ── Codex agent form ── */

function CodexAgentForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<ApiCodexCatalog | null>(null);
  const [config, setConfig] = useState<ApiCodexConfigSnapshot | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("code");
  const [runtimeAgentIdInput, setRuntimeAgentIdInput] = useState("");
  const [systemInstructions, setSystemInstructions] = useState("");
  const [personaText, setPersonaText] = useState("");
  const [userContextText, setUserContextText] = useState("");
  const [identityText, setIdentityText] = useState("");
  const [toolsText, setToolsText] = useState("");
  const [heartbeatText, setHeartbeatText] = useState("");
  const [memoryText, setMemoryText] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [sandboxMode, setSandboxMode] = useState<"off" | "docker" | "other">("off");
  const [workspacePathOverride, setWorkspacePathOverride] = useState("");
  const [runtimeStatePathOverride, setRuntimeStatePathOverride] = useState("");
  const [showAdvancedPaths, setShowAdvancedPaths] = useState(false);
  const [thinkingLevel, setThinkingLevel] = useState<ApiThinkingLevel>("medium");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickingWorkspace, setIsPickingWorkspace] = useState(false);

  const runtimeAgentId = slugifyAgentId(runtimeAgentIdInput) || slugifyAgentId(name) || "new-agent";

  useEffect(() => {
    let cancelled = false;

    async function loadRuntime() {
      setIsLoadingCatalog(true);

      try {
        const [nextCatalog, nextConfig] = await Promise.all([
          getCodexCatalog(),
          getCodexConfig(),
        ]);

        if (cancelled) {
          return;
        }

        setCatalog(nextCatalog);
        setConfig(nextConfig);
        setCatalogError(null);
        setSelectedModel(
          nextConfig.current.defaultModel ??
            nextConfig.detected.defaultModel ??
            nextCatalog.defaults.defaultModelId ??
            "gpt-5.4"
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        setCatalogError(
          error instanceof ApiError
            ? error.message
            : "Unable to load the Codex runtime configuration."
        );
      } finally {
        if (!cancelled) {
          setIsLoadingCatalog(false);
        }
      }
    }

    void loadRuntime();

    return () => {
      cancelled = true;
    };
  }, []);

  const previewWorkspacePath = !catalog
    ? workspacePathOverride
    : workspacePathOverride ||
      applyAgentIdTemplate(catalog.defaults.workspacePathTemplate, runtimeAgentId);
  const previewRuntimeStatePath = !catalog
    ? runtimeStatePathOverride
    : runtimeStatePathOverride ||
      applyAgentIdTemplate(catalog.defaults.runtimeStatePathTemplate, runtimeAgentId);
  const codexModelOptions = Array.from(
    new Map(
      [
        ...(selectedModel ? [{ id: selectedModel, name: selectedModel }] : []),
        ...((catalog?.models ?? []).map((model) => ({ id: model.id, name: model.name }))),
      ].map((model) => [model.id, model])
    ).values()
  );

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
    if (!name.trim()) { setErrorMessage("Agent name is required."); return; }
    if (!role.trim()) { setErrorMessage("Assigned role is required."); return; }
    if (!catalog) { setErrorMessage("Codex runtime details have not finished loading."); return; }
    if (config?.enabled === false) {
      setErrorMessage("Codex is disabled in runtime settings.");
      return;
    }
    if (config?.health.status !== "healthy") {
      setErrorMessage("Codex must be installed and signed in before creating a Codex agent.");
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
          kind: "codex",
          runtimeAgentId,
          workspacePath: previewWorkspacePath,
          runtimeStatePath: previewRuntimeStatePath,
          defaultModelId: selectedModel.trim() || null,
          sandboxMode,
          modelOverrideAllowed: true,
          defaultThinkingLevel: thinkingLevel,
        },
      });
      router.push(`/agents/${agent.id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : "Unable to create the agent."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-24 anim-2" onSubmit={handleSubmit}>
      {/* Runtime badge */}
      <div className="flex items-center gap-3 rounded-lg bg-secondary/6 px-4 py-3 ghost">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary/10">
          <Icon name="code" size={16} className="text-secondary/75" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-medium text-on-surface">Codex Runtime</p>
          <p className="text-[11px] text-on-surface-variant/40">
            {isLoadingCatalog
              ? "Checking local Codex installation..."
              : config?.enabled === false
                ? "Disabled in runtime settings"
              : config
                ? `${config.auth.message} · ${selectedModel || "No default model"}`
                : "Offline"}
          </p>
        </div>
        {!isLoadingCatalog && config && (
          <div
            className={`h-2 w-2 rounded-full ${
              config.health.status === "healthy"
                ? "bg-secondary shadow-[0_0_6px_rgba(123,153,255,0.3)]"
                : "bg-error"
            }`}
          />
        )}
      </div>

      {/* 01 Identity */}
      <IdentitySection
        name={name} setName={setName}
        role={role} setRole={setRole}
        selectedIcon={selectedIcon} setSelectedIcon={setSelectedIcon}
        runtimeAgentIdInput={runtimeAgentIdInput} setRuntimeAgentIdInput={setRuntimeAgentIdInput}
        runtimeAgentId={runtimeAgentId}
      />

      {/* 02 Intelligence */}
      <FormSection step="02" title="Intelligence" description="Choose the model and reasoning level for this Codex agent.">
        <div className="space-y-10">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-2">Directive / AGENTS.md</label>
            <textarea
              value={systemInstructions} onChange={(e) => setSystemInstructions(e.target.value)}
              className="w-full bg-surface-container-low border-none p-4 text-on-surface font-light text-sm leading-relaxed resize-y min-h-[120px] focus:ring-0 focus:outline-none placeholder:text-on-surface-variant/20"
              placeholder="Define how this agent approaches code changes, review standards, and repository conventions..."
              rows={5}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Default Model</label>
              <div className="relative">
                <select
                value={selectedModel}
                  onChange={(event) => setSelectedModel(event.target.value)}
                  className="w-full appearance-none bg-surface-container-low border-none px-4 py-3 text-on-surface text-sm focus:ring-0 focus:outline-none"
                >
                  {codexModelOptions.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.id})
                    </option>
                  ))}
                </select>
                <Icon name="expand_more" size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
              </div>
              <p className="pt-1 text-[11px] text-on-surface-variant/35">
                Models available from your local Codex installation.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Thinking Level</label>
                <span className="text-xs text-secondary font-mono">
                  {formatThinkingLevelLabelForRuntime("codex", thinkingLevel)}
                </span>
              </div>
              <div className="flex gap-2">
                {codexThinkingOptions.map((level) => (
                  <button key={level.value} type="button" onClick={() => setThinkingLevel(level.value)}
                    className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-medium transition-all ${
                      thinkingLevel === level.value ? "bg-secondary/15 text-secondary" : "bg-surface-container-low text-on-surface-variant/40 hover:text-on-surface-variant"
                    }`}>{level.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </FormSection>

      {/* 03 Runtime */}
      <FormSection step="03" title="Runtime" description="Workspace and state paths for this Codex agent.">
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-surface-container-low p-4 ghost">
              <p className="text-[10px] uppercase tracking-[0.22em] text-on-surface-variant/45">Auth</p>
              <p className="mt-3 text-sm font-medium text-on-surface">
                {config?.auth.status === "logged_in" ? "ChatGPT session active" : "Not signed in"}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant/40">
                {config?.auth.message ?? "Codex sign-in status unavailable."}
              </p>
            </div>
            <div className="rounded-lg bg-surface-container-low p-4 ghost">
              <p className="text-[10px] uppercase tracking-[0.22em] text-on-surface-variant/45">Binary</p>
              <p className="mt-3 break-all font-mono text-[12px] text-on-surface/80">
                {config?.current.binaryPath ?? "Unavailable"}
              </p>
            </div>
            <div className="rounded-lg bg-surface-container-low p-4 ghost">
              <p className="text-[10px] uppercase tracking-[0.22em] text-on-surface-variant/45">Config</p>
              <p className="mt-3 break-all font-mono text-[12px] text-on-surface/80">
                {config?.current.configPath ?? "Unavailable"}
              </p>
            </div>
          </div>

          <div className="bg-surface-container-low ghost p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Path Preview</p>
              <button type="button" onClick={() => setShowAdvancedPaths((v) => !v)} className="text-[10px] uppercase tracking-widest text-secondary hover:text-secondary/80 transition-colors">
                {showAdvancedPaths ? "Hide" : "Override"}
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/50 mb-1">Workspace</p>
                <p className="font-mono text-[13px] text-on-surface break-all">{previewWorkspacePath || "Waiting for Codex runtime details"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/50 mb-1">Runtime State</p>
                <p className="font-mono text-[13px] text-on-surface break-all">{previewRuntimeStatePath || "Waiting for Codex runtime details"}</p>
              </div>
            </div>
            {showAdvancedPaths && (
              <div className="border-t border-outline-variant/15 pt-4 space-y-4">
                <div className="flex gap-3 items-end">
                  <label className="flex-1 space-y-1">
                    <span className="text-[10px] uppercase tracking-widest text-on-surface-variant/50">Workspace Override</span>
                    <input type="text" value={workspacePathOverride} onChange={(e) => setWorkspacePathOverride(e.target.value)}
                      className="ghost w-full bg-surface-container px-4 py-2.5 font-mono text-[13px] text-on-surface outline-none"
                      placeholder={catalog?.defaults.workspacePathTemplate} spellCheck={false} />
                  </label>
                  <button type="button" onClick={handleBrowseWorkspace} disabled={isPickingWorkspace || isSubmitting}
                    className="ghost px-4 py-2.5 text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50">
                    {isPickingWorkspace ? "Picking..." : "Browse"}
                  </button>
                </div>
                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-on-surface-variant/50">Runtime State Override</span>
                  <input type="text" value={runtimeStatePathOverride} onChange={(e) => setRuntimeStatePathOverride(e.target.value)}
                    className="ghost w-full bg-surface-container px-4 py-2.5 font-mono text-[13px] text-on-surface outline-none"
                    placeholder={catalog?.defaults.runtimeStatePathTemplate} spellCheck={false} />
                </label>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Sandbox Mode</label>
              <div className="flex gap-2">
                {(["off", "docker", "other"] as const).map((mode) => (
                  <button key={mode} type="button" onClick={() => setSandboxMode(mode)}
                    className={`flex-1 py-2.5 text-[10px] uppercase tracking-widest font-medium transition-all ${
                      sandboxMode === mode ? "bg-secondary/15 text-secondary" : "bg-surface-container-low text-on-surface-variant/40 hover:text-on-surface-variant"
                    }`}>{mode}</button>
                ))}
              </div>
              <p className="pt-1 text-[11px] text-on-surface-variant/35">Controls how Codex isolates code execution for this agent.</p>
            </div>
            <div className="rounded-lg bg-surface-container-low p-4 ghost">
              <p className="text-[10px] uppercase tracking-[0.22em] text-on-surface-variant/45">State Directory</p>
              <p className="mt-3 break-all font-mono text-[12px] text-on-surface/80">
                {config?.current.stateDir ?? "Unavailable"}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant/35">
                Uses the Codex state directory from your local installation.
              </p>
            </div>
          </div>
        </div>
      </FormSection>

      <WorkspaceFilesSection
        personaText={personaText}
        setPersonaText={setPersonaText}
        toolsText={toolsText}
        setToolsText={setToolsText}
        userContextText={userContextText}
        setUserContextText={setUserContextText}
        identityText={identityText}
        setIdentityText={setIdentityText}
        heartbeatText={heartbeatText}
        setHeartbeatText={setHeartbeatText}
        memoryText={memoryText}
        setMemoryText={setMemoryText}
        runtimeLabel="Codex"
      />

      {/* Error */}
      {(errorMessage || catalogError) && (
        <div className="border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {errorMessage ?? catalogError}
        </div>
      )}

      {/* Footer */}
      <div className="pt-12 ghost-t flex flex-col md:flex-row items-center justify-between gap-6">
        <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
          <Icon name="arrow_back" size={16} /> Change runtime
        </button>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Link href="/agents" className="flex-1 md:flex-none px-8 py-3 rounded-sm text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-all text-center">Cancel</Link>
          <button type="submit" disabled={isSubmitting || isLoadingCatalog || config?.health.status !== "healthy" || config?.enabled === false}
            className="flex-1 md:flex-none px-8 py-3 rounded-sm text-sm font-medium bg-primary text-on-primary hover:opacity-80 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
            {isSubmitting ? "Creating..." : "Create Agent"}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ── Claude Code agent form ── */

function ClaudeCodeAgentForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<ApiClaudeCatalog | null>(null);
  const [config, setConfig] = useState<ApiClaudeConfigSnapshot | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("cloud");
  const [runtimeAgentIdInput, setRuntimeAgentIdInput] = useState("");
  const [systemInstructions, setSystemInstructions] = useState("");
  const [personaText, setPersonaText] = useState("");
  const [userContextText, setUserContextText] = useState("");
  const [identityText, setIdentityText] = useState("");
  const [toolsText, setToolsText] = useState("");
  const [heartbeatText, setHeartbeatText] = useState("");
  const [memoryText, setMemoryText] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [thinkingLevel, setThinkingLevel] = useState<ApiThinkingLevel>("high");
  const [sandboxMode, setSandboxMode] = useState<"off" | "docker" | "other">("off");
  const [workspacePathOverride, setWorkspacePathOverride] = useState("");
  const [runtimeStatePathOverride, setRuntimeStatePathOverride] = useState("");
  const [showAdvancedPaths, setShowAdvancedPaths] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickingWorkspace, setIsPickingWorkspace] = useState(false);

  const runtimeAgentId = slugifyAgentId(runtimeAgentIdInput) || slugifyAgentId(name) || "new-agent";

  useEffect(() => {
    let cancelled = false;

    async function loadRuntime() {
      setIsLoadingCatalog(true);

      try {
        const [nextCatalog, nextConfig] = await Promise.all([
          getClaudeCatalog(),
          getClaudeConfig(),
        ]);

        if (cancelled) {
          return;
        }

        setCatalog(nextCatalog);
        setConfig(nextConfig);
        setCatalogError(null);
        setSelectedModel(
          nextConfig.current.defaultModel ??
            nextConfig.detected.defaultModel ??
            nextCatalog.defaults.defaultModelId ??
            "claude-sonnet-4-6"
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        setCatalogError(
          error instanceof ApiError
            ? error.message
            : "Unable to load the Claude Code runtime configuration."
        );
      } finally {
        if (!cancelled) {
          setIsLoadingCatalog(false);
        }
      }
    }

    void loadRuntime();

    return () => {
      cancelled = true;
    };
  }, []);

  const previewWorkspacePath = !catalog
    ? workspacePathOverride
    : workspacePathOverride ||
      applyAgentIdTemplate(catalog.defaults.workspacePathTemplate, runtimeAgentId);
  const previewRuntimeStatePath = !catalog
    ? runtimeStatePathOverride
    : runtimeStatePathOverride ||
      applyAgentIdTemplate(catalog.defaults.runtimeStatePathTemplate, runtimeAgentId);
  const claudeModelOptions = Array.from(
    new Map(
      [
        ...(selectedModel ? [{ id: selectedModel, name: selectedModel }] : []),
        ...((catalog?.models ?? []).map((model) => ({ id: model.id, name: model.name }))),
      ].map((model) => [model.id, model])
    ).values()
  );

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
    if (!name.trim()) { setErrorMessage("Agent name is required."); return; }
    if (!role.trim()) { setErrorMessage("Assigned role is required."); return; }
    if (!catalog) { setErrorMessage("Claude Code runtime details have not finished loading."); return; }
    if (config?.enabled === false) {
      setErrorMessage("Claude Code is disabled in runtime settings.");
      return;
    }
    if (config?.health.status !== "healthy") {
      setErrorMessage("Claude Code must be installed and signed in before creating a Claude Code agent.");
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
          kind: "claude-code",
          runtimeAgentId,
          workspacePath: previewWorkspacePath,
          runtimeStatePath: previewRuntimeStatePath,
          defaultModelId: selectedModel.trim() || null,
          sandboxMode,
          modelOverrideAllowed: true,
          defaultThinkingLevel: thinkingLevel,
        },
      });
      router.push(`/agents/${agent.id}`);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "Unable to create the agent.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-24 anim-2" onSubmit={handleSubmit}>
      {/* Runtime badge */}
      <div className="flex items-center gap-3 rounded-lg bg-secondary/6 px-4 py-3 ghost">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary/10">
          <Icon name="cloud" size={16} className="text-secondary/75" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-medium text-on-surface">Claude Code Runtime</p>
          <p className="text-[11px] text-on-surface-variant/40">
            {isLoadingCatalog
              ? "Checking local Claude Code installation..."
              : config?.enabled === false
                ? "Disabled in runtime settings"
              : config
                ? `${config.auth.message} · ${selectedModel || "No default model"}`
                : "Offline"}
          </p>
        </div>
        {!isLoadingCatalog && config && (
          <div
            className={`h-2 w-2 rounded-full ${
              config.health.status === "healthy"
                ? "bg-secondary shadow-[0_0_6px_rgba(123,153,255,0.3)]"
                : "bg-error"
            }`}
          />
        )}
      </div>

      {/* 01 Identity */}
      <IdentitySection
        name={name} setName={setName}
        role={role} setRole={setRole}
        selectedIcon={selectedIcon} setSelectedIcon={setSelectedIcon}
        runtimeAgentIdInput={runtimeAgentIdInput} setRuntimeAgentIdInput={setRuntimeAgentIdInput}
        runtimeAgentId={runtimeAgentId}
      />

      {/* 02 Intelligence */}
      <FormSection step="02" title="Intelligence" description="Choose the model and reasoning level for this Claude Code agent.">
        <div className="space-y-10">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-2">Directive / AGENTS.md</label>
            <textarea
              value={systemInstructions} onChange={(e) => setSystemInstructions(e.target.value)}
              className="w-full bg-surface-container-low border-none p-4 text-on-surface font-light text-sm leading-relaxed resize-y min-h-[120px] focus:ring-0 focus:outline-none placeholder:text-on-surface-variant/20"
              placeholder="Define the agent's core purpose, constraints, and expected behavior patterns..."
              rows={5}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Default Model</label>
              <select
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value)}
                className="w-full bg-transparent border-none py-2 text-on-surface font-mono text-sm placeholder:text-on-surface-variant/20 focus:ring-0 focus:outline-none"
                style={{ borderBottom: "1px solid rgba(72,72,75,0.3)" }}
              >
                {claudeModelOptions.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <p className="pt-1 text-[11px] text-on-surface-variant/35">
                Models available from your local Claude Code installation.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Thinking Level</label>
                <span className="text-xs text-secondary font-mono">
                  {formatThinkingLevelLabelForRuntime("claude-code", thinkingLevel)}
                </span>
              </div>
              <div className="flex gap-2">
                {claudeThinkingOptions.map((level) => (
                  <button key={level.value} type="button" onClick={() => setThinkingLevel(level.value)}
                    className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-medium transition-all ${
                      thinkingLevel === level.value ? "bg-secondary/15 text-secondary" : "bg-surface-container-low text-on-surface-variant/40 hover:text-on-surface-variant"
                    }`}>{level.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </FormSection>

      {/* 03 Execution */}
      <FormSection step="03" title="Runtime" description="Workspace and state paths for this Claude Code agent.">
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-surface-container-low p-4 ghost">
              <p className="text-[10px] uppercase tracking-[0.22em] text-on-surface-variant/45">Auth</p>
              <p className="mt-3 text-sm font-medium text-on-surface">
                {config?.auth.status === "logged_in" ? "Claude session active" : "Not signed in"}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant/40">
                {config?.auth.message ?? "Claude Code sign-in status unavailable."}
              </p>
            </div>
            <div className="rounded-lg bg-surface-container-low p-4 ghost">
              <p className="text-[10px] uppercase tracking-[0.22em] text-on-surface-variant/45">Binary</p>
              <p className="mt-3 break-all font-mono text-[12px] text-on-surface/80">
                {config?.current.binaryPath ?? "Unavailable"}
              </p>
            </div>
            <div className="rounded-lg bg-surface-container-low p-4 ghost">
              <p className="text-[10px] uppercase tracking-[0.22em] text-on-surface-variant/45">Config</p>
              <p className="mt-3 break-all font-mono text-[12px] text-on-surface/80">
                {config?.current.configPath ?? "Unavailable"}
              </p>
            </div>
          </div>

          <div className="bg-surface-container-low ghost p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Path Preview</p>
              <button type="button" onClick={() => setShowAdvancedPaths((v) => !v)} className="text-[10px] uppercase tracking-widest text-secondary hover:text-secondary/80 transition-colors">
                {showAdvancedPaths ? "Hide" : "Override"}
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/50 mb-1">Workspace</p>
                <p className="font-mono text-[13px] text-on-surface break-all">{previewWorkspacePath || "Waiting for Claude runtime details"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/50 mb-1">Runtime State</p>
                <p className="font-mono text-[13px] text-on-surface break-all">{previewRuntimeStatePath || "Waiting for Claude runtime details"}</p>
              </div>
            </div>
            {showAdvancedPaths && (
              <div className="border-t border-outline-variant/15 pt-4 space-y-4">
                <div className="flex gap-3 items-end">
                  <label className="flex-1 space-y-1">
                    <span className="text-[10px] uppercase tracking-widest text-on-surface-variant/50">Workspace Override</span>
                    <input type="text" value={workspacePathOverride} onChange={(e) => setWorkspacePathOverride(e.target.value)}
                      className="ghost w-full bg-surface-container px-4 py-2.5 font-mono text-[13px] text-on-surface outline-none"
                      placeholder={catalog?.defaults.workspacePathTemplate} spellCheck={false} />
                  </label>
                  <button type="button" onClick={handleBrowseWorkspace} disabled={isPickingWorkspace || isSubmitting}
                    className="ghost px-4 py-2.5 text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50">
                    {isPickingWorkspace ? "Picking..." : "Browse"}
                  </button>
                </div>
                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-on-surface-variant/50">Runtime State Override</span>
                  <input type="text" value={runtimeStatePathOverride} onChange={(e) => setRuntimeStatePathOverride(e.target.value)}
                    className="ghost w-full bg-surface-container px-4 py-2.5 font-mono text-[13px] text-on-surface outline-none"
                    placeholder={catalog?.defaults.runtimeStatePathTemplate} spellCheck={false} />
                </label>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Sandbox Mode</label>
              <div className="flex gap-2">
                {(["off", "docker", "other"] as const).map((mode) => (
                  <button key={mode} type="button" onClick={() => setSandboxMode(mode)}
                    className={`flex-1 py-2.5 text-[10px] uppercase tracking-widest font-medium transition-all ${
                      sandboxMode === mode ? "bg-secondary/15 text-secondary" : "bg-surface-container-low text-on-surface-variant/40 hover:text-on-surface-variant"
                    }`}>{mode}</button>
                ))}
              </div>
              <p className="pt-1 text-[11px] text-on-surface-variant/35">Controls how Claude Code isolates code execution for this agent.</p>
            </div>
            <div className="rounded-lg bg-surface-container-low p-4 ghost">
              <p className="text-[10px] uppercase tracking-[0.22em] text-on-surface-variant/45">State Directory</p>
              <p className="mt-3 break-all font-mono text-[12px] text-on-surface/80">
                {config?.current.stateDir ?? "Unavailable"}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant/35">
                Uses the Claude Code state directory from your local installation.
              </p>
            </div>
          </div>
        </div>
      </FormSection>

      <WorkspaceFilesSection
        personaText={personaText}
        setPersonaText={setPersonaText}
        toolsText={toolsText}
        setToolsText={setToolsText}
        userContextText={userContextText}
        setUserContextText={setUserContextText}
        identityText={identityText}
        setIdentityText={setIdentityText}
        heartbeatText={heartbeatText}
        setHeartbeatText={setHeartbeatText}
        memoryText={memoryText}
        setMemoryText={setMemoryText}
        runtimeLabel="Claude Code"
      />

      {/* Error */}
      {(errorMessage || catalogError) && (
        <div className="border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {errorMessage ?? catalogError}
        </div>
      )}

      {/* Footer */}
      <div className="pt-12 ghost-t flex flex-col md:flex-row items-center justify-between gap-6">
        <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
          <Icon name="arrow_back" size={16} /> Change runtime
        </button>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Link href="/agents" className="flex-1 md:flex-none px-8 py-3 rounded-sm text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-all text-center">Cancel</Link>
          <button type="submit" disabled={isSubmitting || isLoadingCatalog || config?.health.status !== "healthy" || config?.enabled === false}
            className="flex-1 md:flex-none px-8 py-3 rounded-sm text-sm font-medium bg-primary text-on-primary hover:opacity-80 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
            {isSubmitting ? "Creating..." : "Create Agent"}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ── Main page ── */

export default function NewAgentPage() {
  const [selectedRuntime, setSelectedRuntime] = useState<RuntimeOption | null>(null);
  const [runtimeEnabled, setRuntimeEnabled] = useState<Record<RuntimeOption, boolean | null>>({
    openclaw: null,
    codex: null,
    claude: null,
  });
  const [openClawConfig, setOpenClawConfig] = useState<ApiOpenClawConfigSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRuntimeAvailability() {
      try {
        const [nextOpenClawConfig, nextCodexConfig, nextClaudeConfig] = await Promise.all([
          getOpenClawConfig(),
          getCodexConfig(),
          getClaudeConfig(),
        ]);

        if (cancelled) {
          return;
        }

        setOpenClawConfig(nextOpenClawConfig);
        setRuntimeEnabled({
          openclaw: nextOpenClawConfig.enabled,
          codex: nextCodexConfig.enabled,
          claude: nextClaudeConfig.enabled,
        });
      } catch {
        if (!cancelled) {
          setRuntimeEnabled({
            openclaw: null,
            codex: null,
            claude: null,
          });
        }
      }
    }

    void loadRuntimeAvailability();

    return () => {
      cancelled = true;
    };
  }, []);

  const currentStep = selectedRuntime ? 2 : 1;
  const selectedMeta = runtimeOptions.find((r) => r.id === selectedRuntime);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Back to agents */}
      <Link
        href="/agents"
        className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5 text-sm mb-8 anim-1"
      >
        <Icon name="arrow_back" size={16} />
        Agents
      </Link>

      {/* Header */}
      <header className="mb-12 anim-1">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-thin text-on-surface tracking-tight mb-2">
              New Agent
            </h1>
            <p className="text-on-surface-variant font-light max-w-lg">
              {currentStep === 1
                ? "Choose a runtime, then configure the agent's identity and behavior."
                : `Set up a new ${selectedMeta?.name ?? ""} agent below.`}
            </p>
          </div>
          <StepIndicator current={currentStep} total={2} />
        </div>

        {/* Step labels */}
        <div className="flex items-center gap-6 text-[11px] font-medium uppercase tracking-wider">
          <span className={currentStep === 1 ? "text-secondary" : "text-on-surface-variant/30"}>
            Runtime
          </span>
          <Icon name="chevron_right" size={14} className="text-on-surface-variant/15" />
          <span className={currentStep === 2 ? "text-secondary" : "text-on-surface-variant/30"}>
            Agent details
          </span>
        </div>
      </header>

      {/* Step 1: Runtime selection */}
      {!selectedRuntime && (
        <RuntimeSelectionStep
          onSelect={setSelectedRuntime}
          runtimeEnabled={runtimeEnabled}
        />
      )}

      {/* Step 2: Runtime-specific form */}
      {selectedRuntime === "openclaw" && (
        <OpenClawAgentForm
          onBack={() => setSelectedRuntime(null)}
          runtimeConfig={openClawConfig}
        />
      )}
      {selectedRuntime === "codex" && (
        <CodexAgentForm onBack={() => setSelectedRuntime(null)} />
      )}
      {selectedRuntime === "claude" && (
        <ClaudeCodeAgentForm onBack={() => setSelectedRuntime(null)} />
      )}
    </div>
  );
}
