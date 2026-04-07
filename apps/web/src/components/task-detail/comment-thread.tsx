"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "@/components/ui/icon";
import {
  addTaskComment,
  ApiError,
  type ApiAgent,
  type ApiRunEvent,
  type ApiThinkingLevel,
} from "@/lib/api";
import {
  isAllowedTaskAttachment,
  MAX_TASK_ATTACHMENT_BYTES,
  TASK_ATTACHMENT_ACCEPT_ATTR,
} from "@/lib/task-attachments";
import {
  formatThinkingLevelLabelForRuntime,
  getThinkingOptionsForRuntime,
} from "@/lib/runtime-thinking";
import { cn } from "@/lib/utils";

type CommentView = {
  id: string;
  author: string;
  isAI: boolean;
  timeLabel: string;
  message: string;
  attachments: Array<{
    id: string;
    name: string;
    size: string;
    type: string;
    icon: string;
    isImage: boolean;
    contentUrl: string;
  }>;
};

type MentionableAgent = Pick<ApiAgent, "id" | "slug" | "name" | "role" | "status" | "runtime"> & {
  isCurrentAssignee: boolean;
  isAssignedToProject: boolean;
};

type ActiveMention = {
  query: string;
  start: number;
  end: number;
};

type CommentThinkingLevel = ApiThinkingLevel | "default";

function extractMentionTokens(body: string) {
  return [
    ...new Set(
      [...body.matchAll(/(^|[\s(])@([a-zA-Z0-9][a-zA-Z0-9._-]*)/g)].map(
        (match) => match[2].toLowerCase()
      )
    ),
  ];
}

function getActiveMention(text: string, caret: number): ActiveMention | null {
  const beforeCaret = text.slice(0, caret);
  const match = beforeCaret.match(/(^|[\s(])@([a-zA-Z0-9._-]*)$/);

  if (!match) {
    return null;
  }

  const query = match[2] ?? "";
  const start = caret - query.length - 1;
  let end = caret;

  while (end < text.length && /[a-zA-Z0-9._-]/.test(text[end] ?? "")) {
    end += 1;
  }

  return {
    query,
    start,
    end,
  };
}

function matchesAgent(agent: MentionableAgent, query: string) {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return true;
  }

  return [agent.slug, agent.name, agent.role, agent.runtime.defaultModelId ?? ""]
    .some((value) => value.toLowerCase().includes(needle));
}

function sortMentionableAgents(left: MentionableAgent, right: MentionableAgent) {
  if (left.isCurrentAssignee !== right.isCurrentAssignee) {
    return left.isCurrentAssignee ? -1 : 1;
  }

  if (left.isAssignedToProject !== right.isAssignedToProject) {
    return left.isAssignedToProject ? -1 : 1;
  }

  if (left.status !== right.status) {
    if (left.status === "idle") {
      return -1;
    }

    if (right.status === "idle") {
      return 1;
    }
  }

  return left.name.localeCompare(right.name);
}

/** Splits React children so that `@slug` tokens become styled mention pills. */
function renderWithMentions(children: React.ReactNode): React.ReactNode {
  if (typeof children === "string") {
    const parts = children.split(/(@[a-zA-Z0-9._-]+)/g);
    if (parts.length === 1) return children;

    return parts.map((part, i) => {
      if (/^@[a-zA-Z0-9._-]+$/.test(part)) {
        return (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-md bg-secondary/10 px-1.5 py-0.5 align-baseline font-medium text-secondary text-[12px] leading-none"
          >
            <Icon name="smart_toy" size={11} className="shrink-0 opacity-60" />
            {part}
          </span>
        );
      }
      return part;
    });
  }

  if (Array.isArray(children)) {
    return children.map((child, i) =>
      typeof child === "string" ? (
        <React.Fragment key={i}>{renderWithMentions(child)}</React.Fragment>
      ) : (
        child
      )
    );
  }

  return children;
}

function CommentMarkdown({
  message,
  isAI,
  collapsed,
  onToggle,
}: {
  message: string;
  isAI: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="relative">
      <div
        className={cn(
          "text-[13px] leading-[1.6]",
          isAI ? "text-on-surface-variant/90" : "text-on-surface-variant",
          collapsed && "max-h-[200px] overflow-hidden"
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="mb-2.5 last:mb-0">{renderWithMentions(children)}</p>,
            ul: ({ children }) => (
              <ul className="mb-2.5 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-2.5 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
            ),
            li: ({ children }) => <li className="marker:text-secondary">{renderWithMentions(children)}</li>,
            a: ({ children, href }) => (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-secondary underline underline-offset-4 transition-colors hover:text-secondary-dim"
              >
                {children}
              </a>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-on-surface">{children}</strong>
            ),
            em: ({ children }) => <em className="italic text-on-surface/90">{children}</em>,
            blockquote: ({ children }) => (
              <blockquote className="mb-2.5 border-l-2 border-secondary/40 pl-4 text-on-surface/80 last:mb-0">
                {children}
              </blockquote>
            ),
            code: ({ children }) => (
              <code className="rounded-sm bg-surface-container-high px-1.5 py-0.5 font-mono text-[0.8em] text-secondary">
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="mb-2.5 overflow-x-auto rounded-lg bg-surface-container-lowest/90 p-2.5 font-mono text-[11px] text-on-surface last:mb-0">
                {children}
              </pre>
            ),
            hr: () => <hr className="my-3 border-outline-variant/20" />,
          }}
        >
          {message}
        </ReactMarkdown>
      </div>
      {collapsed && (
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-center bg-gradient-to-t from-surface-container-low via-surface-container-low/80 to-transparent pb-1 pt-10">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-1 rounded-full bg-surface-container-high/80 px-3 py-1 text-[11px] font-medium text-on-surface-variant/60 backdrop-blur-sm transition-colors hover:text-on-surface-variant"
          >
            Show more
            <Icon name="expand_more" size={14} />
          </button>
        </div>
      )}
      {collapsed === false && onToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 flex items-center gap-1 text-[11px] font-medium text-on-surface-variant/50 transition-colors hover:text-on-surface-variant"
        >
          Show less
          <Icon name="expand_less" size={14} />
        </button>
      )}
    </div>
  );
}

