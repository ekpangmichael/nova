"use client";

import { useRef, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const COLLAPSED_HEIGHT = 200;

export function CollapsibleMarkdownSection({
  title,
  content,
  empty,
}: {
  title: string;
  content: string | null | undefined;
  empty: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const check = () => setOverflows(el.scrollHeight > COLLAPSED_HEIGHT + 40);
    check();

    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [content]);

  const hasContent = content && content.trim().length > 0;

  return (
    <section className="bg-surface-container p-6 ghost anim-3">
      <h3 className="mb-4 text-[11px] font-bold tracking-widest uppercase text-on-surface">
        {title}
      </h3>
      {hasContent ? (
        <div className="relative">
          <div
            ref={contentRef}
            className={cn(
              "text-sm leading-[1.7] text-on-surface transition-[max-height] duration-300 ease-in-out",
              !expanded && overflows && "overflow-hidden"
            )}
            style={
              !expanded && overflows
                ? { maxHeight: COLLAPSED_HEIGHT }
                : undefined
            }
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-on-surface">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mb-3 mt-6 text-xl font-bold tracking-tight text-on-surface first:mt-0">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mb-2 mt-5 text-base font-semibold tracking-tight text-on-surface first:mt-0">
                    {children}
                  </h3>
                ),
                p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                ul: ({ children }) => (
                  <ul className="mb-3 list-disc space-y-1.5 pl-5 marker:text-secondary last:mb-0">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-3 list-decimal space-y-1.5 pl-5 marker:text-secondary last:mb-0">
                    {children}
                  </ol>
                ),
                li: ({ children }) => <li>{children}</li>,
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
                em: ({ children }) => (
                  <em className="italic text-on-surface/85">{children}</em>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="mb-3 border-l-2 border-secondary/35 pl-4 text-on-surface-variant italic last:mb-0">
                    {children}
                  </blockquote>
                ),
                code(props) {
                  const { className, children, ...rest } = props;
                  if (!className) {
                    return (
                      <code
                        className="rounded-sm bg-surface-container-high px-1.5 py-0.5 font-mono text-[0.85em] text-secondary"
                        {...rest}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className={className} {...rest}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre className="mb-3 overflow-x-auto rounded-lg border border-outline-variant/15 bg-surface-container-high/60 p-3 font-mono text-[12px] leading-relaxed text-on-surface last:mb-0">
                    {children}
                  </pre>
                ),
                hr: () => <hr className="my-4 border-outline-variant/20" />,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>

          {/* Gradient fade + Show more */}
          {overflows && !expanded && (
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-center bg-gradient-to-t from-surface-container via-surface-container/80 to-transparent pb-1 pt-12">
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="flex items-center gap-1 rounded-full bg-surface-container-high/80 px-3 py-1 text-[11px] font-medium text-on-surface-variant/60 backdrop-blur-sm transition-colors hover:text-on-surface-variant"
              >
                Show more
                <Icon name="expand_more" size={14} />
              </button>
            </div>
          )}

          {/* Show less */}
          {overflows && expanded && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="mt-3 flex items-center gap-1 text-[11px] font-medium text-on-surface-variant/50 transition-colors hover:text-on-surface-variant"
            >
              Show less
              <Icon name="expand_less" size={14} />
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-on-surface-variant">
          {empty}
        </p>
      )}
    </section>
  );
}
