"use client";

import { Container } from "@/components/ui/Container";
import { FadeUp } from "@/components/motion/FadeUp";

import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { Play, Pause, Scissors, Palette, Sparkles } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { useSiteContent } from "@/lib/hooks/use-site-content";

const PILLAR_ICONS = [Scissors, Palette, Sparkles];

export function AboutNalik() {
  const prefersReduced = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const { about } = useSiteContent();

  const pillars = [
    { icon: PILLAR_ICONS[0], label: about.pillar1Label || "Editing", description: about.pillar1Desc || "Precision cuts, pacing, and timeline craft." },
    { icon: PILLAR_ICONS[1], label: about.pillar2Label || "Storytelling", description: about.pillar2Desc || "Narrative structure that connects with audiences." },
    { icon: PILLAR_ICONS[2], label: about.pillar3Label || "Creator Skills", description: about.pillar3Desc || "Workflows built for the modern content landscape." },
  ];

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.muted = false;
      video.volume = 1;
      video.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setPlaying(false);
    }
  }, []);

  const onTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress((video.currentTime / video.duration) * 100);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || prefersReduced) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.muted = true;
          video
            .play()
            .then(() => {
              video.muted = false;
              video.volume = 1;
              setPlaying(true);
            })
            .catch(() => {});
        } else {
          video.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [prefersReduced]);

  return (
    <section id="about" className="bg-warm-white py-24 sm:py-32">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Video Element */}
          <FadeUp delay={0.1}>
            <div className="mx-auto w-full max-w-sm">
              <div className="relative overflow-hidden rounded-sm bg-navy">
                <video
                  ref={videoRef}
                  className="w-full h-auto block"
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  poster={about.poster || "/images/general/about-poster.jpg"}
                  onClick={togglePlay}
                  onTimeUpdate={onTimeUpdate}
                >
                  <source src={about.video || "/videos/about.mp4"} type="video/mp4" />
                </video>

                <button
                  type="button"
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center"
                  aria-label={playing ? "Pause video" : "Play video"}
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-sm transition-all duration-200 hover:bg-white/20 hover:scale-105">
                    {playing ? (
                      <Pause className="h-6 w-6 text-white" fill="currentColor" strokeWidth={0} />
                    ) : (
                      <Play className="ml-1 h-6 w-6 text-white" fill="currentColor" strokeWidth={0} />
                    )}
                  </div>
                </button>

                <div className="pointer-events-none absolute left-4 top-4 h-6 w-6 border-l border-t border-gold/40" />
                <div className="pointer-events-none absolute bottom-4 right-4 h-6 w-6 border-b border-r border-gold/40" />

                <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-5">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                    {about.videoLabel || "Nalik Academy | Behind the Edit"}
                  </span>
                </div>
              </div>

              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-navy/10">
                <div
                  className="h-full rounded-full bg-gold transition-[width] duration-200 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="mt-3 h-1 w-1/2 bg-gold" />
            </div>
          </FadeUp>

          {/* Content */}
          <div className="flex flex-col">
            <FadeUp delay={0.2}>
              <span className="mb-5 inline-block h-1 w-10 bg-gold" />
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                {about.label || "About the Academy"}
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl lg:text-[2.75rem]">
                {about.title || "A New Academy."}
                <br />
                A <span className="text-gold">{about.titleHighlight || "Focused"}</span> Mission.
              </h2>
            </FadeUp>

            <FadeUp delay={0.3}>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                {about.description ||
                  "Nalik Academy is a new, focused video-editing academy built around one belief: that real skill comes from hands-on practice, not theory alone."}
              </p>
            </FadeUp>

            <FadeUp delay={0.4}>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
                {about.description2 ||
                  "Created by an experienced editor and content creator, the academy trains students in DaVinci Resolve and Adobe Premiere Pro, the tools professionals actually use. Every lesson is designed around editing, storytelling, and the skills that matter in the creator economy."}
              </p>
            </FadeUp>

            {/* Mission Pillars */}
            <FadeUp delay={0.5}>
              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                {pillars.map((pillar) => (
                  <motion.div
                    key={pillar.label}
                    className="group rounded border border-navy/10 bg-white px-4 py-4 transition-colors duration-150 hover:border-gold/30"
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
                    <pillar.icon
                      className="mb-2 h-5 w-5 text-gold"
                      strokeWidth={1.5}
                    />
                    <h4 className="text-sm font-bold text-navy">
                      {pillar.label}
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {pillar.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </FadeUp>

            {/* CTA */}
            <FadeUp delay={0.6}>
              <div className="mt-10">
                <button
                  type="button"
                  onClick={() => {
                    const raw = (about.ctaLink || "/#courses");
                    const id = raw.replace(/^\//, "").replace(/^#/, "").split("/").pop() || "program";
                    const sectionId = id === "programs" ? "program" : id;
                    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="inline-flex h-12 items-center rounded bg-gold px-7 text-sm font-semibold text-navy transition-colors duration-150 hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  {about.cta || "Explore Programs"}
                </button>
              </div>
            </FadeUp>
          </div>
        </div>
      </Container>
    </section>
  );
}
