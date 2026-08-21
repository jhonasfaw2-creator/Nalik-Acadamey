"use client";

import { type ReactNode } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { MOTION } from "./constants";

const variants: Variants = {
  initial: { opacity: 0, y: MOTION.offset.xs },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION.duration.base,
      ease: MOTION.ease.snappy,
    },
  },
  exit: {
    opacity: 0,
    y: -MOTION.offset.xs,
    transition: {
      duration: MOTION.duration.fast,
      ease: MOTION.ease.smooth,
    },
  },
};

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main
        key={pathname}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="flex-1"
      >
        {children}
      </motion.main>
    </AnimatePresence>
  );
}
