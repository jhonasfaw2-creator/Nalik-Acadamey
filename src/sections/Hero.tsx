"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowRight, Play } from "lucide-react";

interface HeroProps {
  onApplyClick: () => void;
}

const DEFAULTS = {
  badge: "Professional Media Training",
  title: "Master the Art of Visual Storytelling",
  description:
    "Learn filmmaking, video editing, and media production from industry professionals. Transform your creative passion into a career.",
  video: "/assets/hero/hero.mp4",
  poster: "/assets/hero/poster.jpg",
};

export default function Hero({ onApplyClick }: HeroProps) {
  const [content, setContent] = useState(DEFAULTS);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetch("/api/content?section=hero")
      .then((r) => r.json())
      .then((d) => {
        if (d.badge || d.title || d.description) {
          // Only update state if values actually changed to prevent video re-renders
          setContent((prev) => ({
            badge: d.badge || prev.badge,
            title: d.title || prev.title,
            description: d.description || prev.description,
            video: d.video || prev.video,
            poster: d.poster || prev.poster,
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Force autoplay fallback if browser policy delays playback
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay policy fallback handling if muted fails
      });
    }
  }, [content.video]);

  return (
    <section id="home" className="relative h-screen w-full overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={content.poster}
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src={content.video} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-navy/80" />

      <div className="relative z-10 flex h-full items-center">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="hero-badge mb-4 inline-flex items-center gap-2 rounded-full bg-gold/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-gold">
              <Play size={12} fill="currentColor" /> {content.badge}
            </p>

            <h1 className="hero-title text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              {content.title.includes("Visual Storytelling") ? (
                <>
                  {content.title.split("Visual Storytelling")[0]}
                  <span className="text-gold">Visual Storytelling</span>
                  {content.title.split("Visual Storytelling")[1]}
                </>
              ) : (
                content.title
              )}
            </h1>

            <p className="hero-desc mt-6 max-w-lg text-lg leading-relaxed text-white/80">
              {content.description}
            </p>

            <div className="hero-cta mt-8 flex flex-wrap gap-4">
              <button
                onClick={onApplyClick}
                className="btn-gold inline-flex items-center gap-2 rounded-md bg-gold px-7 py-3 text-sm font-semibold text-navy"
              >
                Apply Now <ArrowRight size={16} />
              </button>
              <a
                href="#courses"
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById("courses");
                  if (el) {
                    const top = el.getBoundingClientRect().top + window.scrollY - 80;
                    window.scrollTo({ top, behavior: "smooth" });
                  }
                }}
                className="btn-outline-white inline-flex items-center gap-2 rounded-md border border-white/30 px-7 py-3 text-sm font-semibold text-white"
              >
                Explore Courses <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="hero-gold-line absolute bottom-0 left-0 right-0 h-1 bg-gold" />
    </section>
  );
}