"use client";

import { useEffect, useRef, useState } from "react";

export function useAnimatedCounter(
  target: number,
  options: { duration?: number; decimals?: number } = {}
) {
  const { duration = 1400, decimals = 0 } = options;
  const [display, setDisplay] = useState("0");
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const startTime = performance.now();
    const hasComma = target >= 1000;

    function update(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = target * eased;

      if (decimals > 0) {
        setDisplay(current.toFixed(decimals));
      } else if (hasComma) {
        setDisplay(Math.round(current).toLocaleString());
      } else {
        setDisplay(String(Math.round(current)));
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(update);
      }
    }

    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, decimals]);

  return display;
}
