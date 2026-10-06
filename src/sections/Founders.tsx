"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";

const DEFAULTS = {
  badge: "Meet the founder",
  name: "",
  role: "Founder of Nalik Academy",
  portraitUrl: "/assets/natiii.jpg",
  bio:
    "Before Nalik Academy, he worked as a freelance video editor in Ethiopia. The work covered YouTube videos, short form clips, and longer stories, and it taught him how pacing, hooks, sound, and colour decide whether an edit holds attention." +
    "\n\n" +
    "The academy grew out of that experience. He wanted to teach editing the way he learned it, through real projects and practical decisions instead of theory alone. Students here work on the same kinds of edits he handled as a freelancer, with the same attention to story and finish.",
  specialties: [
    "Video Editing",
    "YouTube Editing",
    "Short Form Editing",
    "Short Film Editing",
    "Colour Grading",
    "Sound Design",
    "Motion Graphics",
    "Storytelling and Pacing",
  ],
};

export default function Founders() {
  const headerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const specRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState(DEFAULTS);

  useEffect(() => {
    fetch("/api/content?section=founders")
      .then((r) => r.json())
      .then((d) => {
        if (!d || typeof d !== "object") return;

        setData({
          badge:
            typeof d.badge === "string" && d.badge.trim()
              ? d.badge
              : DEFAULTS.badge,
          name: typeof d.name === "string" ? d.name : DEFAULTS.name,
          role:
            typeof d.role === "string" && d.role.trim()
              ? d.role
              : DEFAULTS.role,
          portraitUrl:
            typeof d.portraitUrl === "string" && d.portraitUrl.trim()
              ? d.portraitUrl
              : DEFAULTS.portraitUrl,
          bio:
            typeof d.bio === "string" && d.bio.trim() ? d.bio : DEFAULTS.bio,
          specialties:
            Array.isArray(d.specialties) && d.specialties.length
              ? (d.specialties as string[])
              : DEFAULTS.specialties,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const elements = [
      headerRef.current,
      imageRef.current,
      contentRef.current,
      specRef.current,
    ].filter(Boolean) as HTMLElement[];

    elements.forEach((element, index) => {
      element.classList.add("founder-reveal");
      element.style.transitionDelay = `${index * 80}ms`;
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
      {
        threshold: 0.12,
      }
    );

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  const goToWork = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    const target = document.getElementById("our-work");

    if (!target) return;

    const top = target.getBoundingClientRect().top + window.scrollY - 80;

    window.scrollTo({
      top,
      behavior: "smooth",
    });
  };

  const bioParagraphs = data.bio
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <>
      <section
        id="founders"
        className="relative overflow-hidden bg-warm-white"
      >
        {/* -----------------------------------------------------------
            INTRO
        ------------------------------------------------------------ */}
        <div className="mx-auto max-w-7xl px-5 pt-20 sm:px-8 sm:pt-24 lg:px-12 lg:pt-32">
          <div ref={headerRef}>
            <div className="flex items-center justify-between gap-6 border-b border-gray-300/70 pb-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">
                {data.badge}
              </p>

              <p className="hidden text-[10px] uppercase tracking-[0.22em] text-gray-400 sm:block">
                Nalik Academy
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
              <h2 className="lg:col-span-7 text-3xl font-semibold leading-[1.12] tracking-[-0.03em] text-navy sm:text-4xl lg:text-[2.75rem]">
                He learned the craft editing for other creators. Nalik
                Academy is where he teaches it.
              </h2>

              <p className="lg:col-span-5 lg:self-end lg:pl-8 text-base leading-7 text-gray-600 sm:text-lg sm:leading-8">
                Nalik Academy was opened by an Ethiopian freelance video
                editor. Everything taught here comes from his own editing
                work for creators and social media personalities.
              </p>
            </div>
          </div>
        </div>

        {/* -----------------------------------------------------------
            PORTRAIT AND STORY
        ------------------------------------------------------------ */}
        <div className="mx-auto mt-16 max-w-7xl px-5 sm:mt-20 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-0">
            {/* Portrait */}
            <div ref={imageRef} className="lg:col-span-7">
              <figure>
                <div className="relative h-[460px] w-full overflow-hidden bg-navy sm:h-[580px] lg:h-[760px]">
                  <img
                    src={data.portraitUrl}
                    alt={`${data.name || data.role}, Ethiopian freelance video editor`}
                    className="h-full w-full object-cover object-top"
                    loading="lazy"
                    decoding="async"
                  />
                </div>

                <figcaption className="mt-5 flex items-baseline justify-between gap-6 border-t border-gray-300/70 pt-4">
                  <div>
                    <p className="text-sm font-semibold text-navy">
                      {data.role}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Ethiopian freelance video editor
                    </p>
                  </div>

                </figcaption>
              </figure>
            </div>

            {/* Story */}
            <div
              ref={contentRef}
              className="lg:col-span-5 lg:border-l lg:border-gray-300/70 lg:pl-12 lg:pt-24 xl:pl-16"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
                The story
              </p>

              <h3 className="mt-5 text-2xl font-semibold leading-snug tracking-[-0.02em] text-navy sm:text-[1.75rem]">
                Behind the edit.
              </h3>

              <div className="mt-6 space-y-5 text-[15px] leading-7 text-gray-600 sm:text-base sm:leading-8">
                {bioParagraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* -----------------------------------------------------------
            SPECIALTIES AND LINK TO WORK
        ------------------------------------------------------------ */}
        <div
          ref={specRef}
          className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-24"
        >
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
                Editing specialties
              </p>

              <p className="mt-5 max-w-xs text-sm leading-6 text-gray-500">
                The skills he built as a freelancer. This is what students
                learn at Nalik Academy.
              </p>
            </div>

            <div className="lg:col-span-8">
              <div className="grid grid-cols-1 border-t border-gray-300/70 sm:grid-cols-2">
                {data.specialties.map((specialty, index) => (
                  <div
                    key={specialty}
                    className="flex items-baseline gap-5 border-b border-gray-300/70 py-4 sm:odd:pr-10 sm:even:border-l sm:even:border-gray-300/70 sm:even:pl-10"
                  >
                    <span className="w-6 shrink-0 text-[11px] tabular-nums text-gold">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <span className="text-[15px] font-medium text-navy sm:text-base">
                      {specialty}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Link to Our Work */}
          <div className="mt-16 flex flex-col gap-6 border-t border-gray-300/70 pt-8 sm:mt-20 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-md">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
                Our work
              </p>

              <p className="mt-4 text-lg leading-7 text-navy sm:text-xl">
                See examples of the editing behind the academy.
              </p>
            </div>

            <a
              href="#our-work"
              onClick={goToWork}
              className="group inline-flex w-fit items-center gap-3"
            >
              <span className="border-b border-navy pb-1 text-sm font-semibold text-navy transition-colors duration-200 group-hover:border-gold group-hover:text-gold">
                Visit Our Work
              </span>

              <ArrowUpRight
                size={16}
                strokeWidth={1.8}
                className="text-navy transition-colors duration-200 group-hover:text-gold"
              />
            </a>
          </div>
        </div>
      </section>

      <style jsx>{`
        .founder-reveal {
          opacity: 0;
          transform: translateY(20px);
          transition:
            opacity 700ms ease,
            transform 700ms ease;
        }

        .founder-reveal.visible {
          opacity: 1;
          transform: translateY(0);
        }

        @media (prefers-reduced-motion: reduce) {
          .founder-reveal {
            opacity: 1;
            transform: none;
            transition: none;
          }
        }
      `}</style>
    </>
  );
}
