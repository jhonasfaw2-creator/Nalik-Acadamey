"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowRight, Play, ChevronDown } from "lucide-react";

interface HeroProps {
  onApplyClick: () => void;
}

const DEFAULTS = {
  eyebrow: "NALIK ACADEMY · CREATIVE MEDIA",
  title: "Master the Art of Visual Storytelling",
  description:
    "Learn professional video editing and media production through practical training built around real creative work.",
  video: "/assets/hero/hero.mp4",
  poster: "/assets/hero/poster.jpg",
};

export default function Hero({ onApplyClick }: HeroProps) {
  const [content, setContent] = useState(DEFAULTS);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetch("/api/content?section=hero")
      .then((r) => r.json())
      .then((d) => {
        setContent((prev) => ({
          eyebrow: d.eyebrow || prev.eyebrow,
          title: d.title || prev.title,
          description: d.description || prev.description,
          video: d.video || prev.video,
          poster: d.poster || prev.poster,
        }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    const attemptPlay = () => {
      video.play().catch(() => {});
    };

    attemptPlay();

    video.addEventListener("canplay", attemptPlay);

    return () => {
      video.removeEventListener("canplay", attemptPlay);
    };
  }, [content.video]);

  return (
    <section
      id="home"
      className="group relative h-screen min-h-[680px] w-full overflow-hidden bg-navy"
    >
      {/* Background video */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={content.poster}
        onCanPlay={() => setVideoLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
          videoLoaded ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      >
        <source src={content.video} type="video/mp4" />
      </video>

      {/* Cinematic background fallback */}
      <div
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
          videoLoaded ? "opacity-0" : "opacity-100"
        }`}
        style={{ backgroundImage: `url(${content.poster})` }}
      />

      {/* Readability overlay */}
      <div className="absolute inset-0 bg-navy/60" />

      {/* Main content */}
      <div className="relative z-10 flex h-full items-center">
        <div className="mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-10">
          <div className="max-w-3xl">

            {/* Eyebrow */}
            <div className="hero-eyebrow mb-6">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">
                {content.eyebrow}
              </span>
            </div>

            {/* Main headline */}
            <h1 className="hero-title max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              {content.title}
            </h1>

            {/* Description */}
            <p className="hero-desc mt-7 max-w-xl text-base leading-7 text-white/75 sm:text-lg">
              {content.description}
            </p>

            {/* CTA */}
            <div className="hero-cta mt-9 flex flex-wrap items-center gap-5">
              <button
                onClick={onApplyClick}
                className="group/btn inline-flex items-center gap-3 rounded-md bg-gold px-7 py-3.5 text-sm font-semibold text-navy transition-colors duration-300 hover:bg-gold/90 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-navy"
              >
                Apply Now

                <ArrowRight
                  size={17}
                  className="transition-transform duration-300 group-hover/btn:translate-x-1"
                />
              </button>

              <button
                onClick={() => {
                  document
                    .getElementById("about")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="group/about inline-flex items-center gap-2 text-sm font-medium text-white/85 transition-colors duration-300 hover:text-white"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 transition-all duration-300 group-hover/about:border-white/70">
                  <Play size={13} fill="currentColor" />
                </span>

                Discover Nalik
              </button>
            </div>

            {/* Training highlights */}
            <div className="hero-meta mt-12 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-white/15 pt-5">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-white/55">
                Premiere Pro
              </span>

              <span className="h-1 w-1 rounded-full bg-white/30" />

              <span className="text-xs font-medium uppercase tracking-[0.16em] text-white/55">
                DaVinci Resolve
              </span>

              <span className="h-1 w-1 rounded-full bg-white/30" />

              <span className="text-xs font-medium uppercase tracking-[0.16em] text-white/55">
                Practical Training
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 right-8 z-10 hidden items-center gap-3 sm:flex">
        <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/45">
          Scroll
        </span>

        <div className="flex h-9 w-6 items-start justify-center rounded-full border border-white/25 pt-2">
          <ChevronDown
            size={13}
            className="animate-bounce text-white/60"
          />
        </div>
      </div>

      {/* Mobile scroll indicator */}
      <div className="absolute bottom-7 left-1/2 z-10 -translate-x-1/2 sm:hidden">
        <ChevronDown
          size={20}
          className="animate-bounce text-white/60"
        />
      </div>
    </section>
  );
}