"use client";

import { useEffect, useState } from "react";

/**
 * Detects the user's `prefers-reduced-motion` media query.
 * Returns `true` when the user has requested reduced motion.
 */
export function useReducedMotion(): boolean {
  // Lazy initializer — reads from DOM at mount, no setState in effect
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}
