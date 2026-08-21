"use client";

import { type ReactNode } from "react";
import {
  motion,
  type Variants,
  type HTMLMotionProps,
} from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { MOTION } from "./constants";

const variants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

interface FadeInProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  delay?: number;
  duration?: keyof typeof MOTION.duration;
  y?: number;
}

export function FadeIn({
  children,
  delay = 0,
  duration = "base",
  y = 0,
  ...props
}: FadeInProps) {
  const prefersReduced = useReducedMotion();

  const resolvedVariants: Variants = y
    ? {
        hidden: { opacity: 0, y },
        visible: { opacity: 1, y: 0 },
      }
    : variants;

  return (
    <motion.div
      variants={resolvedVariants}
      initial={prefersReduced ? "visible" : "hidden"}
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: prefersReduced ? 0 : MOTION.duration[duration],
        delay: prefersReduced ? 0 : delay,
        ease: MOTION.ease.smooth,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
