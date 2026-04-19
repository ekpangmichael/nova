import { cn } from "@/lib/utils";

/**
 * Nova brand marks.
 *
 * Built from the 4-point star glyph defined in the design system.
 * Source: Nova Logo Variations (identity kit).
 *
 * Usage rules:
 * - Use pure black on light backgrounds, pure white on dark. No greys.
 * - The mark is legible from 16px up.
 * - Do not stretch, tilt, recolor with gradients, or rotate.
 *
 * All components default to `currentColor` for the mark fill, so they inherit
 * the surrounding text color. Pass `tone` for a hard override.
 */

type Tone = "current" | "dark" | "light";

function resolveColor(tone: Tone): string {
  if (tone === "dark") return "#111111";
  if (tone === "light") return "#ffffff";
  return "currentColor";
}

const STAR_PATH =
  "M60 6 L64.5 55.5 L114 60 L64.5 64.5 L60 114 L55.5 64.5 L6 60 L55.5 55.5 Z";

/* ------------------------------------------------------------------ */
/*  NovaMark — the bare 4-point star                                   */
/* ------------------------------------------------------------------ */

export type NovaMarkProps = {
  size?: number;
  tone?: Tone;
  variant?: "filled" | "outline";
  className?: string;
  title?: string;
};

export function NovaMark({
  size = 24,
  tone = "current",
  variant = "filled",
  className,
  title = "Nova",
}: NovaMarkProps) {
  const color = resolveColor(tone);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
    >
      <title>{title}</title>
      {variant === "filled" ? (
        <path d={STAR_PATH} fill={color} />
      ) : (
        <path
          d={STAR_PATH}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  NovaLogo — horizontal lockup (mark + "Nova" wordmark)              */
/* ------------------------------------------------------------------ */

export type NovaLogoProps = {
  /** Height of the star glyph in px. Wordmark scales with it. */
  size?: number;
  tone?: Tone;
  className?: string;
};

export function NovaLogo({ size = 20, tone = "current", className }: NovaLogoProps) {
  /*
   * Design spec: 36px star + 44px Inter 700 -0.04em wordmark with 14px gap.
   * That ratio (wordmark = star * 44/36 ≈ 1.22, gap = star * 14/36 ≈ 0.39)
   * lets callers pass any size and the proportions hold.
   */
  const wordmarkSize = Math.round(size * 1.22);
  const gap = Math.round(size * 0.39);

  return (
    <span
      className={cn("inline-flex items-center", className)}
      style={{ gap: `${gap}px` }}
    >
      <NovaMark size={size} tone={tone} />
      <span
        className="font-sans font-bold leading-none"
        style={{
          fontSize: `${wordmarkSize}px`,
          letterSpacing: "-0.04em",
          color: resolveColor(tone),
        }}
      >
        Nova
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  NovaLogoStacked — mark + wordmark + mono tagline                   */
/* ------------------------------------------------------------------ */

export type NovaLogoStackedProps = {
  size?: number;
  tone?: Tone;
  tagline?: string;
  className?: string;
};

export function NovaLogoStacked({
  size = 52,
  tone = "current",
  tagline = "AGENT MANAGEMENT",
  className,
}: NovaLogoStackedProps) {
  const wordmarkSize = Math.round(size * 0.73); // 38/52
  const taglineSize = Math.round(size * 0.19); // 10/52
  const color = resolveColor(tone);

  return (
    <span className={cn("inline-flex flex-col items-center", className)} style={{ gap: "10px" }}>
      <NovaMark size={size} tone={tone} />
      <span
        className="font-sans font-bold leading-none"
        style={{
          fontSize: `${wordmarkSize}px`,
          letterSpacing: "-0.04em",
          color,
        }}
      >
        Nova
      </span>
      <span
        className="font-mono leading-none"
        style={{
          fontSize: `${Math.max(taglineSize, 10)}px`,
          letterSpacing: "0.24em",
          color: tone === "current" ? undefined : color,
          opacity: tone === "current" ? undefined : 0.6,
        }}
      >
        {tagline}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  NovaBrand — the sidebar lockup (horizontal mark + wordmark with    */
/*  a small mono caption underneath). Matches the in-app sidebar spec. */
/* ------------------------------------------------------------------ */

export type NovaBrandProps = {
  caption?: string;
  className?: string;
};

export function NovaBrand({
  caption = "Agent Management",
  className,
}: NovaBrandProps) {
  return (
    <div className={cn("inline-flex flex-col", className)}>
      <div className="inline-flex items-center gap-2.5">
        <NovaMark size={20} className="text-on-surface" />
        <span className="text-[17px] font-extrabold tracking-[-0.04em] text-on-surface leading-none">
          Nova
        </span>
      </div>
      <p className="font-mono text-[8px] text-primary/25 uppercase tracking-[0.25em] mt-1 pl-[30px]">
        {caption}
      </p>
    </div>
  );
}
