"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "@/components/ui/icon";
import { addTaskComment, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

type CommentView = {
  id: string;
  author: string;
  isAI: boolean;
  timeLabel: string;
  message: string;
};

function CommentMarkdown({
  message,
  isAI,
}: {
  message: string;
  isAI: boolean;
}) {
  return (
    <div
      className={cn(
        "text-sm leading-relaxed",
        isAI ? "text-on-surface-variant/90" : "text-on-surface-variant"
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => <li className="marker:text-secondary">{children}</li>,
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
            <blockquote className="mb-3 border-l-2 border-secondary/40 pl-4 text-on-surface/80 last:mb-0">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded-sm bg-surface-container-high px-1.5 py-0.5 font-mono text-[0.85em] text-secondary">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="mb-3 overflow-x-auto rounded-sm bg-surface-container-lowest/90 p-3 font-mono text-xs text-on-surface last:mb-0">
              {children}
            </pre>
          ),
          hr: () => <hr className="my-4 border-outline-variant/20" />,
        }}
      >
        {message}
      </ReactMarkdown>
    </div>
  );
}

export function CommentThread({
  taskId,
  comments,
  disabled = false,
  onCommentCreated,
  agentWorking = false,
  onStopAgent,
  isStopping = false,
}: {
  taskId: string;
  comments: CommentView[];
  disabled?: boolean;
  onCommentCreated?: () => Promise<void> | void;
  agentWorking?: boolean;
  onStopAgent?: () => void;
  isStopping?: boolean;
}) {
  const [input, setInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const VISIBLE_COUNT = 3;
  const hasHidden = comments.length > VISIBLE_COUNT;
  const hiddenCount = comments.length - VISIBLE_COUNT;
  const visibleComments = showAll ? comments : comments.slice(-VISIBLE_COUNT);

  async function handleSubmit() {
    if (!input.trim() || isSubmitting || disabled) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await addTaskComment(taskId, {
        body: input.trim(),
      });
      setInput("");
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
    <div className="space-y-4 pt-6 border-t border-outline-variant/10">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface">
        Comment Thread
        <span className="ml-2 text-on-surface-variant/40 font-normal">{comments.length}</span>
      </h3>

      {comments.length > 0 ? (
        <div className="space-y-3">
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
          {visibleComments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  comment.isAI
                    ? "bg-secondary/15 text-secondary"
                    : "bg-surface-container-high text-on-surface-variant"
                }`}
              >
                <Icon
                  name={comment.isAI ? "smart_toy" : "person"}
                  size={16}
                  filled={comment.isAI}
                />
              </div>

              <div className="flex-1 rounded-sm px-3 py-2.5 ghost">
                <div className="mb-1.5 flex items-start justify-between">
                  <span
                    className={`text-sm font-bold ${
                      comment.isAI ? "text-secondary" : "text-on-surface"
                    }`}
                  >
                    {comment.author}
                  </span>
                  <span className="font-mono text-[10px] text-on-surface-variant/40">
                    {comment.timeLabel}
                  </span>
                </div>
                <CommentMarkdown message={comment.message} isAI={comment.isAI} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-sm border border-outline-variant/20 bg-surface-container-low/40 p-4 text-sm text-on-surface-variant">
          No comments yet.
        </div>
      )}

      {agentWorking ? (
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tertiary/15">
            <Icon name="smart_toy" size={16} filled className="text-tertiary" />
          </div>
          <div className="flex-1 flex items-center justify-between rounded-sm py-2.5 px-3 ghost border-tertiary/10">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-tertiary animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-tertiary animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-tertiary animate-bounce [animation-delay:300ms]" />
              </div>
              <span className="text-sm text-tertiary font-medium">Agent is working</span>
            </div>
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
      ) : null}

      {errorMessage ? (
        <div className="rounded-sm border border-error/30 bg-error/8 px-4 py-3 text-sm text-error">
          {errorMessage}
        </div>
      ) : null}

      <div className="rounded-sm bg-surface-container-low/60 p-4">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              (event.metaKey || event.ctrlKey)
            ) {
              event.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder="Write a comment or instruction..."
          disabled={disabled || isSubmitting}
          rows={2}
          className="min-h-16 w-full resize-none border-none bg-transparent p-0 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:ring-0 focus:outline-none outline-none"
        />
        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-on-surface-variant/30">
            Markdown · Cmd+Enter to send
          </p>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || disabled || !input.trim()}
            className="flex items-center gap-1.5 rounded-sm bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-all hover:bg-primary/20 disabled:opacity-30 disabled:hover:bg-primary/10"
          >
            Send
            <Icon name="send" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
