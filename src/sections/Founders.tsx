"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

const DEFAULTS = {
  badge: "Behind Nalik Academy",
  name: "Nalik Academy",
  role: "Founder & Video Editor",
  portraitUrl: "/assets/founder-portrait.jpg",
  bioShort: "Ethiopian video editor and creative professional with experience editing social-media content for established Ethiopian creators and influencers, including Loft Haron Shirobaie.",
  bioLong:
    "I built Nalik Academy from a background in editing for social-media and creator content. Working with established Ethiopian creators and influencers shaped how I think about pacing, hooks, captions, sound design, colour grading, motion graphics, and the difference between a good cut and an edit that holds attention. This academy is my attempt to pass that practice on, not as theory but as the kind of hands-on editing work that shows up in real projects.",
  specialties: [
    "Storytelling",
    "Pacing",
    "Hooks",
    "Sound Design",
    "Colour Grading",
    "Motion Graphics",
    "Short-form Editing",
    "Long-form Editing",
  ],
  featuredClients: ["Loft Haron Shirobaie"],
};

export default function Founders() {
  const sectionRef = useRef<HTMLElement>(null);
  const portraitRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState(DEFAULTS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch("/api/content?section=founders")
      .then((r) => r.json())
      .then((d) => {
        if (d.badge || d.name || d.portraitUrl) {
          setData({
            badge: d.badge || DEFAULTS.badge,
            name: d.name || DEFAULTS.name,
            role: d.role || DEFAULTS.role,
            portraitUrl: d.portraitUrl || DEFAULTS.portraitUrl,
            bioShort: d.bioShort || DEFAULTS.bioShort,
            bioLong: d.bioLong || DEFAULTS.bioLong,
            specialties: d.specialties || DEFAULTS.specialties,
            // JSON from /api/content is a flat string map, so treat arrays as unknown and re-derive them safely.
            featuredClients: ((d as unknown as { featuredClients?: string[] }).featuredClients) || []
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!sectionRef.current || !mounted) return;
    const els = [portraitRef.current, contentRef.current].filter(Boolean);
    els.forEach((el, i) => {
      if (!el) return;
      el.classList.add("reveal");
      el.style.transitionDelay = `${i * 0.12}s`;
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
  }, [mounted]);

  const goToSelectedWork = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById("our-work");
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <section
      id="founders"
      ref={sectionRef}
      className="relative isolate overflow-hidden bg-warm-white px-4 py-20 sm:px-6 lg:px-8"
    >
      {/* Quiet editorial accent, connected to the portfolio’s navy/gold */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-navy/[0.04] via-transparent to-transparent"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl">
        <div className="mx-4 sm:mx-6 lg:mx-8">
          {/* Heading */}
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">
            {data.badge}
          </p>
          <h2 className="hero-title text-3xl font-bold leading-snug text-navy sm:text-4xl">
            One editor. One academy.
          </h2>
          <p className="mt-4 hero-desc text-base leading-relaxed text-gray-600">
            {data.bioShort}
          </p>

          <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-2">
            {/* Portrait */}
            <div
              ref={portraitRef}
              className="relative overflow-hidden rounded-2xl bg-navy"
            >
              <img
                src={data.portraitUrl}
                alt={`${data.name}, founder portrait`}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy/40 via-transparent to-transparent" />

              {/* Name + role over the portrait */}
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <p className="text-sm font-semibold uppercase tracking-wide text-gold">
                  {data.role}
                </p>
                <h3 className="mt-1 text-xl font-semibold leading-snug text-white">
                  {data.name}
                </h3>
              </div>
            </div>

            {/* Story */}
            <div ref={contentRef} className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold leading-snug text-navy">
                  From editing for creators to building Nalik Academy
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {data.bioLong}
                </p>
              </div>

              {data.featuredClients.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Selected creator & client work
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {data.featuredClients.map((client) => (
                      <li
                        key={client}
                        className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-navy"
                      >
                        {client}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Editing specialties</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {data.specialties.map((specialty) => (
                    <li
                      key={specialty}
                      className="rounded-full bg-navy/5 border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-navy"
                    >
                      {specialty}
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href="#our-work"
                onClick={goToSelectedWork}
                className="inline-flex items-center gap-2 text-sm font-medium text-gold transition-colors hover:text-gold-hover"
              >
                Explore His Work
                <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
