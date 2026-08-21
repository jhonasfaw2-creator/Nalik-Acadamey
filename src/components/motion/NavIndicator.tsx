"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { MOTION } from "./constants";

interface NavIndicatorProps extends Omit<HTMLMotionProps<"span">, "children"> {
  isActive: boolean;
}

export function NavIndicator({ isActive, className, ...props }: NavIndicatorProps) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.span
      className={className}
      aria-hidden="true"
      initial={prefersReduced ? { opacity: 1, scaleX: 1 } : { opacity: 0, scaleX: 0.8 }}
      animate={{
        opacity: isActive ? 1 : 0,
        scaleX: isActive ? 1 : 0.8,
      }}
      transition={{
        duration: prefersReduced ? 0 : MOTION.duration.base,
        ease: MOTION.ease.snappy,
      }}
      style={{ originX: 0.5 }}
      {...props}
    />
  );
}
