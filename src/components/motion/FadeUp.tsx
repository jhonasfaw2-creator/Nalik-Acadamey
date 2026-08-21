"use client";

import { type ReactNode } from "react";
import { FadeIn } from "./FadeIn";
import { MOTION } from "./constants";

interface FadeUpProps {
  children: ReactNode;
  delay?: number;
  duration?: keyof typeof MOTION.duration;
  y?: number;
  className?: string;
}

export function FadeUp({
  children,
  delay = 0,
  duration = "base",
  y = MOTION.offset.md,
  className,
}: FadeUpProps) {
  return (
    <FadeIn delay={delay} duration={duration} y={y} className={className}>
      {children}
    </FadeIn>
  );
}
