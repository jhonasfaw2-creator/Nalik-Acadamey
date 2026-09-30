"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, Asterisk } from "lucide-react";
import { SOCIAL_LINKS } from "@/lib/socials";

const INSTAGRAM_ICON =
  SOCIAL_LINKS.find((l) => l.label === "Instagram")?.icon ?? "";
const TIKTOK_ICON =
  SOCIAL_LINKS.find((l) => l.label === "TikTok")?.icon ?? "";

const CREATORS = [
  { name: "Lofty Haron", role: "Streamer", image: "/assets/Collabritors/Loftyharon.jpeg", tiktok: "", instagram: "" },
  { name: "Seyoum Tad", role: "Streamer", image: "/assets/Collabritors/SeyoumTad.jpeg", tiktok: "", instagram: "" },
  { name: "Natty2cold", role: "Streamer", image: "/assets/Collabritors/Natty2cold.jpeg", tiktok: "", instagram: "" },
  { name: "Kaya Faya", role: "Streamer", image: "/assets/Collabritors/Kayafaya.jpeg", tiktok: "", instagram: "" },
  { name: "Shiro B", role: "Creator & Host", image: "/assets/Collabritors/shirobaee.png", tiktok: "", instagram: "" },
  { name: "TAT", role: "Streamer", image: "/assets/Collabritors/TAT.jpeg", tiktok: "", instagram: "" },
  { name: "Lil Kidus", role: "Creator & Stylist", image: "/assets/Collabritors/LilKidus.jpg", tiktok: "", instagram: "" },
];

const BUSINESSES = [
  { name: "Salt Burger", role: "Cafe & Hospitality", image: "/assets/Collabritors/SaltBurger.jpeg" },
  { name: "Yorgo", role: "Business", image: "/assets/Collabritors/Yorgo.jpeg" },
];

export default function Collaborations() {
  const sectionRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !mounted) return;

    el.classList.add("reveal", "stagger-children");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted]);

  return (
    <section
      id="collaborations"
      ref={sectionRef}
      className="relative overflow-hidden bg-warm-white px-4 py-16 sm:px-6 lg:px-8"
    >
      {/* Warm color glow for energy */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-gold/15 blur-[100px]"
      />

      <div className="relative mx-auto max-w-5xl">
        {/* ── Header ─────────────────────────────── */}
        <div className="reveal-child mx-auto max-w-xl text-center">
          <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold">
            <Asterisk size={15} strokeWidth={2.5} aria-hidden="true" />
            Client Work
          </p>
          <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-navy sm:text-4xl">
            Some of his works.
          </h2>
          <p className="mt-3 text-base text-gray-500">
            Freelance video editing for streamers, content creators, and
            businesses — made for social media.
          </p>
        </div>

        {/* ── Creators & Streamers ───────────────── */}
        <div className="reveal-child mt-12">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400">
            Creators &amp; Streamers
          </p>
          <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {CREATORS.map((creator, i) => (
              <CastCard key={creator.name} creator={creator} index={i} />
            ))}

            {/* "You?" invitation tile — fills the 8th slot, adds energy */}
            <article className="reveal-child group flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gold/50 bg-gold/[0.06] p-4 text-center transition-all duration-300 hover:-translate-y-1 hover:border-gold hover:bg-gold/10">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold text-2xl font-black text-navy shadow-lg shadow-gold/30 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                ?
              </span>
              <p className="mt-3 text-base font-bold text-navy">You next?</p>
              <a
                href="#contact"
                className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-gold hover:text-gold-hover"
              >
                Start a project
                <ArrowRight size={13} aria-hidden="true" />
              </a>
            </article>
          </div>
        </div>

        {/* ── Brands & Businesses ────────────────── */}
        <div className="reveal-child mt-14">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400">
            Brands &amp; Businesses
          </p>
          <div className="mx-auto mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-5">
            {BUSINESSES.map((business, i) => (
              <article
                key={business.name}
                className="group text-center"
                style={{ transitionDelay: `${i * 0.08}s` }}
              >
                <div
                  className={`relative aspect-[16/9] w-[122px] overflow-hidden rounded-xl ring-1 ring-gray-200 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_24px_-10px_rgba(226,160,51,0.35)] group-hover:ring-gold/60 sm:w-[162px] ${
                    i % 2 === 0
                      ? "group-hover:rotate-[0.5deg]"
                      : "group-hover:-rotate-[0.5deg]"
                  }`}
                >
                  <Image
                    src={business.image}
                    alt={business.name}
                    fill
                    sizes="(max-width: 640px) 122px, 162px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy/70 via-navy/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-2.5">
                    <p className="text-sm font-black text-white drop-shadow-sm">
                      {business.name}
                    </p>
                    <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/70">
                      {business.role}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* ── Tiny CTA ───────────────────────────── */}
        <div className="reveal-child mt-12 text-center">
          <a
            href="#contact"
            className="group inline-flex items-center gap-1.5 text-sm font-semibold text-navy transition-colors hover:text-gold"
          >
            Want your content professionally edited?
            <ArrowRight
              size={14}
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </a>
        </div>
      </div>
    </section>
  );
}

function CastCard({
  creator,
  index,
}: {
  creator: (typeof CREATORS)[number];
  index: number;
}) {
  const tilt = index % 2 === 0 ? "group-hover:rotate-1" : "group-hover:-rotate-1";

  return (
    <article
      className="reveal-child group mx-auto w-full max-w-[126px] text-center sm:max-w-[140px]"
      style={{ transitionDelay: `${(index % 4) * 0.06}s` }}
    >
      <div
        className={`relative aspect-[4/5] overflow-hidden rounded-3xl ring-1 ring-gray-200 transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_20px_40px_-12px_rgba(21,27,41,0.25)] group-hover:ring-2 group-hover:ring-gold ${tilt}`}
      >
        <Image
          src={creator.image}
          alt={creator.name}
          fill
          sizes="(max-width: 640px) 126px, 140px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
        />

        {/* Role sticker */}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-navy shadow-sm backdrop-blur-sm">
          {creator.role}
        </span>

        {/* Social pills on photo */}
        <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1.5 bg-gradient-to-t from-navy/80 via-navy/30 to-transparent pb-3 pt-8 opacity-0 transition-all duration-300 group-hover:opacity-100">
          <SocialPill href={creator.tiktok} icon={TIKTOK_ICON} label={`${creator.name} on TikTok`} />
          <SocialPill href={creator.instagram} icon={INSTAGRAM_ICON} label={`${creator.name} on Instagram`} />
        </div>
      </div>

      {/* Name BELOW photo — cast style */}
      <h3 className="mt-3 text-base font-bold tracking-tight text-navy sm:text-lg">
        {creator.name}
      </h3>
      <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.12em] text-gray-400 sm:text-[11px]">
        {creator.role}
      </p>
    </article>
  );
}

function SocialPill({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  const classes =
    "flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition-all duration-200 " +
    (href
      ? "bg-white/90 text-navy hover:bg-gold hover:text-navy"
      : "border border-dashed border-white/60 text-white/70");

  if (!href) {
    // Placeholder: dashed pill until a real URL is added.
    return (
      <span className={classes} title="Link coming soon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d={icon} />
        </svg>
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={classes}
      aria-label={label}
      title={label}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d={icon} />
      </svg>
    </a>
  );
}
