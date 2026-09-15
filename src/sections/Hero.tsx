"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";

interface HeroProps {
  onApplyClick: () => void;
}

const DEFAULTS = {
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
        if (d.title || d.description) {
          // Only update state if values actually changed to prevent video re-renders
          setContent((prev) => ({
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
            <h1 className="hero-title text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              {content.title}
            </h1>

            <p className="hero-desc mt-6 max-w-lg text-lg leading-relaxed text-white/80">
              {content.description}
            </p>

            <div className="hero-cta mt-8">
              <button
                onClick={onApplyClick}
                className="btn-gold inline-flex items-center gap-2 rounded-md bg-gold px-7 py-3 text-sm font-semibold text-navy"
              >
                Apply Now <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}