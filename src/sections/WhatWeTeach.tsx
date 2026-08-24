"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Image, PenTool, Palette } from "lucide-react";

const ICONS = [Film, Image, PenTool, Palette];

const DEFAULTS = {
  badge: "What We Teach",
  title: "Practical skills. Professional tools. Real projects.",
  description:
    "Every course at Nalik Academy is built around the software professionals actually use. You learn by doing — not by watching lectures.",
  tools: [
    { name: "Adobe Premiere Pro", description: "Industry-standard video editing. From timeline basics to advanced multicam workflows, color correction, and export settings for any platform." },
    { name: "Adobe Photoshop", description: "Essential for thumbnail design, title cards, image retouching, and visual assets that complement your video projects." },
    { name: "Adobe Illustrator", description: "Vector graphics for logos, lower thirds, motion graphics elements, and scalable design assets used across all media." },
    { name: "DaVinci Resolve", description: "Professional-grade color grading and post-production. Used on major films and increasingly adopted for editing and audio finishing." },
  ],
};

export default function WhatWeTeach() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState(DEFAULTS);

  useEffect(() => {
    fetch("/api/content?section=what-we-teach")
      .then((r) => r.json())
      .then((d) => {
        if (d.badge || d.title) {
          const tools = [];
          for (let i = 1; i <= 4; i++) {
            if (d[`tool${i}_name`]) {
              tools.push({ name: d[`tool${i}_name`], description: d[`tool${i}_desc`] || "" });
            }
          }
          setContent({
            badge: d.badge || DEFAULTS.badge,
            title: d.title || DEFAULTS.title,
            description: d.description || DEFAULTS.description,
            tools: tools.length > 0 ? tools : DEFAULTS.tools,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("opacity-100", "translate-y-0");
            entry.target.classList.remove("opacity-0", "translate-y-6");
          }
        });
      },
      { threshold: 0.1 }
    );
    const els = [headingRef.current, gridRef.current].filter(Boolean);
    els.forEach((el) => observer.observe(el!));
    return () => els.forEach((el) => observer.unobserve(el!));
  }, []);

  return (
    <section id="what-we-teach" ref={sectionRef} className="bg-navy px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div ref={headingRef} className="opacity-0 translate-y-6 transition-all duration-700 ease-out">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">{content.badge}</p>
          <h2 className="max-w-2xl text-3xl font-bold leading-snug text-white sm:text-4xl">{content.title}</h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/60">{content.description}</p>
        </div>

        <div ref={gridRef} className="mt-12 grid gap-6 sm:grid-cols-2 opacity-0 translate-y-6 transition-all duration-700 delay-150 ease-out">
          {content.tools.map((tool, i) => {
            const Icon = ICONS[i] || Film;
            return (
              <div key={tool.name} className="group rounded-lg border border-white/10 bg-white/5 p-6 transition-all duration-300 hover:border-gold/30 hover:bg-white/[0.07]">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold transition-colors duration-300 group-hover:bg-gold/20">
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{tool.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/60">{tool.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
