"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

interface BackgroundVideoProps {
  /** Path to the video file in /public */
  src: string;
  /** Poster/fallback image path */
  poster?: string;
  /** Overlay opacity (0–1, default 0.55) */
  overlayOpacity?: number;
  /** Additional overlay color (default: navy) */
  overlayColor?: string;
  /** Children rendered above the video */
  children?: React.ReactNode;
  /** Extra class on the outer wrapper */
  className?: string;
  /** Lazy-load the video when true (default: false for hero) */
  lazy?: boolean;
}

/** Detect slow / data-saver connections */
function useSlowConnection(): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const conn = (
      navigator as unknown as {
        connection?: {
          saveData?: boolean;
          effectiveType?: string;
          addEventListener?: (type: string, handler: () => void) => void;
          removeEventListener?: (type: string, handler: () => void) => void;
        };
      }
    ).connection;
    if (conn) {
      const check = () =>
        setSlow(
          conn.saveData === true ||
          conn.effectiveType === "slow-2g" ||
          conn.effectiveType === "2g"
        );
      check();
      conn.addEventListener?.("change", check);
      return () => {
        conn.removeEventListener?.("change", check);
      };
    }
  }, []);

  return slow;
}

export function BackgroundVideo({
  src,
  poster,
  overlayOpacity = 0.55,
  overlayColor = "rgba(21, 27, 41, VAR)",
  children,
  className,
  lazy = false,
}: BackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const prefersReduced = useReducedMotion();
  const slowConnection = useSlowConnection();
  const [isVisible, setIsVisible] = useState(!lazy);
  const [hasError, setHasError] = useState(false);

  // Skip video entirely for reduced-motion or slow connections (show poster only)
  const skipVideo = prefersReduced || (slowConnection && lazy);

  // ── Lazy-load via IntersectionObserver ────────
  useEffect(() => {
    if (!lazy || isVisible || skipVideo) return;

    const el = videoRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [lazy, isVisible, skipVideo]);

  // ── Ensure autoplay works on mobile (iOS/Safari) ─
  useEffect(() => {
    const video = videoRef.current;
    if (!video || skipVideo) return;

    // Native autoplay via attribute handles most browsers.
    // For iOS Safari, also try programmatic play as a fallback.
    const tryPlay = () => {
      video.play().catch(() => {
        // Autoplay blocked — poster fallback shows
      });
    };

    // Small delay ensures the DOM is ready on iOS
    const timer = setTimeout(tryPlay, 100);
    return () => clearTimeout(timer);
  }, [skipVideo]);

  // ── iOS fallback: tap to unmute ──────────────
  const handleTap = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.muted = false;
      video.play().catch(() => {});
    }
  }, []);

  const overlay = overlayColor.replace("VAR", String(overlayOpacity));

  const videoSource = useMemo(() => {
    if (skipVideo || hasError) return null;
    if (!isVisible && lazy) return null;
    return (
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay={!skipVideo}
        muted
        loop
        playsInline
        preload={lazy ? "none" : "metadata"}
        poster={poster}
        onError={() => setHasError(true)}
        onClick={handleTap}
        aria-hidden="true"
      >
        <source src={src} type="video/mp4" />
      </video>
    );
  }, [skipVideo, hasError, lazy, isVisible, poster, src, handleTap]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Video layer */}
      {videoSource}

      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: overlay }}
        aria-hidden="true"
      />

      {/* Content */}
      {children && (
        <div className="relative z-10">{children}</div>
      )}
    </div>
  );
}