function formatStreamTimeAgo(createdAt: string) {
  const seconds = Math.round((Date.now() - new Date(createdAt).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

function extractDeltaText(event: ApiRunEvent): string | null {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  // OpenClaw / mock use `delta`, Claude uses `message`
  if (typeof payload.delta === "string") return payload.delta;
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.content === "string") return payload.content;
  if (typeof payload.text === "string") return payload.text;
  return null;
}

function getStreamEventText(event: ApiRunEvent) {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const t = event.eventType;

  if (t === "run.accepted") return "Run accepted by runtime.";
  if (t === "run.started") return "Run started in execution target.";
  if (t === "run.completed") return "Run completed.";
  if (t === "run.failed") {
    const reason = typeof payload.reason === "string" ? payload.reason : "";
    return reason ? `Run failed: ${reason}` : "Run failed.";
  }
  if (t === "run.aborted") return "Run aborted.";
  if (t === "tool.started" && typeof payload.toolName === "string") {
    return `Tool started: ${payload.toolName}`;
  }
  if (t === "tool.completed" && typeof payload.toolName === "string") {
    return `Tool completed: ${payload.toolName}`;
  }
  if (t === "artifact.created" && typeof payload.path === "string") {
    return `File created: ${payload.path}`;
  }
  if (t === "message.completed") {
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }
    if (typeof payload.finalSummary === "string" && payload.finalSummary.trim()) {
      return payload.finalSummary.trim();
    }
    return "Response complete.";
  }
  if (t === "warning" && typeof payload.message === "string") return payload.message;
  if (t === "error" && typeof payload.message === "string") return payload.message;
  return t.replace(/\./g, " ");
}

type StreamLogEntry =
  | { kind: "event"; event: ApiRunEvent; text: string }
  | { kind: "assistant"; text: string; timestamp: string };

function buildStreamLog(events: ApiRunEvent[]): StreamLogEntry[] {
  const entries: StreamLogEntry[] = [];
  let accumulatedText = "";
  let lastDeltaTimestamp = "";

  for (const event of events) {
    if (event.eventType === "usage") continue;

    if (event.eventType === "message.delta") {
      const delta = extractDeltaText(event);
      if (delta) {
        accumulatedText += delta;
        lastDeltaTimestamp = event.createdAt;
      }
      continue;
    }

    // Flush accumulated text before a non-delta event
    if (accumulatedText) {
      entries.push({ kind: "assistant", text: accumulatedText, timestamp: lastDeltaTimestamp });
      accumulatedText = "";
    }

    if (event.eventType === "message.completed") {
      // message.completed carries the full assistant reply.
      // Different runtimes use different payload fields:
      //   Codex  → payload.message
      //   Claude → payload.finalSummary
      //   Mock   → payload.message / payload.delta
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const completedText =
        (typeof payload.message === "string" && payload.message.trim()) ||
        (typeof payload.finalSummary === "string" && payload.finalSummary.trim()) ||
        (typeof payload.content === "string" && payload.content.trim()) ||
        (typeof payload.text === "string" && payload.text.trim()) ||
        (typeof payload.delta === "string" && payload.delta.trim()) ||
        null;
      if (completedText) {
        entries.push({ kind: "assistant", text: completedText, timestamp: event.createdAt });
      }
      continue;
    }

    entries.push({ kind: "event", event, text: getStreamEventText(event) });
  }

  // Flush any trailing deltas
  if (accumulatedText) {
    entries.push({ kind: "assistant", text: accumulatedText, timestamp: lastDeltaTimestamp });
  }

  return entries;
}

const StreamLogContext = React.createContext<{
  collapsed: boolean;
  toggle: () => void;
}>({ collapsed: false, toggle: () => {} });

function AgentStreamingLogToggle() {
  const { collapsed, toggle } = React.useContext(StreamLogContext);
  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-1 text-[11px] text-on-surface-variant/30 hover:text-on-surface-variant/60 transition-colors"
    >
      <Icon name={collapsed ? "visibility" : "visibility_off"} size={12} />
      {collapsed ? "Show logs" : "Hide"}
    </button>
  );
}

