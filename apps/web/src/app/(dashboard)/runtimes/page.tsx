"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/icon";
import {
  type ApiClaudeCatalog,
  type ApiClaudeConfigSnapshot,
  type ApiCodexCatalog,
  type ApiCodexConfigSnapshot,
  ApiError,
  type ApiOpenClawCatalog,
  type ApiOpenClawConfigSnapshot,
  type ApiRuntimeHealth,
  getClaudeCatalog,
  getClaudeConfig,
  getCodexCatalog,
  getCodexConfig,
  getOpenClawCatalog,
  getOpenClawConfig,
  selectDirectory,
  setClaudeEnabled,
  setCodexEnabled,
  setOpenClawEnabled,
  testClaudeConfig,
  updateClaudeConfig,
  testCodexConfig,
  updateCodexConfig,
  testOpenClawConfig,
  updateOpenClawConfig,
} from "@/lib/api";

/* ── Static runtime definitions ── */

type RuntimeDef = {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  features: string[];
  status: "connected" | "available";
  configFields: ConfigField[];
};

type ConfigField = {
  key: string;
  label: string;
  type: "text" | "password" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
  helpText?: string;
};

const staticRuntimes: RuntimeDef[] = [];

/* ── Status helpers ── */

function statusLabel(health: ApiRuntimeHealth) {
  switch (health.status) {
    case "healthy":
      return "Connected";
    case "degraded":
      return "Degraded";
    case "missing_binary":
      return "Not found";
    case "error":
      return "Error";
    default:
      return "Checking";
  }
}

