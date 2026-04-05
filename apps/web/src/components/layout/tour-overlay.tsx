"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Icon } from "@/components/ui/icon";
import {
  TOUR_STEPS,
  isTourCompleted,
  markTourCompleted,
  onTourTrigger,
} from "@/lib/tour";

type Rect = { top: number; left: number; width: number; height: number };

export function TourOverlay() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<React.CSSProperties>({});
  const [transitioning, setTransitioning] = useState(false);
  const [entered, setEntered] = useState(false);

  const transitioningRef = useRef(false);
  const stepRef = useRef(stepIndex);
  stepRef.current = stepIndex;

  const step = TOUR_STEPS[stepIndex];

  // ---------- lifecycle ----------

  // Auto-start on first visit
  useEffect(() => {
    if (!isTourCompleted()) {
      const timer = setTimeout(() => setActive(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Listen for manual trigger (help button)
  useEffect(() => {
    return onTourTrigger(() => {
      setStepIndex(0);
      setEntered(false);
      setActive(true);
    });
  }, []);

  // Fade-in on activate
  useEffect(() => {
    if (active) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true));
      });
    } else {
      setEntered(false);
    }
  }, [active]);

  // Lock body scroll
  useEffect(() => {
    if (active) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [active]);

  // ---------- positioning ----------

  const updatePosition = useCallback(() => {
    if (!step || !active) return;

    if (!step.target) {
      setTargetRect(null);
      setTooltipPos({
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      });
      return;
    }

    const el = document.querySelector(`[data-tour-id="${step.target}"]`);
    if (!el) {
      setTargetRect(null);
      setTooltipPos({
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      });
      return;
    }

    const rect = el.getBoundingClientRect();
    const pad = 6;
    const padded: Rect = {
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    };
    setTargetRect(padded);

    const gap = 16;
    const tooltipW = 320;
    let pos: React.CSSProperties = {};

    switch (step.placement) {
      case "right":
        pos = {
          top: Math.max(16, padded.top + padded.height / 2),
          left: padded.left + padded.width + gap,
          transform: "translateY(-50%)",
        };
        break;
      case "bottom":
        pos = {
          top: padded.top + padded.height + gap,
          left: Math.max(
            16,
            Math.min(
              padded.left + padded.width / 2 - tooltipW / 2,
              window.innerWidth - tooltipW - 16,
            ),
          ),
        };
        break;
      case "bottom-end":
        pos = {
          top: padded.top + padded.height + gap,
          left: Math.max(16, padded.left + padded.width - tooltipW),
        };
        break;
    }

    setTooltipPos(pos);
  }, [step, active]);

  useEffect(() => {
    if (!active) return;

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [updatePosition]);

  // ---------- navigation ----------

  const transitionTo = useCallback((nextStep: number) => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    setTransitioning(true);

    setTimeout(() => {
      setStepIndex(nextStep);
      setTimeout(() => {
        transitioningRef.current = false;
        setTransitioning(false);
      }, 60);
    }, 220);
  }, []);

  const finish = useCallback(() => {
    markTourCompleted();
    setEntered(false);
    setTimeout(() => setActive(false), 300);
  }, []);

  const handleNext = useCallback(() => {
    if (transitioningRef.current) return;
    if (stepRef.current < TOUR_STEPS.length - 1) {
      transitionTo(stepRef.current + 1);
    } else {
      finish();
    }
  }, [transitionTo, finish]);

  const handleBack = useCallback(() => {
    if (transitioningRef.current) return;
    if (stepRef.current > 0) {
      transitionTo(stepRef.current - 1);
    }
  }, [transitionTo]);

  const handleSkip = useCallback(() => {
    finish();
  }, [finish]);

  // Keyboard
  useEffect(() => {
    if (!active) return;

    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          handleSkip();
          break;
        case "ArrowRight":
        case "Enter":
          handleNext();
          break;
        case "ArrowLeft":
          handleBack();
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [active, handleNext, handleBack, handleSkip]);

  // ---------- render ----------

  if (!active || !step) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const isCentered = step.placement === "center";

  return (
    <div
      className="fixed inset-0 z-[200] transition-opacity duration-300"
      style={{ opacity: entered ? 1 : 0 }}
    >
      {/* Click blocker */}
      <div className="absolute inset-0" />

      {/* Overlay / Spotlight */}
      {isCentered || !targetRect ? (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] pointer-events-none" />
      ) : (
        <>
          {/* Dark overlay with spotlight cutout via box-shadow */}
          <div
            className="absolute rounded-xl pointer-events-none transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{
              top: targetRect.top,
              left: targetRect.left,
              width: targetRect.width,
              height: targetRect.height,
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
            }}
          />

          {/* Glow ring around spotlight */}
          <div
            className="absolute rounded-xl ring-2 ring-secondary/40 pointer-events-none transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{
              top: targetRect.top,
              left: targetRect.left,
              width: targetRect.width,
              height: targetRect.height,
              boxShadow: "0 0 24px rgba(123, 153, 255, 0.12)",
            }}
          />
        </>
      )}

      {/* Tooltip card */}
      <div
        className={`absolute w-80 pointer-events-auto transition-all duration-300 ${
          transitioning || !entered
            ? "opacity-0 translate-y-2 scale-[0.97]"
            : "opacity-100 translate-y-0 scale-100"
        }`}
        style={tooltipPos}
      >
        <div className="rounded-2xl bg-surface-container border border-outline-variant/15 shadow-2xl overflow-hidden">
          {/* Progress segments */}
          <div className="flex gap-1 px-5 pt-4">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                  i < stepIndex
                    ? "bg-secondary/50"
                    : i === stepIndex
                      ? "bg-secondary"
                      : "bg-outline-variant/15"
                }`}
              />
            ))}
          </div>

          {/* Body */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
                <Icon name={step.icon} size={16} className="text-secondary" />
              </div>
              <h3 className="text-[15px] font-semibold tracking-tight text-on-surface">
                {step.title}
              </h3>
            </div>
            <p className="text-[13px] leading-relaxed text-on-surface-variant/50 pl-[38px]">
              {step.body}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between px-5 py-3.5">
            <button
              type="button"
              onClick={handleSkip}
              className="text-[11px] font-medium text-on-surface-variant/30 hover:text-on-surface-variant/60 transition-colors"
            >
              Skip tour
            </button>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-medium text-on-surface-variant/50 hover:bg-surface-container-high/50 transition-colors"
                >
                  <Icon name="arrow_back" size={14} />
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 rounded-lg bg-secondary/15 px-4 py-1.5 text-[12px] font-semibold text-secondary hover:bg-secondary/25 transition-colors"
              >
                {isLast ? "Get started" : "Next"}
                {!isLast && <Icon name="arrow_forward" size={14} />}
              </button>
            </div>
          </div>

          {/* Step counter */}
          <div className="px-5 pb-3.5 -mt-1">
            <p className="text-right font-mono text-[9px] uppercase tracking-wider text-on-surface-variant/20">
              {stepIndex + 1} / {TOUR_STEPS.length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