function AgentStreamingLog({ events }: { events: ApiRunEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { collapsed } = React.useContext(StreamLogContext);
  const [, setTick] = useState(0);
  const prevLengthRef = useRef(0);

  const entries = useMemo(() => buildStreamLog(events), [events]);

  // Auto-scroll, but only when new entries arrive
  useEffect(() => {
    if (scrollRef.current && entries.length > prevLengthRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevLengthRef.current = entries.length;
  }, [entries.length, events.length]);

  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  if (entries.length === 0 || collapsed) {
    return null;
  }

  return (
    <div className="border-t border-tertiary/6">
      <div
        ref={scrollRef}
        className="max-h-[320px] overflow-y-auto overflow-x-hidden scrollbar-thin"
      >
        <div className="relative px-4 py-3">
          {/* Fade-in gradient at top when scrollable */}
          <div className="pointer-events-none sticky top-0 -mt-3 mb-1 h-4 bg-gradient-to-b from-surface-container-low to-transparent" />
          <div className="space-y-1.5">
            {entries.map((entry, i) => {
              const isLast = i === entries.length - 1;

              if (entry.kind === "assistant") {
                return (
                  <div
                    key={`assistant-${i}`}
                    className={cn(
                      "break-words whitespace-pre-wrap rounded-lg px-3 py-2 text-[13px] leading-[1.7] text-on-surface-variant/80 bg-tertiary/[0.04]",
                      isLast && "ring-1 ring-tertiary/10"
                    )}
                  >
                    {entry.text}
                  </div>
                );
              }

              const t = entry.event.eventType;
              const isError = t === "error" || t === "run.failed";
              const isCompleted = t === "run.completed";
              const isTool = t === "tool.started" || t === "tool.completed";
              const isToolStart = t === "tool.started";
              const isArtifact = t === "artifact.created";
              const isMuted = t === "run.started" || t === "tool.completed" || t === "run.accepted";

              return (
                <div
                  key={entry.event.id}
                  className={cn(
                    "group flex items-start gap-2 break-words text-[12px] leading-relaxed transition-opacity",
                    isTool && "py-0.5",
                    isLast && "animate-in fade-in duration-200",
                  )}
                >
                  {/* Contextual icon */}
                  <span className={cn("mt-[3px] flex shrink-0 items-center justify-center", isTool ? "w-4" : "w-4")}>
                    {isTool ? (
                      <Icon
                        name={isToolStart ? "chevron_right" : "check"}
                        size={12}
                        className={cn(
                          isToolStart ? "text-tertiary/60" : "text-tertiary/30"
                        )}
                      />
                    ) : isError ? (
                      <Icon name="error" size={12} className="text-error/60" />
                    ) : isCompleted ? (
                      <Icon name="check_circle" size={12} className="text-tertiary/50" />
                    ) : isArtifact ? (
                      <Icon name="draft" size={12} className="text-secondary/40" />
                    ) : (
                      <span className={cn(
                        "h-1 w-1 rounded-full",
                        isLast ? "bg-tertiary/60" : "bg-on-surface-variant/20"
                      )} />
                    )}
                  </span>

                  <p
                    className={cn(
                      "min-w-0",
                      isError
                        ? "font-medium text-error/70"
                        : isCompleted
                          ? "font-medium text-tertiary/70"
                          : isTool
                            ? isToolStart
                              ? "font-medium text-on-surface-variant/60"
                              : "text-tertiary/35"
                            : isArtifact
                              ? "text-secondary/50"
                              : isMuted
                                ? "text-on-surface-variant/35"
                                : "text-on-surface-variant/55"
                    )}
                  >
                    {!isTool && (
                      <span className="mr-1.5 font-mono text-[10px] text-on-surface-variant/20">
                        {formatStreamTimeAgo(entry.event.createdAt)}
                      </span>
                    )}
                    {entry.text}
                  </p>
                </div>
              );
            })}
          </div>
          {/* Cursor blink indicator for active streaming */}
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-tertiary/30">
            <span className="h-3 w-px animate-pulse bg-tertiary/40" />
            <span>streaming</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommentThread({
  taskId,
  comments,
  agents = [],
  assignedAgentId,
  projectAgentIds = [],
  disabled = false,
  onCommentCreated,
  agentWorking = false,
  onStopAgent,
  isStopping = false,
  streamingEvents = [],
}: {
  taskId: string;
  comments: CommentView[];
  agents: ApiAgent[];
  assignedAgentId: string;
  projectAgentIds: string[];
  disabled?: boolean;
  onCommentCreated?: () => Promise<void> | void;
  agentWorking?: boolean;
  onStopAgent?: () => void;
  isStopping?: boolean;
  streamingEvents?: ApiRunEvent[];
}) {
  const [input, setInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [selectedAttachments, setSelectedAttachments] = useState<File[]>([]);
  const [selectedThinkingLevel, setSelectedThinkingLevel] =
    useState<CommentThinkingLevel>("default");
  const [streamLogCollapsed, setStreamLogCollapsed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const streamLogCtx = useMemo(
    () => ({ collapsed: streamLogCollapsed, toggle: () => setStreamLogCollapsed((v) => !v) }),
    [streamLogCollapsed]
  );

  const LONG_COMMENT_THRESHOLD = 400;

  const VISIBLE_COUNT = 3;
  const hasHidden = comments.length > VISIBLE_COUNT;
  const hiddenCount = comments.length - VISIBLE_COUNT;
  const visibleComments = showAll ? comments : comments.slice(-VISIBLE_COUNT);
  const mentionableAgents = useMemo(
    () =>
      [...(Array.isArray(agents) ? agents : [])]
        .map((agent) => ({
          ...agent,
          isCurrentAssignee: agent.id === assignedAgentId,
          isAssignedToProject: (Array.isArray(projectAgentIds) ? projectAgentIds : []).includes(agent.id),
        }))
        .sort(sortMentionableAgents),
    [agents, assignedAgentId, projectAgentIds]
  );
  const filteredMentionAgents = useMemo(() => {
    if (!activeMention) {
      return [];
    }

    const matches = mentionableAgents.filter((agent) =>
      matchesAgent(agent, activeMention.query)
    );

    return activeMention.query.trim() ? matches.slice(0, 6) : matches.slice(0, 3);
  }, [activeMention, mentionableAgents]);
  const targetAgentForThinking = useMemo(() => {
    const mentionedTokens = extractMentionTokens(input);

    if (mentionedTokens.length === 1) {
      const matchedAgent = mentionableAgents.find(
        (agent) => agent.slug.toLowerCase() === mentionedTokens[0]
      );

      if (matchedAgent) {
        return matchedAgent;
      }
    }

    return (
      mentionableAgents.find((agent) => agent.id === assignedAgentId) ??
      mentionableAgents[0] ??
      null
    );
  }, [assignedAgentId, input, mentionableAgents]);
  const thinkingOptions = useMemo(
    () => [
      {
        value: "default" as const,
        label: targetAgentForThinking
          ? formatThinkingLevelLabelForRuntime(
              targetAgentForThinking.runtime.kind,
              targetAgentForThinking.runtime.defaultThinkingLevel
            )
          : "Default",
      },
      ...getThinkingOptionsForRuntime(
        targetAgentForThinking?.runtime.kind ?? "openclaw-native"
      ),
    ],
    [targetAgentForThinking]
  );

  useEffect(() => {
    if (
      selectedThinkingLevel !== "default" &&
      !thinkingOptions.some((option) => option.value === selectedThinkingLevel)
    ) {
      setSelectedThinkingLevel("default");
    }
  }, [selectedThinkingLevel, thinkingOptions]);

  useEffect(() => {
    setActiveMentionIndex((current) =>
      filteredMentionAgents.length === 0
        ? 0
        : Math.min(current, filteredMentionAgents.length - 1)
    );
  }, [filteredMentionAgents]);

  function closeMentionPicker() {
    setActiveMention(null);
    setActiveMentionIndex(0);
  }

  function syncMentionState(value: string, caret: number) {
    const nextMention = getActiveMention(value, caret);
    setActiveMention((current) => {
      const mentionChanged =
        current?.query !== nextMention?.query ||
        current?.start !== nextMention?.start ||
        current?.end !== nextMention?.end;

      if (mentionChanged) {
        setActiveMentionIndex(0);
      }

      return nextMention;
    });
  }

  function selectMention(agent: MentionableAgent) {
    const textarea = textareaRef.current;
    const mention = activeMention;

    if (!textarea || !mention) {
      return;
    }

    const nextValue =
      `${input.slice(0, mention.start)}@${agent.slug} ${input.slice(mention.end)}`;
    const nextCaret = mention.start + agent.slug.length + 2;

    setInput(nextValue);
    closeMentionPicker();

    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function handleAttachmentSelection(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const accepted: File[] = [];
    const rejected: string[] = [];

    for (const file of Array.from(fileList)) {
      if (file.size > MAX_TASK_ATTACHMENT_BYTES) {
        rejected.push(`${file.name} exceeds 25 MB`);
        continue;
      }

      if (!isAllowedTaskAttachment({ fileName: file.name, mimeType: file.type })) {
        rejected.push(`${file.name} is not a supported file type`);
        continue;
      }

      accepted.push(file);
    }

    if (accepted.length > 0) {
      setSelectedAttachments((current) => {
        const existingKeys = new Set(
          current.map((file) => `${file.name}:${file.size}:${file.lastModified}`)
        );
        const next = [...current];

        for (const file of accepted) {
          const key = `${file.name}:${file.size}:${file.lastModified}`;
          if (!existingKeys.has(key)) {
            existingKeys.add(key);
            next.push(file);
          }
        }

        return next;
      });
    }

    if (rejected.length > 0) {
      setErrorMessage(rejected.join(". "));
    }

    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  }

  function removeSelectedAttachment(fileToRemove: File) {
    setSelectedAttachments((current) =>
      current.filter(
        (file) =>
          !(
            file.name === fileToRemove.name &&
            file.size === fileToRemove.size &&
            file.lastModified === fileToRemove.lastModified
          )
      )
    );
  }

  async function handleSubmit() {
    if ((!input.trim() && selectedAttachments.length === 0) || isSubmitting || disabled) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await addTaskComment(taskId, {
        body: input.trim(),
        attachments: selectedAttachments,
        thinkingLevel:
          selectedThinkingLevel === "default" ? null : selectedThinkingLevel,
      });
      setInput("");
      setSelectedAttachments([]);
      setSelectedThinkingLevel("default");
      closeMentionPicker();
      await onCommentCreated?.();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to add the comment right now."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 pt-6 border-t border-outline-variant/10">
      <div className="flex items-center gap-2">
        <Icon name="forum" size={16} className="text-on-surface-variant/40" />
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60">
          Comment Thread
        </h3>
        <span className="rounded-full bg-surface-container-high/60 px-2 py-0.5 text-[10px] font-bold tabular-nums text-on-surface-variant/50">{comments.length}</span>
      </div>

      {comments.length > 0 ? (
        <div className="space-y-4">
          {hasHidden && !showAll ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="flex w-full items-center justify-center gap-2 py-2 text-[11px] text-on-surface-variant/50 hover:text-on-surface-variant transition-colors"
            >
              <span className="h-px flex-1 bg-outline-variant/15" />
              <span>Show {hiddenCount} earlier {hiddenCount === 1 ? "message" : "messages"}</span>
              <span className="h-px flex-1 bg-outline-variant/15" />
            </button>
          ) : null}
          {visibleComments.map((comment) => {
            const isLong = comment.message.length > LONG_COMMENT_THRESHOLD;
            const isExpanded = expandedComments.has(comment.id);
            const collapsed = isLong && !isExpanded;

            return (
              <div key={comment.id} className="flex gap-3">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-3",
                    comment.isAI
                      ? "bg-secondary/15 text-secondary"
                      : "bg-surface-container-high text-on-surface-variant"
                  )}
                >
                  <Icon
                    name={comment.isAI ? "smart_toy" : "person"}
                    size={16}
                    filled={comment.isAI}
                  />
                </div>

                <div className="flex-1 overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[13px] font-bold",
                          comment.isAI ? "text-secondary" : "text-on-surface"
                        )}
                      >
                        {comment.author}
                      </span>
                      {comment.isAI && (
                        <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-secondary">
                          Agent
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-on-surface-variant/35">
                      {comment.timeLabel}
                    </span>
                  </div>
                  {comment.message.trim() ? (
                    <CommentMarkdown
                      message={comment.message}
                      isAI={comment.isAI}
                      collapsed={collapsed}
                      onToggle={isLong ? () => {
                        setExpandedComments((prev) => {
                          const next = new Set(prev);
                          if (next.has(comment.id)) {
                            next.delete(comment.id);
                          } else {
                            next.add(comment.id);
                          }
                          return next;
                        });
                      } : undefined}
                    />
                  ) : null}
                  {comment.attachments.length > 0 ? (
                    <div className="mt-3 space-y-3">
                      {comment.attachments
                        .filter((attachment) => attachment.isImage)
                        .map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.contentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-lg border border-outline-variant/15 bg-surface-container-high/40"
                          >
                            <img
                              src={attachment.contentUrl}
                              alt={attachment.name}
                              className="max-h-80 w-full object-contain"
                            />
                          </a>
                        ))}
                      <div className="flex flex-wrap gap-2">
                        {comment.attachments
                          .filter((attachment) => !attachment.isImage)
                          .map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.contentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 rounded-lg border border-outline-variant/15 bg-surface-container-high/40 px-3 py-2 text-[12px] text-on-surface-variant transition-colors hover:border-secondary/30 hover:text-on-surface"
                          >
                            <Icon name={attachment.icon} size={14} className="text-secondary" />
                            <span className="max-w-[220px] truncate">{attachment.name}</span>
                            <span className="text-on-surface-variant/40">{attachment.size}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-sm border border-outline-variant/20 bg-surface-container-low/40 p-4 text-sm text-on-surface-variant">
          No comments yet.
        </div>
      )}

      {agentWorking ? (
        <StreamLogContext.Provider value={streamLogCtx}>
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tertiary/15">
              <Icon name="smart_toy" size={16} filled className="text-tertiary" />
            </div>
            <div className="flex-1 overflow-hidden rounded-xl border border-tertiary/10 bg-surface-container-low">
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-tertiary animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-tertiary animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-tertiary animate-bounce [animation-delay:300ms]" />
                  </div>
                  <span className="text-sm text-tertiary font-medium">Agent is working</span>
                </div>
                <div className="flex items-center gap-3">
                  {streamingEvents.length > 0 && (
                    <AgentStreamingLogToggle />
                  )}
                  {onStopAgent ? (
                    <button
                      type="button"
                      onClick={onStopAgent}
                      disabled={isStopping}
                      className="text-[11px] text-on-surface-variant/40 hover:text-on-surface-variant transition-colors disabled:opacity-40"
                    >
                      {isStopping ? "Stopping..." : "Stop"}
                    </button>
                  ) : null}
                </div>
              </div>
              <AgentStreamingLog events={streamingEvents} />
            </div>
          </div>
        </StreamLogContext.Provider>
      ) : null}

      {errorMessage ? (
        <div className="rounded-sm border border-error/30 bg-error/8 px-4 py-3 text-sm text-error">
          {errorMessage}
        </div>
      ) : null}

      <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-3">
        <div className="relative">
          {activeMention ? (
            <div className="absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container/95 shadow-[0_-12px_48px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              {filteredMentionAgents.length > 0 ? (
                <div className="p-1.5">
                  {filteredMentionAgents.map((agent, index) => (
                    <button
                      key={agent.id}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectMention(agent);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors",
                        index === activeMentionIndex
                          ? "bg-secondary/14"
                          : "hover:bg-surface-container-high/60"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                          agent.isCurrentAssignee
                            ? "bg-secondary/12 text-secondary"
                            : agent.isAssignedToProject
                              ? "bg-tertiary/10 text-tertiary"
                              : "bg-surface-container-high text-on-surface-variant"
                        )}
                      >
                        <Icon name="smart_toy" size={14} filled />
                      </div>
                      <span className="truncate text-[13px] font-medium text-on-surface">
                        {agent.name}
                      </span>
                      <span className="font-mono text-[10px] text-on-surface-variant/35">
                        @{agent.slug}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3 text-[13px] text-on-surface-variant/50">
                  No agents match <span className="font-mono text-on-surface/70">@{activeMention.query}</span>
                </div>
              )}
            </div>
          ) : null}

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => {
            const nextValue = event.target.value;
            setInput(nextValue);
            syncMentionState(nextValue, event.target.selectionStart ?? nextValue.length);
          }}
          onClick={(event) => {
            syncMentionState(
              event.currentTarget.value,
              event.currentTarget.selectionStart ?? event.currentTarget.value.length
            );
          }}
          onSelect={(event) => {
            syncMentionState(
              event.currentTarget.value,
              event.currentTarget.selectionStart ?? event.currentTarget.value.length
            );
          }}
          onKeyUp={(event) => {
            syncMentionState(
              event.currentTarget.value,
              event.currentTarget.selectionStart ?? event.currentTarget.value.length
            );
          }}
          onKeyDown={(event) => {
            if (activeMention && filteredMentionAgents.length > 0) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveMentionIndex((current) =>
                  Math.min(current + 1, filteredMentionAgents.length - 1)
                );
                return;
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveMentionIndex((current) => Math.max(current - 1, 0));
                return;
              }

              if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                selectMention(filteredMentionAgents[activeMentionIndex] ?? filteredMentionAgents[0]);
                return;
              }
            }

            if (event.key === "Escape") {
              closeMentionPicker();
              return;
            }

            if (
              event.key === "Enter" &&
              (event.metaKey || event.ctrlKey)
            ) {
              event.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder="Write a comment or @mention an agent..."
          disabled={disabled || isSubmitting}
          rows={2}
          className="min-h-16 w-full resize-none border-none bg-transparent p-0 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:ring-0 focus:outline-none outline-none"
        />
        </div>
        {selectedAttachments.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedAttachments.map((file) => (
              <span
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/15 bg-surface-container-high/40 px-3 py-2 text-[12px] text-on-surface-variant"
              >
                <Icon name="attach_file" size={14} className="text-secondary" />
                <span className="max-w-[180px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeSelectedAttachment(file)}
                  className="text-on-surface-variant/50 transition-colors hover:text-on-surface-variant"
                  aria-label={`Remove ${file.name}`}
                >
                  <Icon name="close" size={14} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-on-surface-variant/25">
            <span className="font-mono">@</span> mention · effort · <span className="font-mono">⌘↵</span> send
          </p>
          <div className="flex items-center gap-2">
            <label className="relative">
              <span className="sr-only">Comment thinking level</span>
              <select
                value={selectedThinkingLevel}
                onChange={(event) =>
                  setSelectedThinkingLevel(event.target.value as CommentThinkingLevel)
                }
                disabled={disabled || isSubmitting}
                className="appearance-none rounded-sm border border-outline-variant/15 bg-surface-container-high/30 py-1.5 pl-3 pr-8 text-xs font-medium text-on-surface-variant transition-colors hover:border-secondary/30 hover:text-on-surface disabled:opacity-30"
              >
                {thinkingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Icon
                name="expand_more"
                size={14}
                className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-on-surface-variant/50"
              />
            </label>
            <input
              ref={attachmentInputRef}
              type="file"
              multiple
              accept={TASK_ATTACHMENT_ACCEPT_ATTR}
              className="hidden"
              onChange={(event) => handleAttachmentSelection(event.target.files)}
            />
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              disabled={disabled || isSubmitting}
              className="flex items-center gap-1.5 rounded-sm border border-outline-variant/15 px-3 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:border-secondary/30 hover:text-on-surface disabled:opacity-30"
            >
              <Icon name="attach_file" size={14} />
              Attach
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting || disabled || (!input.trim() && selectedAttachments.length === 0)}
              className="flex items-center gap-1.5 rounded-sm bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-all hover:bg-primary/20 disabled:opacity-30 disabled:hover:bg-primary/10"
            >
              Send
              <Icon name="send" size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
