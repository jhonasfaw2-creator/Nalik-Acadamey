"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Palette, SlidersHorizontal, Award } from "lucide-react";

const ICONS = [Film, Palette, SlidersHorizontal, Award];

const DEFAULTS = {
  badge: "Our Programs",
  title: "What you get when you join Nalik Academy.",
  description: "Every program is designed to take you from beginner to confident creator — with practical skills you can use immediately.",
  programs: [
    { title: "Hands-On Video Editing", text: "Edit real projects from day one. Learn timeline workflow, transitions, multicam editing, and export settings for YouTube, TV, and cinema using Adobe Premiere Pro and DaVinci Resolve." },
    { title: "Graphic Design Foundations", text: "Create professional thumbnails, title cards, logos, and social media assets. Master Adobe Photoshop for image editing and Illustrator for scalable vector design." },
    { title: "Color Grading & Finishing", text: "Go beyond basic corrections. Learn professional color grading workflows in DaVinci Resolve — the same tool used on major Hollywood productions." },
    { title: "Portfolio-Ready Output", text: "Every course ends with a portfolio project. You graduate with real work to show employers or clients, not just a certificate of attendance." },
  ],
};

export default function OurPrograms() {
  const headingRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState(DEFAULTS);

  useEffect(() => {
    fetch("/api/content?section=our-programs")
      .then((r) => r.json())
      .then((d) => {
        if (d.badge || d.title) {
          const programs = [];
          for (let i = 1; i <= 4; i++) {
            if (d[`item${i}_title`]) programs.push({ title: d[`item${i}_title`], text: d[`item${i}_text`] || "" });
          }
          setContent({
            badge: d.badge || DEFAULTS.badge,
            title: d.title || DEFAULTS.title,
            description: d.description || DEFAULTS.description,
            programs: programs.length > 0 ? programs : DEFAULTS.programs,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("opacity-100", "translate-y-0"); entry.target.classList.remove("opacity-0", "translate-y-6"); } }); },
      { threshold: 0.1 }
    );
    const els = [headingRef.current, gridRef.current].filter(Boolean);
    els.forEach((el) => observer.observe(el!));
    return () => els.forEach((el) => observer.unobserve(el!));
  }, []);

  return (
    <section className="bg-warm-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div ref={headingRef} className="opacity-0 translate-y-6 transition-all duration-700 ease-out">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">{content.badge}</p>
          <h2 className="max-w-2xl text-3xl font-bold leading-snug text-navy sm:text-4xl">{content.title}</h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-600">{content.description}</p>
        </div>
        <div ref={gridRef} className="mt-12 grid gap-6 sm:grid-cols-2 opacity-0 translate-y-6 transition-all duration-700 delay-150 ease-out">
          {content.programs.map((item, i) => {
            const Icon = ICONS[i] || Film;
            return (
              <div key={item.title} className="group rounded-xl border border-gray-200 bg-white p-6 transition-all duration-300 hover:border-gold/20 hover:shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold transition-colors duration-300 group-hover:bg-gold/20"><Icon size={20} /></div>
                  <div>
                    <h3 className="text-lg font-bold text-navy">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.text}</p>
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
