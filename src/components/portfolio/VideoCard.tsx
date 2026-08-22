"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";
import type { PortfolioItem } from "@/data/portfolio";

interface VideoCardProps {
  item: PortfolioItem;
  className?: string;
  /** Larger card variant used for the hero slot in the grid */
  featured?: boolean;
}

export function VideoCard({ item, className, featured }: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const prefersReduced = useReducedMotion();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-play on scroll (pause when out of view)
  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || prefersReduced) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().then(() => setIsPlaying(true)).catch(() => {});
        } else {
          video.pause();
          setIsPlaying(false);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [prefersReduced]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  return (
    <motion.div
      ref={containerRef}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-sm",
        featured ? "aspect-video" : "aspect-video",
        className,
      )}
      {...(prefersReduced
        ? {}
        : {
            whileHover: { scale: 1.02 },
            transition: { type: "spring", stiffness: 300, damping: 25 },
          })}
      onClick={togglePlay}
      role="button"
      tabIndex={0}
      aria-label={isPlaying ? `Pause ${item.title}` : `Play ${item.title}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          togglePlay();
        }
      }}
    >
      {/* Video element — always visible as poster when paused */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src={item.videoSrc}
        muted={isMuted}
        loop
        playsInline
        preload="metadata"
        poster={item.posterImage || undefined}
        aria-hidden="true"
      />

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-navy/80 via-navy/20 to-transparent pointer-events-none" />

      {/* Play / Pause button — centre */}
      <div
        className={cn(
          "absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-sm transition-all duration-200",
          isPlaying
            ? "opacity-0 group-hover:opacity-100"
            : "opacity-100",
        )}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5 text-white" strokeWidth={1.5} />
        ) : (
          <Play className="ml-0.5 h-5 w-5 text-white" strokeWidth={1.5} />
        )}
      </div>

      {/* Mute toggle — bottom right */}
      <button
        className={cn(
          "absolute bottom-3 right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-navy/40 text-white/70 backdrop-blur-sm transition-all duration-200",
          isPlaying
            ? "opacity-0 group-hover:opacity-100"
            : "opacity-0",
        )}
        onClick={(e) => {
          e.stopPropagation();
          toggleMute();
        }}
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? (
          <VolumeX className="h-3.5 w-3.5" strokeWidth={1.5} />
        ) : (
          <Volume2 className="h-3.5 w-3.5" strokeWidth={1.5} />
        )}
      </button>

      {/* Title + description overlay — bottom */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 z-10 p-4 sm:p-5 transition-all duration-300",
          isPlaying
            ? "opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0"
            : "opacity-100",
        )}
      >
        <h3
          className={cn(
            "font-bold tracking-tight text-white",
            featured ? "text-xl sm:text-2xl" : "text-base sm:text-lg",
          )}
        >
          {item.title}
        </h3>
        <p
          className={cn(
            "mt-1 leading-relaxed text-white/60",
            featured ? "text-sm sm:text-base" : "text-xs sm:text-sm",
          )}
        >
          {item.description}
        </p>
      </div>

      {/* Cinematic corner accents */}
      <div className="absolute left-3 top-3 z-10 h-5 w-5 border-l border-t border-gold/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <div className="absolute bottom-3 right-12 z-10 h-5 w-5 border-b border-r border-gold/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
    </motion.div>
  );
}
