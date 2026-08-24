"use client";

import { useEffect, useRef, useState } from "react";
import { Hammer, Film, MessageCircle, Briefcase } from "lucide-react";

const ICONS = [Hammer, Film, MessageCircle, Briefcase];

const DEFAULTS = {
  badge: "How You Learn",
  title: "A learning experience built around practice, not theory.",
  description: "From day one, you are editing, designing, and creating. That is how real skills are built.",
  steps: [
    { title: "Learn by Doing", text: "No long lectures. Every class is hands-on — you edit footage, design graphics, and build projects from the first session." },
    { title: "Work on Real Projects", text: "Practice with the same types of content professionals create daily — promos, social media videos, title sequences, and more." },
    { title: "Get Personal Feedback", text: "Instructors review your work one-on-one, point out what to improve, and guide you toward professional-level output." },
    { title: "Build Your Portfolio", text: "Leave the academy with a collection of polished projects ready to show employers, clients, or use for freelancing." },
  ],
};

export default function HowYouLearn() {
  const headingRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState(DEFAULTS);

  useEffect(() => {
    fetch("/api/content?section=how-you-learn")
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
            description: d.description || DEFAULTS.description,
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
    <section className="bg-warm-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div ref={headingRef} className="opacity-0 translate-y-6 transition-all duration-700 ease-out">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">{content.badge}</p>
          <h2 className="max-w-2xl text-3xl font-bold leading-snug text-navy sm:text-4xl">{content.title}</h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-600">{content.description}</p>
        </div>
        <div ref={gridRef} className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 opacity-0 translate-y-6 transition-all duration-700 delay-150 ease-out">
          {content.steps.map((step, i) => {
            const Icon = ICONS[i] || Hammer;
            return (
              <div key={step.title} className="group flex flex-col">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-gold/30 transition-colors group-hover:text-gold/50">{String(i + 1).padStart(2, "0")}</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10 text-gold"><Icon size={18} /></div>
                </div>
                <h3 className="mt-3 text-lg font-bold text-navy">{step.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">{step.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
