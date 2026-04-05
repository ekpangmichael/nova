import type { ApiRunEvent } from "@/lib/api";
import {
  formatTimestampForDisplay,
  type DisplayPreferences,
} from "@/lib/display-preferences";
import type { ExecutionLogItem } from "@/types";

export function formatRuntimeLabel(
  runtimeKind: "openclaw-native" | "codex" | "claude-code" | string | null | undefined
) {
  switch (runtimeKind) {
    case "openclaw-native":
      return "OpenClaw";
    case "codex":
      return "Codex";
    case "claude-code":
      return "Claude";
    default:
      return runtimeKind ?? null;
  }
}

export function getRunEventDescription(event: ApiRunEvent) {
  const payload = (event.payload ?? {}) as Record<string, unknown>;

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }

  if (typeof payload.delta === "string" && payload.delta.trim()) {
    return payload.delta.trim();
  }

  if (typeof payload.reason === "string" && payload.reason.trim()) {
    return payload.reason.trim();
  }

  if (typeof payload.finalSummary === "string" && payload.finalSummary.trim()) {
    return payload.finalSummary.trim();
  }

  if (typeof payload.toolName === "string" && payload.toolName.trim()) {
    return payload.toolName.trim();
  }

  if (typeof payload.path === "string" && payload.path.trim()) {
    return payload.path.trim();
  }

  return "Runtime event received.";
}

export function compactRunEvents(events: ApiRunEvent[]) {
  const compacted: ApiRunEvent[] = [];
  let pendingDelta: ApiRunEvent | null = null;

  for (const event of events) {
    if (event.eventType === "usage") {
      continue;
    }

    if (event.eventType === "message.delta") {
      pendingDelta = event;
      continue;
    }

    if (event.eventType === "message.completed") {
      pendingDelta = null;
      compacted.push(event);
      continue;
    }

    const last = compacted.at(-1);

    if (
      last &&
      last.eventType === event.eventType &&
      last.createdAt === event.createdAt &&
      JSON.stringify(last.payload ?? null) === JSON.stringify(event.payload ?? null)
    ) {
      continue;
    }

    compacted.push(event);
  }

  if (pendingDelta) {
    compacted.push(pendingDelta);
  }

  return compacted;
}

export function getRunEventIcon(event: ApiRunEvent) {
  return event.eventType === "run.completed"
    ? "check_circle"
    : event.eventType === "run.failed"
      ? "error"
      : event.eventType === "run.aborted"
        ? "stop_circle"
        : event.eventType.startsWith("tool.")
          ? "build"
          : event.eventType === "artifact.created"
            ? "draft"
            : event.eventType === "message.completed"
              ? "forum"
              : "play_circle";
}

export function getRunEventTitle(event: ApiRunEvent) {
  return event.eventType === "message.delta"
    ? "streaming response"
    : event.eventType === "message.completed"
      ? "assistant reply"
      : event.eventType.replace(/\./g, " ");
}

export function buildEventLog(
  events: ApiRunEvent[],
  preferences: DisplayPreferences,
  runtimeKind?: "openclaw-native" | "codex" | "claude-code" | string | null
): ExecutionLogItem[] {
  const visibleEvents = compactRunEvents(events).slice(-12).reverse();
  const runtimeLabel = formatRuntimeLabel(runtimeKind);

  return visibleEvents.map((event) => ({
    icon: getRunEventIcon(event),
    title: getRunEventTitle(event),
    description: getRunEventDescription(event),
    timeAgo: formatTimestampForDisplay(event.createdAt, preferences),
    runtimeLabel: runtimeLabel ?? undefined,
  }));
}
