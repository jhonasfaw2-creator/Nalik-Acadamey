"use client";

import { useEffect, useRef, useState } from "react";
const DEFAULTS = {
  badge: "How You Learn",
  title: "A learning experience built around practice, not theory.",
  description: "From day one, you are editing, designing, and creating. That is how real skills are built.",
  steps: [
    { title: "Learn by Doing", text: "No long lectures. Every class is hands-on: you edit footage, design graphics, and build projects from the first session." },
    { title: "Work on Real Projects", text: "Practice with the same types of content professionals create daily: promos, social media videos, title sequences, and more." },
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

  // Staggered step reveal
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
  }, [content.steps]);

  return (
    <section id="how-you-learn" className="bg-warm-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div ref={headingRef}>
          <p className="mb-3 text-sm font-medium text-gold">{content.badge}</p>
          <h2 className="max-w-2xl text-3xl font-bold leading-snug text-navy sm:text-4xl">{content.title}</h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-600">{content.description}</p>
        </div>
        <div ref={gridRef} className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {content.steps.map((step, i) => {
            return (
              <div key={step.title} className="group flex flex-col">
                <span className="text-sm font-medium text-gold">{i + 1}</span>
                <h3 className="mt-2 text-lg font-semibold text-navy">{step.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">{step.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
