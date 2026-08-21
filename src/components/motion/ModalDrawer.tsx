"use client";

import { type ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { MOTION } from "./constants";

interface ModalDrawerProps {
  children: ReactNode;
  isOpen: boolean;
  onClose?: () => void;
  direction?: "center" | "bottom" | "left" | "right";
}

const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: MOTION.duration.fast },
  },
  exit: {
    opacity: 0,
    transition: { duration: MOTION.duration.fast, delay: 0.05 },
  },
};

const contentVariants: Variants = {
  hidden: (direction: string) => {
    switch (direction) {
      case "bottom":
        return { y: "100%", opacity: 0 };
      case "left":
        return { x: "-100%", opacity: 0 };
      case "right":
        return { x: "100%", opacity: 0 };
      default:
        return { scale: 0.95, opacity: 0 };
    }
  },
  visible: {
    x: 0,
    y: 0,
    scale: 1,
    opacity: 1,
    transition: {
      duration: MOTION.duration.base,
      ease: MOTION.ease.snappy,
    },
  },
  exit: (direction: string) => {
    switch (direction) {
      case "bottom":
        return { y: "100%", opacity: 0, transition: { duration: MOTION.duration.fast } };
      case "left":
        return { x: "-100%", opacity: 0, transition: { duration: MOTION.duration.fast } };
      case "right":
        return { x: "100%", opacity: 0, transition: { duration: MOTION.duration.fast } };
      default:
        return { scale: 0.95, opacity: 0, transition: { duration: MOTION.duration.fast } };
    }
  },
};

export function ModalDrawer({
  children,
  isOpen,
  onClose,
  direction = "center",
}: ModalDrawerProps) {
  const prefersReduced = useReducedMotion();

  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div
        className="absolute inset-0 bg-navy/60 backdrop-blur-sm"
        variants={prefersReduced ? undefined : overlayVariants}
        initial={prefersReduced ? undefined : "hidden"}
        animate={prefersReduced ? undefined : "visible"}
        exit={prefersReduced ? undefined : "exit"}
        onClick={onClose}
      />
      <motion.div
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-elevated max-sm:max-w-full max-sm:rounded-lg sm:max-h-[85vh]"
        variants={prefersReduced ? undefined : contentVariants}
        initial={prefersReduced ? undefined : "hidden"}
        animate={prefersReduced ? undefined : "visible"}
        exit={prefersReduced ? undefined : "exit"}
        custom={direction}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
