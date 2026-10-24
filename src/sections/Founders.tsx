"use client";

import { useEffect, useState, type MouseEvent } from "react";
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

  const goToWork = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const target = document.getElementById("our-work");
    if (!target) return;

    const top = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const bioParagraphs = data.bio
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <section id="founders" className="bg-warm-white px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-medium text-gold">{data.badge}</p>

        <div className="mt-4 max-w-4xl sm:mt-5">
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-navy">
            He learned the craft editing for other creators. Nalik Academy is
            where he teaches it.
          </h2>
        </div>

        <div className="mt-8 grid gap-7 sm:mt-10 sm:gap-9 lg:mt-12 lg:grid-cols-12 lg:items-start lg:gap-12">
          <figure className="mx-auto w-full max-w-xs lg:col-span-5 lg:mx-0 lg:max-w-sm">
            <div className="aspect-[4/5] overflow-hidden bg-navy">
              <img
                src={data.portraitUrl}
                alt={`${data.name || data.role}, Ethiopian freelance video editor`}
                className="h-full w-full object-cover object-[center_18%]"
                loading="lazy"
                decoding="async"
              />
            </div>
            <figcaption className="mt-3">
              <p className="text-sm font-semibold text-navy">
                {data.name || data.role}
              </p>
              <p className="mt-0.5 text-sm text-gray-500">
                {data.name ? data.role : "Ethiopian freelance video editor"}
              </p>
            </figcaption>
          </figure>

          <div className="lg:col-span-7">
            <p className="text-sm font-medium text-gold">The story</p>
            <h3 className="mt-2 text-2xl font-semibold leading-tight tracking-[-0.02em] text-navy sm:text-[1.75rem]">
              Behind the edit.
            </h3>

            <div className="mt-4 max-w-3xl space-y-4 text-[15px] leading-6 text-gray-600 sm:leading-7">
              {bioParagraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium text-gold">Editing specialties</p>
              <ul className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 pl-4 text-sm leading-5 text-navy marker:text-gold sm:gap-x-8">
                {data.specialties.map((specialty) => (
                  <li key={specialty}>{specialty}</li>
                ))}
              </ul>
            </div>

            <a
              href="#our-work"
              onClick={goToWork}
              className="group mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-navy underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gold"
            >
              See the work
              <ArrowUpRight
                size={16}
                strokeWidth={1.8}
                className="transition-colors group-hover:text-gold"
              />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
