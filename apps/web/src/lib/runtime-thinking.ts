import type { ApiRuntimeKind, ApiThinkingLevel } from "@/lib/api";

export type ThinkingOption = {
  value: ApiThinkingLevel;
  label: string;
};

const OPENCLAW_THINKING_OPTIONS: ThinkingOption[] = [
  { value: "off", label: "Off" },
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" },
];

const CODEX_THINKING_OPTIONS: ThinkingOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" },
];

const CLAUDE_THINKING_OPTIONS: ThinkingOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Max" },
];

export function normalizeThinkingLevelForRuntime(
  kind: ApiRuntimeKind,
  level: ApiThinkingLevel
): ApiThinkingLevel {
  if (kind === "claude-code" || kind === "codex") {
    if (level === "off" || level === "minimal") {
      return "low";
    }
  }

  return level;
}

export function getThinkingOptionsForRuntime(
  kind: ApiRuntimeKind
): ThinkingOption[] {
  switch (kind) {
    case "codex":
      return CODEX_THINKING_OPTIONS;
    case "claude-code":
      return CLAUDE_THINKING_OPTIONS;
    default:
      return OPENCLAW_THINKING_OPTIONS;
  }
}

export function formatThinkingLevelLabelForRuntime(
  kind: ApiRuntimeKind,
  level: ApiThinkingLevel
): string {
  const normalized = normalizeThinkingLevelForRuntime(kind, level);

  return (
    getThinkingOptionsForRuntime(kind).find((option) => option.value === normalized)
      ?.label ?? normalized
  );
}