function StatusDot({ health }: { health: ApiRuntimeHealth }) {
  const isOk = health.status === "healthy";
  const isWarn = health.status === "degraded";

  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-2 w-2 rounded-full ${
          isOk
            ? "bg-tertiary shadow-[0_0_8px_rgba(209,255,215,0.4)]"
            : isWarn
              ? "bg-error shadow-[0_0_8px_rgba(238,125,119,0.28)]"
              : "bg-outline/30"
        }`}
      />
      <span
        className={`font-mono text-[9px] uppercase tracking-wider ${
          isOk
            ? "text-tertiary/75"
            : isWarn
              ? "text-error/75"
              : "text-on-surface-variant/35"
        }`}
      >
        {statusLabel(health)}
      </span>
    </div>
  );
}

function StaticStatusBadge({ status }: { status: "connected" | "available" }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-2 rounded-full bg-outline/30" />
      <span className="font-mono text-[9px] uppercase tracking-wider text-on-surface-variant/35">
        {status === "connected" ? "Connected" : "Not connected"}
      </span>
    </div>
  );
}

/* ── OpenClaw configure modal (simplified) ── */

function OpenClawConfigureModal({
  catalog,
  config,
  onClose,
  onSaved,
}: {
  catalog: ApiOpenClawCatalog;
  config: ApiOpenClawConfigSnapshot;
  onClose: () => void;
  onSaved: (snapshot: ApiOpenClawConfigSnapshot) => void;
}) {
  const prefill = config.detected.binaryPath && config.detected.binaryPath !== "openclaw"
    ? config.detected
    : config.current;

  const [profile, setProfile] = useState(prefill.profile);
  const [binaryPath, setBinaryPath] = useState(prefill.binaryPath);
  const [stateDir, setStateDir] = useState(prefill.stateDir);
  const [configPath, setConfigPath] = useState(prefill.configPath);
  const [gatewayUrl, setGatewayUrl] = useState(prefill.gatewayUrl ?? "");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const draft = {
    profile,
    binaryPath,
    stateDir,
    configPath,
    gatewayUrl: gatewayUrl.trim() || null,
  };

  async function handlePickDir() {
    try {
      const result = await selectDirectory();
      if (!result.canceled && result.path) {
        setStateDir(result.path);
        setConfigPath(`${result.path}/openclaw.json`);
      }
    } catch (e) {
      setFeedback({
        type: "err",
        msg: e instanceof ApiError ? e.message : "Could not open directory picker.",
      });
    }
  }

  async function handleTest() {
    setTesting(true);
    setFeedback(null);
    try {
      const result = await testOpenClawConfig(draft);
      setFeedback({
        type: result.health.status === "healthy" ? "ok" : "err",
        msg:
          result.health.status === "healthy"
            ? "Connection successful — runtime is reachable."
            : "Runtime responded but needs attention. Check your configuration.",
      });
    } catch (e) {
      setFeedback({
        type: "err",
        msg: e instanceof ApiError ? e.message : "Connection test failed.",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      const result = await updateOpenClawConfig(draft);
      onSaved(result);
      onClose();
    } catch (e) {
      setFeedback({
        type: "err",
        msg: e instanceof ApiError ? e.message : "Unable to save configuration.",
      });
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative mx-4 w-full max-w-lg overflow-hidden rounded-xl bg-surface-container-low ghost">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 ghost-b">
          <div>
            <h2 className="text-[15px] font-semibold text-on-surface tracking-tight">
              Configure OpenClaw
            </h2>
            <p className="mt-0.5 text-[12px] text-on-surface-variant/40">
              Local execution runtime
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-on-surface-variant/30 hover:bg-surface-container-high/30 hover:text-on-surface-variant/60 transition-colors"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="ml-0.5 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
                Profile
              </span>
              <input
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                placeholder="apm"
                className="w-full rounded-md border border-outline-variant/10 bg-surface-container-lowest/60 px-3.5 py-2.5 text-[13px] text-on-surface/80 outline-none transition-colors placeholder:text-on-surface-variant/20 focus:border-secondary/30"
              />
            </label>
            <label className="space-y-1.5">
              <span className="ml-0.5 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
                Gateway URL
              </span>
              <input
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
                placeholder="ws://127.0.0.1:18789"
                className="w-full rounded-md border border-outline-variant/10 bg-surface-container-lowest/60 px-3.5 py-2.5 text-[13px] text-on-surface/80 outline-none transition-colors placeholder:text-on-surface-variant/20 focus:border-secondary/30"
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="ml-0.5 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
              Binary path
            </span>
            <input
              value={binaryPath}
              onChange={(e) => setBinaryPath(e.target.value)}
              placeholder="/usr/local/bin/openclaw"
              className="w-full rounded-md border border-outline-variant/10 bg-surface-container-lowest/60 px-3.5 py-2.5 font-mono text-[13px] text-on-surface/80 outline-none transition-colors placeholder:text-on-surface-variant/20 focus:border-secondary/30"
            />
          </label>

          <div className="space-y-1.5">
            <span className="ml-0.5 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
              State directory
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handlePickDir()}
                className="shrink-0 rounded-md border border-outline-variant/10 bg-surface-container-high/40 px-3.5 py-2.5 text-[12px] font-medium text-on-surface/70 transition-colors hover:bg-surface-container-high/60"
              >
                Browse
              </button>
              <input
                value={stateDir}
                onChange={(e) => setStateDir(e.target.value)}
                placeholder="~/.openclaw"
                className="w-full rounded-md border border-outline-variant/10 bg-surface-container-lowest/60 px-3.5 py-2.5 font-mono text-[13px] text-on-surface/80 outline-none transition-colors placeholder:text-on-surface-variant/20 focus:border-secondary/30"
              />
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="ml-0.5 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
              Config path
            </span>
            <input
              value={configPath}
              onChange={(e) => setConfigPath(e.target.value)}
              placeholder={`${stateDir || "~/.openclaw"}/openclaw.json`}
              className="w-full rounded-md border border-outline-variant/10 bg-surface-container-lowest/60 px-3.5 py-2.5 font-mono text-[13px] text-on-surface/80 outline-none transition-colors placeholder:text-on-surface-variant/20 focus:border-secondary/30"
            />
          </label>

          {/* Feedback */}
          {feedback && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                feedback.type === "ok"
                  ? "border-tertiary/20 bg-tertiary/6 text-tertiary/85"
                  : "border-error/20 bg-error/8 text-error/85"
              }`}
            >
              {feedback.msg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 ghost-t">
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing || saving}
            className="flex items-center gap-2 text-[12px] font-medium text-on-surface-variant/50 hover:text-on-surface-variant/80 transition-colors disabled:opacity-50"
          >
            <Icon name="science" size={14} />
            {testing ? "Testing..." : "Test connection"}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-[12px] font-medium text-on-surface-variant/40 hover:text-on-surface-variant/65 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-md bg-secondary/15 px-4 py-2 text-[12px] font-semibold text-secondary hover:bg-secondary/20 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save configuration"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function CodexConfigureModal({
  catalog,
  config,
  onClose,
  onSaved,
}: {
  catalog: ApiCodexCatalog;
  config: ApiCodexConfigSnapshot;
  onClose: () => void;
  onSaved: (snapshot: ApiCodexConfigSnapshot) => void;
}) {
  const prefill =
    config.health.status === "healthy" || config.current.binaryPath !== "codex"
      ? config.current
      : config.detected;

  const [binaryPath, setBinaryPath] = useState(prefill.binaryPath);
  const [stateDir, setStateDir] = useState(prefill.stateDir);
  const [configPath, setConfigPath] = useState(prefill.configPath);
  const [defaultModel, setDefaultModel] = useState(prefill.defaultModel ?? "");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const modelOptions = Array.from(
    new Map(
      [
        ...(defaultModel ? [{ id: defaultModel, name: defaultModel }] : []),
        ...catalog.models.map((model) => ({ id: model.id, name: model.name })),
      ].map((model) => [model.id, model])
    ).values()
  );

  const draft = {
    binaryPath,
    stateDir,
    configPath,
    defaultModel: defaultModel.trim() || null,
  };

  async function handlePickDir() {
    try {
      const result = await selectDirectory();
      if (!result.canceled && result.path) {
        setStateDir(result.path);
        setConfigPath(`${result.path}/config.toml`);
      }
    } catch (error) {
      setFeedback({
        type: "err",
        msg:
          error instanceof ApiError
            ? error.message
            : "Could not open directory picker.",
      });
    }
  }

  async function handleTest() {
    setTesting(true);
    setFeedback(null);
    try {
      const result = await testCodexConfig(draft);
      setFeedback({
        type: result.health.status === "healthy" ? "ok" : "err",
        msg:
          result.health.status === "healthy"
            ? result.auth.message
            : result.auth.message || "Check your Codex configuration.",
      });
    } catch (error) {
      setFeedback({
        type: "err",
        msg:
          error instanceof ApiError ? error.message : "Connection test failed.",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      const result = await updateCodexConfig(draft);
      onSaved(result);
      onClose();
    } catch (error) {
      setFeedback({
        type: "err",
        msg:
          error instanceof ApiError
            ? error.message
            : "Unable to save Codex configuration.",
      });
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-4 w-full max-w-lg overflow-hidden rounded-xl bg-surface-container-low ghost">
        <div className="flex items-center justify-between px-6 py-5 ghost-b">
          <div>
            <h2 className="text-[15px] font-semibold text-on-surface tracking-tight">
              Configure Codex
            </h2>
            <p className="mt-0.5 text-[12px] text-on-surface-variant/40">
              OpenAI-powered runtime
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-on-surface-variant/30 hover:bg-surface-container-high/30 hover:text-on-surface-variant/60 transition-colors"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest/40 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/35">
                  Auth status
                </p>
                <p className="mt-1 text-[13px] text-on-surface/75">
                  {config.auth.message}
                </p>
              </div>
              <StatusDot health={config.health} />
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="ml-0.5 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
              Binary path
            </span>
            <input
              value={binaryPath}
              onChange={(event) => setBinaryPath(event.target.value)}
              placeholder="/usr/local/bin/codex"
              className="w-full rounded-md border border-outline-variant/10 bg-surface-container-lowest/60 px-3.5 py-2.5 font-mono text-[13px] text-on-surface/80 outline-none transition-colors placeholder:text-on-surface-variant/20 focus:border-secondary/30"
            />
          </label>

          <div className="space-y-1.5">
            <span className="ml-0.5 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
              State directory
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handlePickDir()}
                className="shrink-0 rounded-md border border-outline-variant/10 bg-surface-container-high/40 px-3.5 py-2.5 text-[12px] font-medium text-on-surface/70 transition-colors hover:bg-surface-container-high/60"
              >
                Browse
              </button>
              <input
                value={stateDir}
                onChange={(event) => setStateDir(event.target.value)}
                placeholder="~/.codex"
                className="w-full rounded-md border border-outline-variant/10 bg-surface-container-lowest/60 px-3.5 py-2.5 font-mono text-[13px] text-on-surface/80 outline-none transition-colors placeholder:text-on-surface-variant/20 focus:border-secondary/30"
              />
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="ml-0.5 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
              Config path
            </span>
            <input
              value={configPath}
              onChange={(event) => setConfigPath(event.target.value)}
              placeholder={`${stateDir || "~/.codex"}/config.toml`}
              className="w-full rounded-md border border-outline-variant/10 bg-surface-container-lowest/60 px-3.5 py-2.5 font-mono text-[13px] text-on-surface/80 outline-none transition-colors placeholder:text-on-surface-variant/20 focus:border-secondary/30"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="ml-0.5 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
              Default model
            </span>
            <select
              value={defaultModel}
              onChange={(event) => setDefaultModel(event.target.value)}
              className="w-full rounded-md border border-outline-variant/10 bg-surface-container-lowest/60 px-3.5 py-2.5 font-mono text-[13px] text-on-surface/80 outline-none transition-colors focus:border-secondary/30"
            >
              {modelOptions.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.id})
                </option>
              ))}
            </select>
          </label>

          {feedback && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                feedback.type === "ok"
                  ? "border-tertiary/20 bg-tertiary/6 text-tertiary/85"
                  : "border-error/20 bg-error/8 text-error/85"
              }`}
            >
              {feedback.msg}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 ghost-t">
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing || saving}
            className="flex items-center gap-2 text-[12px] font-medium text-on-surface-variant/50 hover:text-on-surface-variant/80 transition-colors disabled:opacity-50"
          >
            <Icon name="science" size={14} />
            {testing ? "Testing..." : "Test connection"}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-[12px] font-medium text-on-surface-variant/40 hover:text-on-surface-variant/65 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-md bg-secondary/15 px-4 py-2 text-[12px] font-semibold text-secondary hover:bg-secondary/20 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save configuration"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ClaudeConfigureModal({
  catalog,
  config,
  onClose,
  onSaved,
}: {
  catalog: ApiClaudeCatalog;
  config: ApiClaudeConfigSnapshot;
  onClose: () => void;
  onSaved: (snapshot: ApiClaudeConfigSnapshot) => void;
}) {
  const prefill =
    config.health.status === "healthy" || config.current.binaryPath !== "claude"
      ? config.current
      : config.detected;

  const [binaryPath, setBinaryPath] = useState(prefill.binaryPath);
  const [stateDir, setStateDir] = useState(prefill.stateDir);
  const [configPath, setConfigPath] = useState(prefill.configPath);
  const [defaultModel, setDefaultModel] = useState(prefill.defaultModel ?? "");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const modelOptions = Array.from(
    new Map(
      [
        ...(defaultModel ? [{ id: defaultModel, name: defaultModel }] : []),
        ...catalog.models.map((model) => ({ id: model.id, name: model.name })),
      ].map((model) => [model.id, model])
    ).values()
  );

  const draft = {
    binaryPath,
    stateDir,
    configPath,
    defaultModel: defaultModel.trim() || null,
  };

  async function handlePickDir() {
    try {
      const result = await selectDirectory();
      if (!result.canceled && result.path) {
        setStateDir(result.path);
        setConfigPath(`${result.path}/settings.json`);
      }
    } catch (error) {
      setFeedback({
        type: "err",
        msg:
          error instanceof ApiError
            ? error.message
            : "Could not open directory picker.",
      });
    }
  }

  async function handleTest() {
    setTesting(true);
    setFeedback(null);
    try {
      const result = await testClaudeConfig(draft);
      setFeedback({
        type: result.health.status === "healthy" ? "ok" : "err",
        msg:
          result.health.status === "healthy"
            ? result.auth.message
            : result.auth.message || "Check your Claude Code configuration.",
      });
    } catch (error) {
      setFeedback({
        type: "err",
        msg:
          error instanceof ApiError ? error.message : "Connection test failed.",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      const result = await updateClaudeConfig(draft);
      onSaved(result);
      onClose();
    } catch (error) {
      setFeedback({
        type: "err",
        msg:
          error instanceof ApiError
            ? error.message
            : "Unable to save Claude Code configuration.",
      });
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-4 w-full max-w-lg overflow-hidden rounded-xl bg-surface-container-low ghost">
        <div className="flex items-center justify-between px-6 py-5 ghost-b">
          <div>
            <h2 className="text-[15px] font-semibold text-on-surface tracking-tight">
              Configure Claude Code
            </h2>
            <p className="mt-0.5 text-[12px] text-on-surface-variant/40">
              Anthropic-powered runtime
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-on-surface-variant/30 hover:bg-surface-container-high/30 hover:text-on-surface-variant/60 transition-colors"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest/40 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/35">
                  Auth status
                </p>
                <p className="mt-1 text-[13px] text-on-surface/75">
                  {config.auth.message}
                </p>
              </div>
              <StatusDot health={config.health} />
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="ml-0.5 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
              Binary path
            </span>
            <input
              value={binaryPath}
              onChange={(event) => setBinaryPath(event.target.value)}
              placeholder="/Users/you/.local/bin/claude"
              className="w-full rounded-md border border-outline-variant/10 bg-surface-container-lowest/60 px-3.5 py-2.5 font-mono text-[13px] text-on-surface/80 outline-none transition-colors placeholder:text-on-surface-variant/20 focus:border-secondary/30"
            />
          </label>

          <div className="space-y-1.5">
            <span className="ml-0.5 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
              State directory
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handlePickDir()}
                className="shrink-0 rounded-md border border-outline-variant/10 bg-surface-container-high/40 px-3.5 py-2.5 text-[12px] font-medium text-on-surface/70 transition-colors hover:bg-surface-container-high/60"
              >
                Browse
              </button>
              <input
                value={stateDir}
                onChange={(event) => setStateDir(event.target.value)}
                placeholder="~/.claude"
                className="w-full rounded-md border border-outline-variant/10 bg-surface-container-lowest/60 px-3.5 py-2.5 font-mono text-[13px] text-on-surface/80 outline-none transition-colors placeholder:text-on-surface-variant/20 focus:border-secondary/30"
              />
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="ml-0.5 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
              Config path
            </span>
            <input
              value={configPath}
              onChange={(event) => setConfigPath(event.target.value)}
              placeholder={`${stateDir || "~/.claude"}/settings.json`}
              className="w-full rounded-md border border-outline-variant/10 bg-surface-container-lowest/60 px-3.5 py-2.5 font-mono text-[13px] text-on-surface/80 outline-none transition-colors placeholder:text-on-surface-variant/20 focus:border-secondary/30"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="ml-0.5 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
              Default model
            </span>
            <select
              value={defaultModel}
              onChange={(event) => setDefaultModel(event.target.value)}
              className="w-full rounded-md border border-outline-variant/10 bg-surface-container-lowest/60 px-3.5 py-2.5 font-mono text-[13px] text-on-surface/80 outline-none transition-colors focus:border-secondary/30"
            >
              {modelOptions.map((model: { id: string; name: string }) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
       
          </label>

          {feedback && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                feedback.type === "ok"
                  ? "border-tertiary/20 bg-tertiary/6 text-tertiary/85"
                  : "border-error/20 bg-error/8 text-error/85"
              }`}
            >
              {feedback.msg}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 ghost-t">
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing || saving}
            className="flex items-center gap-2 text-[12px] font-medium text-on-surface-variant/50 hover:text-on-surface-variant/80 transition-colors disabled:opacity-50"
          >
            <Icon name="science" size={14} />
            {testing ? "Testing..." : "Test connection"}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-[12px] font-medium text-on-surface-variant/40 hover:text-on-surface-variant/65 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-md bg-secondary/15 px-4 py-2 text-[12px] font-semibold text-secondary hover:bg-secondary/20 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save configuration"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Static runtime configure modal (Codex / Claude Code) ── */

