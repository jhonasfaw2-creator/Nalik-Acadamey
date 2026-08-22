"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Container } from "@/components/ui/Container";
import { FadeUp } from "@/components/motion/FadeUp";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { Video, Film, Users, Sparkles, Play, Pause } from "lucide-react";
import { useSiteContent } from "@/lib/hooks/use-site-content";
import { useApplicationModal } from "@/components/application/ApplicationContext";

const HIGHLIGHT_ICONS = [Film, Sparkles, Video, Users];

function FounderVideo({ videoSrc }: { videoSrc: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || prefersReduced) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().then(() => {
            setIsPlaying(true);
            video.muted = false;
            setIsMuted(false);
            video.volume = 1;
          }).catch(() => {});
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener("timeupdate", updateProgress);
    return () => video.removeEventListener("timeupdate", updateProgress);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.muted = false;
      setIsMuted(false);
      video.volume = 1;
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-navy/50">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={videoSrc}
          muted={isMuted}
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-navy/80 via-navy/20 to-transparent" />

        <button
          onClick={togglePlay}
          className="absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-sm transition-all duration-200 hover:bg-white/20"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5 text-white" strokeWidth={1.5} />
          ) : (
            <Play className="ml-0.5 h-5 w-5 text-white" strokeWidth={1.5} />
          )}
        </button>

        <div className="pointer-events-none absolute left-4 top-4 h-8 w-8 border-l border-t border-gold/40" />
        <div className="pointer-events-none absolute bottom-4 right-4 h-8 w-8 border-b border-r border-gold/40" />
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 h-1 bg-white/10">
        <div
          className="h-full bg-gold transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="absolute -bottom-1 left-0 h-1 w-2/3 bg-gold" />
    </div>
  );
}

export function FounderStory() {
  const prefersReduced = useReducedMotion();
  const { founder } = useSiteContent();
  const { openModal } = useApplicationModal();

  const highlights = [
    { icon: HIGHLIGHT_ICONS[0], label: founder.highlight1 || "Video Editing" },
    { icon: HIGHLIGHT_ICONS[1], label: founder.highlight2 || "Storytelling" },
    { icon: HIGHLIGHT_ICONS[2], label: founder.highlight3 || "Content Creation" },
    { icon: HIGHLIGHT_ICONS[3], label: founder.highlight4 || "Industry Connections" },
  ];

  return (
    <section id="founder" className="bg-navy py-24 sm:py-32">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <FadeUp delay={0.1}>
            <FounderVideo videoSrc={founder.video || "/videos/founder.mp4"} />
          </FadeUp>

          <div className="flex flex-col">
            <FadeUp delay={0.2}>
              <span className="mb-5 inline-block h-1 w-10 bg-gold" />
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                {founder.label || "The Founder"}
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">
                {founder.title || "Learn From Someone"}
                <br />
                Who Has{" "}
                <span className="text-gold">{founder.titleHighlight || "Done It."}</span>
              </h2>
            </FadeUp>

            <FadeUp delay={0.35}>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-white/60 sm:text-lg">
                {founder.description ||
                  "Built by a professional video editor and content creator who has worked behind the scenes for established Ethiopian digital creators and TikTok creators, turning raw footage into compelling stories that reach real audiences."}
              </p>
            </FadeUp>

            <FadeUp delay={0.45}>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-white/60">
                {founder.description2 ||
                  "This academy exists to pass on the exact skills, workflows, and creative thinking that power professional content, without the guesswork."}
              </p>
            </FadeUp>

            <FadeUp delay={0.55}>
              <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4">
                {highlights.map((item) => (
                  <motion.div
                    key={item.label}
                    className="group flex items-center gap-3 rounded border border-white/10 bg-white/5 px-4 py-3 transition-colors duration-150 hover:border-gold/30 hover:bg-white/[0.07]"
                    {...(prefersReduced
                      ? {}
                      : {
                          whileHover: { y: -2 },
                          transition: {
                            type: "spring",
                            stiffness: 400,
                            damping: 25,
                          },
                        })}
                  >
                    <item.icon
                      className="h-5 w-5 flex-shrink-0 text-gold transition-transform duration-150 group-hover:scale-110"
                      strokeWidth={1.5}
                    />
                    <span className="text-sm font-medium text-white/80">
                      {item.label}
                    </span>
                  </motion.div>
                ))}
              </div>
            </FadeUp>

            <FadeUp delay={0.65}>
              <div className="mt-10">
                <button
                  type="button"
                  onClick={openModal}
                  className="inline-flex h-12 items-center rounded bg-gold px-7 text-sm font-semibold text-navy transition-colors duration-150 hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  {founder.cta || "Meet the Founder"}
                </button>
              </div>
            </FadeUp>
          </div>
        </div>
      </Container>
    </section>
  );
}
