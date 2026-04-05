import type { ThinkingLevel } from "@nova/shared";

export function toClaudeEffort(
  level: ThinkingLevel | null | undefined
): "low" | "medium" | "high" | "max" | null {
  switch (level) {
    case null:
    case undefined:
    case "off":
      return null;
    case "minimal":
      return "low";
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
    case "xhigh":
      return "max";
    default:
      return null;
  }
}

export function toCodexReasoningEffort(
  level: ThinkingLevel | null | undefined
): "low" | "medium" | "high" | "xhigh" | null {
  switch (level) {
    case null:
    case undefined:
    case "off":
      return null;
    case "minimal":
      return "low";
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
    case "xhigh":
      return "xhigh";
    default:
      return null;
  }
}
