"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Play } from "lucide-react";

interface HeroProps {
  onApplyClick: () => void;
}

const DEFAULTS = {
  badge: "Professional Media Training",
  title: "Master the Art of Visual Storytelling",
  description:
    "Learn filmmaking, video editing, and media production from industry professionals. Transform your creative passion into a career.",
};

export default function Hero({ onApplyClick }: HeroProps) {
  const [content, setContent] = useState(DEFAULTS);

  useEffect(() => {
    fetch("/api/content?section=hero")
      .then((r) => r.json())
      .then((d) => {
        if (d.badge || d.title || d.description) {
          setContent({
            badge: d.badge || DEFAULTS.badge,
            title: d.title || DEFAULTS.title,
            description: d.description || DEFAULTS.description,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <section id="home" className="relative h-screen w-full overflow-hidden">
      <video autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover">
        <source src="/assets/hero/hero.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-navy/80" />

      <div className="relative z-10 flex h-full items-center">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-gold/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-gold">
              <Play size={12} fill="currentColor" /> {content.badge}
            </p>

            <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              {content.title.split("Visual Storytelling").length > 1 ? (
                <>
                  {content.title.split("Visual Storytelling")[0]}
                  <span className="text-gold">Visual Storytelling</span>
                  {content.title.split("Visual Storytelling")[1]}
                </>
              ) : (
                content.title
              )}
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/80">
              {content.description}
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button
                onClick={onApplyClick}
                className="inline-flex items-center gap-2 rounded-md bg-gold px-7 py-3 text-sm font-semibold text-navy transition-all duration-200 hover:bg-gold-hover hover:shadow-lg hover:shadow-gold/20"
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
                className="inline-flex items-center gap-2 rounded-md border border-white/30 px-7 py-3 text-sm font-semibold text-white transition-all duration-200 hover:border-white hover:bg-white/10"
              >
                Explore Courses <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gold" />
    </section>
  );
}
