"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

const DEFAULTS = {
  badge: "Meet the Founders",
  name: "Nalik Academy",
  role: "Founding Team",
  bio: "A team of passionate media professionals dedicated to training the next generation of storytellers in Ethiopia. With years of hands-on experience in film, television, and digital content creation, we built Nalik Academy to bridge the gap between talent and opportunity in the creative industry.",
};

export default function Founders() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState(DEFAULTS);

  useEffect(() => {
    fetch("/api/content?section=founders")
      .then((r) => r.json())
      .then((d) => {
        if (d.badge || d.name) {
          setData({
            badge: d.badge || DEFAULTS.badge,
            name: d.name || DEFAULTS.name,
            role: d.role || DEFAULTS.role,
            bio: d.bio || DEFAULTS.bio,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Scroll reveal
  useEffect(() => {
    const els = [contentRef.current, mediaRef.current].filter(Boolean);
    els.forEach((el, i) => {
      if (!el) return;
      el.classList.add("reveal");
      el.style.transitionDelay = `${i * 0.15}s`;
    });
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => observer.observe(el!));
    return () => els.forEach((el) => observer.unobserve(el!));
  }, []);

  return (
    <section ref={sectionRef} className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">{data.badge}</p>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div ref={mediaRef} className="order-2 lg:order-1">
            <div className="relative mx-auto max-w-xs overflow-hidden rounded-lg bg-navy">
              <img src="/assets/logo.jpeg" alt="Nalik Academy founding team" className="h-auto w-full" loading="lazy" />
            </div>
          </div>
          <div ref={contentRef} className="order-1 lg:order-2">
            <h2 className="text-3xl font-bold leading-snug text-navy sm:text-4xl">{data.name}</h2>
            <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-gold">{data.role}</p>
            <p className="mt-6 text-base leading-relaxed text-gray-600">{data.bio}</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a href="#contact" onClick={(e) => { e.preventDefault(); const el = document.getElementById("contact"); if (el) { const top = el.getBoundingClientRect().top + window.scrollY - 80; window.scrollTo({ top, behavior: "smooth" }); } }} className="btn-navy inline-flex items-center gap-2 rounded-md bg-navy px-6 py-2.5 text-sm font-semibold text-white">
                Get in Touch <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
