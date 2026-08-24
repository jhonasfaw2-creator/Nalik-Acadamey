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

  // Scroll reveal heading
  useEffect(() => {
    const el = headingRef.current;
    if (!el) return;
    el.classList.add("reveal");
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add("visible"); observer.unobserve(el); } },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Staggered card reveal
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const cards = Array.from(grid.children) as HTMLElement[];
    cards.forEach((card, i) => {
      card.classList.add("reveal-child");
      card.style.transitionDelay = `${i * 0.1}s`;
    });
    grid.classList.add("stagger-children");
    grid.classList.add("reveal");
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { grid.classList.add("visible"); observer.unobserve(grid); } },
      { threshold: 0.1 }
    );
    observer.observe(grid);
    return () => observer.disconnect();
  }, [content.tools]);

  return (
    <section id="what-we-teach" ref={sectionRef} className="bg-navy px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div ref={headingRef}>
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">{content.badge}</p>
          <h2 className="max-w-2xl text-3xl font-bold leading-snug text-white sm:text-4xl">{content.title}</h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/60">{content.description}</p>
        </div>

        <div ref={gridRef} className="mt-12 grid gap-6 sm:grid-cols-2">
          {content.tools.map((tool, i) => {
            const Icon = ICONS[i] || Film;
            return (
              <div key={tool.name} className="card-hover group rounded-lg border border-white/10 bg-white/5 p-6">
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
