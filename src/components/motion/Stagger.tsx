"use client";

import { type ReactNode } from "react";
import {
  motion,
  type Variants,
  type HTMLMotionProps,
} from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { MOTION } from "./constants";

interface StaggerProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  stagger?: keyof typeof MOTION.stagger;
  delay?: number;
}

const containerVariants: Variants = {
  hidden: {},
  visible: (stagger: number) => ({
    transition: {
      staggerChildren: stagger,
    },
  }),
};

const childVariants: Variants = {
  hidden: { opacity: 0, y: MOTION.offset.sm },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION.duration.base,
      ease: MOTION.ease.smooth,
    },
  },
};

export function Stagger({
  children,
  stagger = "base",
  delay = 0,
  ...props
}: StaggerProps) {
  const prefersReduced = useReducedMotion();
  const staggerMs = MOTION.stagger[stagger];

  return (
    <motion.div
      variants={prefersReduced ? undefined : containerVariants}
      initial={prefersReduced ? undefined : "hidden"}
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      custom={prefersReduced ? 0 : staggerMs}
      transition={
        prefersReduced
          ? undefined
          : { delayChildren: delay, staggerChildren: staggerMs }
      }
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      variants={prefersReduced ? undefined : childVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}
