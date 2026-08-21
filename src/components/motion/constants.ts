export const MOTION = {
  duration: {
    fast: 0.2,
    base: 0.3,
    slow: 0.5,
  },
  ease: {
    smooth: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
    snappy: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
  spring: {
    gentle: { stiffness: 300, damping: 20 },
  },
  offset: {
    xs: 8,
    sm: 16,
    md: 24,
    lg: 40,
  },
  stagger: {
    fast: 0.04,
    base: 0.06,
    slow: 0.1,
  },
  scale: {
    hover: 1.02,
    tap: 0.98,
    subtle: 1.01,
  },
};

export type MotionDuration = keyof typeof MOTION.duration;
export type MotionEase = keyof typeof MOTION.ease;
export type MotionOffset = keyof typeof MOTION.offset;
export type MotionStagger = keyof typeof MOTION.stagger;
