"use client";

import { useEffect, useRef, useState } from "react";

/**
 * One-shot scroll reveal. Returns a ref to attach and whether the element has
 * come into view. Visitors who prefer reduced motion (or browsers without
 * IntersectionObserver) get `visible = true` immediately.
 */
export function useReveal<T extends HTMLElement>(threshold = 0.1) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}
