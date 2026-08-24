"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Send, PhoneCall, Rocket } from "lucide-react";

const ICONS = [BookOpen, Send, PhoneCall, Rocket];

const DEFAULTS = {
  badge: "How It Works",
  title: "Four simple steps to get started.",
  steps: [
    { title: "Choose Your Course", text: "Browse our programs and pick the one that matches your goals — video editing, graphic design, or color grading." },
    { title: "Submit Your Application", text: "Fill out the short application form with your details, experience level, and motivation. Takes less than two minutes." },
    { title: "Get Contacted", text: "Our team reviews your application and reaches out to discuss next steps, scheduling, and any questions you have." },
    { title: "Start Learning", text: "Jump into hands-on classes with real projects. Build your skills week by week and leave with a professional portfolio." },
  ],
};

export default function HowItWorks() {
  const headingRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState(DEFAULTS);

  useEffect(() => {
    fetch("/api/content?section=how-it-works")
      .then((r) => r.json())
      .then((d) => {
        if (d.badge || d.title) {
          const steps = [];
          for (let i = 1; i <= 4; i++) {
            if (d[`step${i}_title`]) steps.push({ title: d[`step${i}_title`], text: d[`step${i}_text`] || "" });
          }
          setContent({
            badge: d.badge || DEFAULTS.badge,
            title: d.title || DEFAULTS.title,
            steps: steps.length > 0 ? steps : DEFAULTS.steps,
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
    <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div ref={headingRef} className="opacity-0 translate-y-6 transition-all duration-700 ease-out">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">{content.badge}</p>
          <h2 className="max-w-2xl text-3xl font-bold leading-snug text-navy sm:text-4xl">{content.title}</h2>
        </div>
        <div ref={gridRef} className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 opacity-0 translate-y-6 transition-all duration-700 delay-150 ease-out">
          {content.steps.map((step, i) => {
            const Icon = ICONS[i] || BookOpen;
            return (
              <div key={step.title} className="group rounded-xl border border-gray-200 p-6 transition-all duration-300 hover:border-gold/20 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold transition-colors group-hover:bg-gold/20"><Icon size={18} /></div>
                  <span className="text-2xl font-bold text-gold/40">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-navy">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{step.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