function StaticConfigureModal({
  runtime,
  onClose,
}: {
  runtime: RuntimeDef;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  function updateField(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleTest() {
    setTesting(true);
    setFeedback(null);
    await new Promise((r) => setTimeout(r, 1500));
    setFeedback({ type: "ok", msg: "Connection test passed." });
    setTesting(false);
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative mx-4 w-full max-w-lg overflow-hidden rounded-xl bg-surface-container-low ghost">
        <div className="flex items-center justify-between px-6 py-5 ghost-b">
          <div>
            <h2 className="text-[15px] font-semibold text-on-surface tracking-tight">
              Connect {runtime.name}
            </h2>
            <p className="mt-0.5 text-[12px] text-on-surface-variant/40">
              {runtime.tagline}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-on-surface-variant/30 hover:bg-surface-container-high/30 hover:text-on-surface-variant/60 transition-colors"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {runtime.configFields.map((field) => (
            <label key={field.key} className="block space-y-1.5">
              <span className="ml-0.5 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/40">
                {field.label}
              </span>
              {field.type === "select" ? (
                <select
                  value={values[field.key] ?? ""}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  className="w-full appearance-none rounded-md border border-outline-variant/10 bg-surface-container-lowest/60 px-3.5 py-2.5 text-[13px] text-on-surface/80 outline-none transition-colors focus:border-secondary/30"
                >
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === "password" ? "password" : "text"}
                  value={values[field.key] ?? ""}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full rounded-md border border-outline-variant/10 bg-surface-container-lowest/60 px-3.5 py-2.5 text-[13px] text-on-surface/80 outline-none transition-colors placeholder:text-on-surface-variant/20 focus:border-secondary/30"
                />
              )}
              {field.helpText && (
                <p className="text-[11px] text-on-surface-variant/25">{field.helpText}</p>
              )}
            </label>
          ))}

          {feedback && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                feedback.type === "ok"
                  ? "border-tertiary/20 bg-tertiary/6 text-tertiary/85"
                  : "border-error/20 bg-error/8 text-error/85"
              }`}
            >
              {feedback.msg}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 ghost-t">
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing}
            className="flex items-center gap-2 text-[12px] font-medium text-on-surface-variant/50 hover:text-on-surface-variant/80 transition-colors disabled:opacity-50"
          >
            <Icon name="science" size={14} />
            {testing ? "Testing..." : "Test connection"}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-[12px] font-medium text-on-surface-variant/40 hover:text-on-surface-variant/65 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-secondary/15 px-4 py-2 text-[12px] font-semibold text-secondary hover:bg-secondary/20 transition-colors"
            >
              Connect runtime
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function RuntimeLoadingModal({
  title,
  message,
  activityLabel,
  onClose,
}: {
  title: string;
  message: string;
  activityLabel: string;
  onClose: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-4 w-full max-w-lg overflow-hidden rounded-xl bg-surface-container-low ghost">
        <div className="flex items-center justify-between px-6 py-5 ghost-b">
          <div>
            <h2 className="text-[15px] font-semibold text-on-surface tracking-tight">
              {title}
            </h2>
            <p className="mt-0.5 text-[12px] text-on-surface-variant/40">
              {message}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-on-surface-variant/30 hover:bg-surface-container-high/30 hover:text-on-surface-variant/60 transition-colors"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="flex items-center gap-3 px-6 py-6 text-sm text-on-surface-variant/55">
          <div className="h-2.5 w-2.5 rounded-full bg-tertiary shadow-[0_0_10px_rgba(209,255,215,0.35)]" />
          {activityLabel}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── OpenClaw card (live backend data) ── */

function OpenClawCard({
  config,
  onConfigure,
  onToggleEnabled,
  toggling,
}: {
  config: ApiOpenClawConfigSnapshot;
  onConfigure: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  toggling: boolean;
}) {
  const isConnected = config.health.status === "healthy";
  const enabled = config.enabled;

  return (
    <div className={`group relative overflow-hidden rounded-xl bg-surface-container-low ghost transition-all duration-200 ${!enabled ? "opacity-50" : ""}`}>
      {isConnected && enabled && (
        <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-tertiary/30 to-transparent" />
      )}

      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tertiary/8">
              <Icon name="terminal" size={20} className="text-tertiary/75" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-on-surface">
                OpenClaw
              </h3>
              <p className="mt-0.5 text-[11px] text-on-surface-variant/35">
                Local execution runtime
              </p>
            </div>
          </div>
          {enabled ? <StatusDot health={config.health} /> : (
            <span className="font-mono text-[9px] uppercase tracking-wider text-on-surface-variant/30">Disabled</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onConfigure}
            className="flex items-center gap-2 rounded-md bg-surface-container-high/40 px-4 py-2 text-[12px] font-medium text-on-surface/60 transition-colors hover:bg-surface-container-high/60 disabled:pointer-events-none disabled:opacity-40"
          >
            <Icon name="settings" size={14} />
            Configure
          </button>
          <button
            type="button"
            onClick={() => onToggleEnabled(!enabled)}
            disabled={toggling}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-medium transition-colors ${
              enabled
                ? "text-on-surface-variant/40 hover:bg-error/8 hover:text-error/70"
                : "bg-tertiary/10 text-tertiary hover:bg-tertiary/15"
            }`}
          >
            <Icon name={enabled ? "block" : "check_circle"} size={14} />
            {toggling ? (enabled ? "Disabling..." : "Enabling...") : enabled ? "Disable" : "Enable"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CodexCard({
  config,
  onConfigure,
  onToggleEnabled,
  toggling,
}: {
  config: ApiCodexConfigSnapshot;
  onConfigure: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  toggling: boolean;
}) {
  const isConnected = config.health.status === "healthy";
  const enabled = config.enabled;

  return (
    <div className={`group relative overflow-hidden rounded-xl bg-surface-container-low ghost transition-all duration-200 ${!enabled ? "opacity-50" : ""}`}>
      {isConnected && enabled && (
        <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-tertiary/30 to-transparent" />
      )}

      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/8">
              <Icon name="code" size={20} className="text-secondary/75" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-on-surface">
                Codex
              </h3>
              <p className="mt-0.5 text-[11px] text-on-surface-variant/35">
                OpenAI-powered runtime
              </p>
            </div>
          </div>
          {enabled ? <StatusDot health={config.health} /> : (
            <span className="font-mono text-[9px] uppercase tracking-wider text-on-surface-variant/30">Disabled</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onConfigure}
            className="flex items-center gap-2 rounded-md bg-surface-container-high/40 px-4 py-2 text-[12px] font-medium text-on-surface/60 transition-colors hover:bg-surface-container-high/60 disabled:pointer-events-none disabled:opacity-40"
          >
            <Icon name="settings" size={14} />
            Configure
          </button>
          <button
            type="button"
            onClick={() => onToggleEnabled(!enabled)}
            disabled={toggling}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-medium transition-colors ${
              enabled
                ? "text-on-surface-variant/40 hover:bg-error/8 hover:text-error/70"
                : "bg-tertiary/10 text-tertiary hover:bg-tertiary/15"
            }`}
          >
            <Icon name={enabled ? "block" : "check_circle"} size={14} />
            {toggling ? (enabled ? "Disabling..." : "Enabling...") : enabled ? "Disable" : "Enable"}
          </button>
          {enabled && (
            <div className="ml-auto text-right text-[11px] text-on-surface-variant/30">
              <div>{config.auth.message}</div>
              {config.current.defaultModel && (
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider">
                  {config.current.defaultModel}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClaudeCard({
  config,
  onConfigure,
  onToggleEnabled,
  toggling,
}: {
  config: ApiClaudeConfigSnapshot;
  onConfigure: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  toggling: boolean;
}) {
  const isConnected = config.health.status === "healthy";
  const enabled = config.enabled;

  return (
    <div className={`group relative overflow-hidden rounded-xl bg-surface-container-low ghost transition-all duration-200 ${!enabled ? "opacity-50" : ""}`}>
      {isConnected && enabled && (
        <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-tertiary/30 to-transparent" />
      )}

      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/8">
              <Icon name="cloud" size={20} className="text-secondary/75" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-on-surface">
                Claude Code
              </h3>
              <p className="mt-0.5 text-[11px] text-on-surface-variant/35">
                Anthropic-powered runtime
              </p>
            </div>
          </div>
          {enabled ? <StatusDot health={config.health} /> : (
            <span className="font-mono text-[9px] uppercase tracking-wider text-on-surface-variant/30">Disabled</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onConfigure}
            className="flex items-center gap-2 rounded-md bg-surface-container-high/40 px-4 py-2 text-[12px] font-medium text-on-surface/60 transition-colors hover:bg-surface-container-high/60 disabled:pointer-events-none disabled:opacity-40"
          >
            <Icon name="settings" size={14} />
            Configure
          </button>
          <button
            type="button"
            onClick={() => onToggleEnabled(!enabled)}
            disabled={toggling}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-medium transition-colors ${
              enabled
                ? "text-on-surface-variant/40 hover:bg-error/8 hover:text-error/70"
                : "bg-tertiary/10 text-tertiary hover:bg-tertiary/15"
            }`}
          >
            <Icon name={enabled ? "block" : "check_circle"} size={14} />
            {toggling ? (enabled ? "Disabling..." : "Enabling...") : enabled ? "Disable" : "Enable"}
          </button>
          {enabled && (
            <div className="ml-auto text-right text-[11px] text-on-surface-variant/30">
              <div>{config.auth.message}</div>
              {config.current.defaultModel && (
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider">
                  {config.current.defaultModel}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Static runtime card (Claude Code) ── */

function RuntimeCard({
  runtime,
  onConnect,
}: {
  runtime: RuntimeDef;
  onConnect: () => void;
}) {
  return (
    <div className="rounded-xl bg-surface-container-low ghost transition-all duration-200 hover:bg-surface-container-low/80">
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high/50">
              <Icon name={runtime.icon} size={20} className="text-on-surface-variant/40" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-on-surface">
                {runtime.name}
              </h3>
              <p className="mt-0.5 text-[11px] text-on-surface-variant/35">
                {runtime.tagline}
              </p>
            </div>
          </div>
          <StaticStatusBadge status={runtime.status} />
        </div>

        <button
          type="button"
          onClick={onConnect}
          className="flex items-center gap-2 rounded-md bg-secondary/10 px-4 py-2 text-[12px] font-semibold text-secondary transition-colors hover:bg-secondary/15"
        >
          <Icon name="link" size={14} />
          Connect runtime
        </button>
      </div>
    </div>
  );
}

/* ── Page ── */

export default function RuntimesPage() {
  const [catalog, setCatalog] = useState<ApiOpenClawCatalog | null>(null);
  const [config, setConfig] = useState<ApiOpenClawConfigSnapshot | null>(null);
  const [codexCatalog, setCodexCatalog] = useState<ApiCodexCatalog | null>(null);
  const [codexConfig, setCodexConfig] = useState<ApiCodexConfigSnapshot | null>(null);
  const [claudeCatalog, setClaudeCatalog] = useState<ApiClaudeCatalog | null>(null);
  const [claudeConfig, setClaudeConfig] = useState<ApiClaudeConfigSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [codexCatalogLoading, setCodexCatalogLoading] = useState(false);
  const [claudeCatalogLoading, setClaudeCatalogLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState<"openclaw" | "codex" | "claude" | string | null>(null);
  const [togglingRuntime, setTogglingRuntime] = useState<"openclaw" | "codex" | "claude" | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [cfg, nextCodexConfig, nextClaudeConfig] = await Promise.all([
          getOpenClawConfig(),
          getCodexConfig(),
          getClaudeConfig(),
        ]);
        if (!cancelled) {
          setConfig(cfg);
          setCodexConfig(nextCodexConfig);
          setClaudeConfig(nextClaudeConfig);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof ApiError ? e.message : "Unable to load runtime data."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  async function handleConfigureOpenClaw() {
    setError(null);
    setConfiguring("openclaw");

    if (catalog || catalogLoading) {
      return;
    }

    setCatalogLoading(true);
    try {
      const nextCatalog = await getOpenClawCatalog();
      setCatalog(nextCatalog);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Unable to load detailed OpenClaw runtime data."
      );
      setConfiguring(null);
    } finally {
      setCatalogLoading(false);
    }
  }

  async function handleConfigureCodex() {
    setError(null);
    setConfiguring("codex");

    if (codexCatalog || codexCatalogLoading) {
      return;
    }

    setCodexCatalogLoading(true);
    try {
      const nextCatalog = await getCodexCatalog();
      setCodexCatalog(nextCatalog);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Unable to load detailed Codex runtime data."
      );
      setConfiguring(null);
    } finally {
      setCodexCatalogLoading(false);
    }
  }

  async function handleConfigureClaude() {
    setError(null);
    setConfiguring("claude");

    if (claudeCatalog || claudeCatalogLoading) {
      return;
    }

    setClaudeCatalogLoading(true);
    try {
      const nextCatalog = await getClaudeCatalog();
      setClaudeCatalog(nextCatalog);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Unable to load detailed Claude Code runtime data."
      );
      setConfiguring(null);
    } finally {
      setClaudeCatalogLoading(false);
    }
  }

  async function handleToggleOpenClaw(enabled: boolean) {
    setTogglingRuntime("openclaw");
    setError(null);
    try {
      const snapshot = await setOpenClawEnabled({ enabled });
      setConfig(snapshot);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Unable to update the OpenClaw runtime state."
      );
    } finally {
      setTogglingRuntime(null);
    }
  }

  async function handleToggleCodex(enabled: boolean) {
    setTogglingRuntime("codex");
    setError(null);
    try {
      const snapshot = await setCodexEnabled({ enabled });
      setCodexConfig(snapshot);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Unable to update the Codex runtime state."
      );
    } finally {
      setTogglingRuntime(null);
    }
  }

  async function handleToggleClaude(enabled: boolean) {
    setTogglingRuntime("claude");
    setError(null);
    try {
      const snapshot = await setClaudeEnabled({ enabled });
      setClaudeConfig(snapshot);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Unable to update the Claude Code runtime state."
      );
    } finally {
      setTogglingRuntime(null);
    }
  }

  const openClawConnected = config?.enabled && config.health.status === "healthy";
  const codexConnected = codexConfig?.enabled && codexConfig.health.status === "healthy";
  const claudeConnected = claudeConfig?.enabled && claudeConfig.health.status === "healthy";
  const connectedCount =
    (openClawConnected ? 1 : 0) +
    (codexConnected ? 1 : 0) +
    (claudeConnected ? 1 : 0);
  const totalCount = staticRuntimes.length + 3;

  const activeRuntimes = [
    ...(openClawConnected ? ["openclaw"] : []),
    ...(codexConnected ? ["codex"] : []),
    ...(claudeConnected ? ["claude"] : []),
  ];
  const configuringStatic = staticRuntimes.find((r) => r.id === configuring);

  return (
    <div className="h-full overflow-y-auto pr-2 scrollbar-thin">
      <div className="mx-auto max-w-4xl pb-16">
        {/* Header */}
        <div className="mb-10 anim-1">
          <div className="flex items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl font-bold tracking-[-0.03em] text-on-surface">
                Runtimes
              </h1>
              <p className="mt-1.5 text-[13px] text-on-surface-variant/40">
                Execution providers that power your agents. Connect and configure each runtime below.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-surface-container-low px-4 py-2.5 ghost">
              <div className="h-2 w-2 rounded-full bg-tertiary shadow-[0_0_6px_rgba(209,255,215,0.3)]" />
              <span className="font-mono text-[10px] text-on-surface-variant/40">
                <span className="font-semibold text-tertiary/60">{connectedCount}</span>{" "}
                of {totalCount} connected
              </span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-8 rounded-lg border border-error/20 bg-error/8 px-4 py-3 text-sm text-error/85">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            <div className="h-56 rounded-xl bg-surface-container-low shimmer" />
            <div className="h-48 rounded-xl bg-surface-container-low shimmer" />
            <div className="h-48 rounded-xl bg-surface-container-low shimmer" />
          </div>
        )}

        {/* Content */}
        {!loading && config && codexConfig && claudeConfig && (
          <>
            {/* Active section */}
            {activeRuntimes.length > 0 && (
              <section className="mb-8 anim-2">
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="h-4 w-1 rounded-full bg-tertiary glow-green" />
                  <h2 className="text-[12px] font-bold uppercase tracking-wider text-on-surface-variant/50">
                    Active
                  </h2>
                </div>
                <OpenClawCard
                  config={config}
                  onConfigure={() => void handleConfigureOpenClaw()}
                  onToggleEnabled={(enabled) => void handleToggleOpenClaw(enabled)}
                  toggling={togglingRuntime === "openclaw"}
                />
                {codexConnected && (
                  <div className="mt-3">
                    <CodexCard
                      config={codexConfig}
                      onConfigure={() => void handleConfigureCodex()}
                      onToggleEnabled={(enabled) => void handleToggleCodex(enabled)}
                      toggling={togglingRuntime === "codex"}
                    />
                  </div>
                )}
                {claudeConnected && (
                  <div className="mt-3">
                    <ClaudeCard
                      config={claudeConfig}
                      onConfigure={() => void handleConfigureClaude()}
                      onToggleEnabled={(enabled) => void handleToggleClaude(enabled)}
                      toggling={togglingRuntime === "claude"}
                    />
                  </div>
                )}
              </section>
            )}

            {/* Available section */}
            <section className="anim-3">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="h-4 w-1 rounded-full bg-secondary/40" />
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-on-surface-variant/50">
                  Available
                </h2>
              </div>
              <div className="space-y-3">
                {!openClawConnected && (
                  <OpenClawCard
                    config={config}
                    onConfigure={() => void handleConfigureOpenClaw()}
                    onToggleEnabled={(enabled) => void handleToggleOpenClaw(enabled)}
                    toggling={togglingRuntime === "openclaw"}
                  />
                )}
                {!codexConnected && (
                  <CodexCard
                    config={codexConfig}
                    onConfigure={() => void handleConfigureCodex()}
                    onToggleEnabled={(enabled) => void handleToggleCodex(enabled)}
                    toggling={togglingRuntime === "codex"}
                  />
                )}
                {!claudeConnected && (
                  <ClaudeCard
                    config={claudeConfig}
                    onConfigure={() => void handleConfigureClaude()}
                    onToggleEnabled={(enabled) => void handleToggleClaude(enabled)}
                    toggling={togglingRuntime === "claude"}
                  />
                )}
                {staticRuntimes.map((rt) => (
                  <RuntimeCard
                    key={rt.id}
                    runtime={rt}
                    onConnect={() => setConfiguring(rt.id)}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {/* OpenClaw configure modal */}
      {configuring === "openclaw" && config && (
        catalog ? (
          <OpenClawConfigureModal
            catalog={catalog}
            config={config}
            onClose={() => setConfiguring(null)}
            onSaved={(snapshot) => {
              setConfig(snapshot);
              setCatalog((prev) =>
                prev
                  ? {
                      ...prev,
                      health: snapshot.health,
                      configPath: snapshot.current.configPath,
                      stateDir: snapshot.current.stateDir,
                      gateway: {
                        ...prev.gateway,
                        url: snapshot.health.gatewayUrl,
                      },
                    }
                  : prev
              );
            }}
          />
        ) : (
          <RuntimeLoadingModal
            title="Loading OpenClaw details"
            message="Fetching model catalog and agent details from the local runtime."
            activityLabel="Connecting to OpenClaw…"
            onClose={() => setConfiguring(null)}
          />
        )
      )}

      {configuring === "codex" && codexConfig && (
        codexCatalog ? (
          <CodexConfigureModal
            catalog={codexCatalog}
            config={codexConfig}
            onClose={() => setConfiguring(null)}
            onSaved={(snapshot) => {
              setCodexConfig(snapshot);
            }}
          />
        ) : (
          <RuntimeLoadingModal
            title="Loading Codex details"
            message="Fetching model catalog and runtime details."
            activityLabel="Connecting to Codex…"
            onClose={() => setConfiguring(null)}
          />
        )
      )}

      {configuring === "claude" && claudeConfig && (
        claudeCatalog ? (
          <ClaudeConfigureModal
            catalog={claudeCatalog}
            config={claudeConfig}
            onClose={() => setConfiguring(null)}
            onSaved={(snapshot) => {
              setClaudeConfig(snapshot);
            }}
          />
        ) : (
          <RuntimeLoadingModal
            title="Loading Claude details"
            message="Fetching model catalog and runtime details."
            activityLabel="Connecting to Claude Code…"
            onClose={() => setConfiguring(null)}
          />
        )
      )}

      {/* Static runtime configure modal */}
      {configuringStatic && (
        <StaticConfigureModal
          runtime={configuringStatic}
          onClose={() => setConfiguring(null)}
        />
      )}
    </div>
  );
}
