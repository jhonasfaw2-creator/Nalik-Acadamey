"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, User } from "lucide-react";
import { SOCIAL_LINKS } from "@/lib/socials";

interface CollaborationLink {
  label: string;
  url: string;
}

interface CreatorProfile {
  name: string;
  role: string;
  description?: string;
  avatarUrl?: string;
  links?: CollaborationLink[];
}

interface BusinessCollaborator {
  name: string;
  role: string;
  description?: string;
  logoUrl?: string;
  profileUrl?: string;
  links?: CollaborationLink[];
}

const MY_G_MEMBERS: CreatorProfile[] = [
  {
    name: "Lofty Haron",
    role: "Streamer",
    description: "Live creator and community storyteller.",
    avatarUrl: "",
    links: [{ label: "Instagram", url: "" }],
  },
  {
    name: "Seuymtad",
    role: "Streamer",
    description: "Content creator and streamer",
    avatarUrl: "",
    links: [{ label: "Instagram", url: "" }],
  },
  {
    name: "Natty2cold",
    role: "Streamer",
    description: "Creator and streamer",
    avatarUrl: "",
    links: [{ label: "TikTok", url: "" }],
  },
  {
    name: "Kaya Faya",
    role: "Streamer",
    description: "Creator and streamer",
    avatarUrl: "",
    links: [{ label: "Instagram", url: "" }],
  },
];

const SOLO_CREATORS: CreatorProfile[] = [
  {
    name: "Lil Kidus",
    role: "Creator & stylist",
    description: "Fashion-forward creator bringing strong visual identity and lifestyle storytelling.",
    avatarUrl: "",
    links: [{ label: "Instagram", url: "" }],
  },
  {
    name: "Shiro Bay",
    role: "Creator & host",
    description: "Creator and on-camera personality contributing to media and brand storytelling.",
    avatarUrl: "",
    links: [{ label: "Instagram", url: "" }],
  },
  {
    name: "TAT",
    role: "Streamer",
    description: "Digital creator and streamer",
    avatarUrl: "",
    links: [{ label: "TikTok", url: "" }],
  },
];

const BUSINESS_COLLABORATORS: BusinessCollaborator[] = [
  {
    name: "Salt Burger",
    role: "Cafe & hospitality partner",
    description: "A neighborhood cafe partner supporting community-based creative collaborations and local culture.",
    logoUrl: "",
    profileUrl: "",
    links: [{ label: "Instagram", url: "" }],
  },
  {
    name: "Yorgo",
    role: "Business partner",
    description: "Creative and commercial partner connected to the academy’s local network and production work.",
    logoUrl: "",
    profileUrl: "",
    links: [{ label: "Instagram", url: "" }],
  },
  {
    name: "badelech",
    role: "Brand partner",
    description: "Lifestyle and brand collaborator supporting creative storytelling and visual culture.",
    logoUrl: "",
    profileUrl: "",
    links: [{ label: "Instagram", url: "" }],
  },
  {
    name: "Business Placeholder",
    role: "Creative partner",
    description: "A partner brand supporting the academy’s production and collaborative network.",
    logoUrl: "",
    profileUrl: "",
    links: [{ label: "Website", url: "" }],
  },
];

const PLATFORM_ICONS: Record<string, string> = {
  ...Object.fromEntries(SOCIAL_LINKS.map((link) => [link.label.toLowerCase(), link.icon])),
  website:
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm7.93 9h-3.02a15.6 15.6 0 0 0-1.2-5.4A8.03 8.03 0 0 1 19.93 11zM12 4.06c.9 1.3 1.6 3.4 1.78 6.94H10.2c.19-3.54.9-5.64 1.8-6.94zM8.29 5.6A15.6 15.6 0 0 0 7.09 11H4.07a8.03 8.03 0 0 1 4.22-5.4zM4.07 13h3.02c.13 2 .55 3.85 1.2 5.4A8.03 8.03 0 0 1 4.07 13zM12 19.94c-.9-1.3-1.6-3.4-1.78-6.94h3.56c-.19 3.54-.9 5.64-1.78 6.94zm3.71-1.54c.65-1.55 1.07-3.4 1.2-5.4h3.02a8.03 8.03 0 0 1-4.22 5.4z",
  twitch:
    "M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0 1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z",
  x: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  linkedin:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452z",
};

const PLATFORM_ALIASES: Record<string, string> = {
  ig: "instagram",
  insta: "instagram",
  yt: "youtube",
  twitter: "x",
};

function platformIcon(label: string) {
  const key = label.toLowerCase().replace(/[^a-z]/g, "");
  const direct = PLATFORM_ALIASES[key] ?? key;
  if (PLATFORM_ICONS[direct]) return PLATFORM_ICONS[direct];
  const match = Object.keys(PLATFORM_ICONS).find((name) => key.includes(name));
  if (!match) return "";
  return PLATFORM_ICONS[PLATFORM_ALIASES[match] ?? match] ?? "";
}

const TONE = {
  light: {
    tile: "bg-white ring-gray-200/80",
    initials: "text-navy/25",
    avatar: "bg-navy/5 ring-gray-200",
    avatarIcon: "text-navy/25",
    chip: "border-gray-200 bg-warm-white text-navy hover:border-gold/50 hover:bg-white hover:text-gold",
  },
  dark: {
    tile: "bg-white ring-white/20",
    initials: "text-navy/30",
    avatar: "bg-white/10 ring-white/15",
    avatarIcon: "text-white/25",
    chip: "border-white/15 bg-white/5 text-white/70 hover:border-gold/50 hover:text-gold",
  },
} as const;

type Tone = keyof typeof TONE;

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
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
  }, [ready]);

  return ref;
}

export function CreatorsAndStreamers() {
  const sectionRef = useReveal<HTMLElement>();
  const myGroupMembers = MY_G_MEMBERS.filter((person) => person.name.trim().length > 0);
  const soloCreators = SOLO_CREATORS.filter((person) => person.name.trim().length > 0);

  return (
    <section id="creators" ref={sectionRef} className="bg-warm-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="reveal-child max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">Collaborations</p>
          <h2 className="text-3xl font-bold leading-snug text-navy sm:text-4xl">Creators &amp; Streamers</h2>
          <p className="mt-4 text-base leading-relaxed text-gray-600">
            Creative talent and social-first personalities connected through the academy’s production work.
          </p>
        </div>

        {myGroupMembers.length > 0 && (
          <div className="reveal-child mt-10 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between border-b border-gray-200 bg-warm-white px-5 py-3 sm:px-6">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">MY G</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-gold">Group members</span>
            </div>

            <div className="flex gap-4 overflow-x-auto px-4 py-5 sm:px-6">
              {myGroupMembers.map((person, index) => (
                <CreatorCard key={`${person.name}-${index}`} person={person} index={index} />
              ))}
            </div>
          </div>
        )}

        {soloCreators.length > 0 && (
          <div className="reveal-child mt-10 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between border-b border-gray-200 bg-warm-white px-5 py-3 sm:px-6">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Featured creators</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-gold">Individual profiles</span>
            </div>

            <div className="flex gap-4 overflow-x-auto px-4 py-5 sm:px-6">
              {soloCreators.map((person, index) => (
                <CreatorCard key={`${person.name}-${index}`} person={person} index={index} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function CreatorCard({ person, index }: { person: CreatorProfile; index: number }) {
  const validLinks = (person.links ?? []).filter((link) => link.url && link.url.trim().length > 0);

  return (
    <article
      className="reveal-child min-w-[250px] flex-1 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:shadow-lg sm:min-w-[260px]"
      style={{ transitionDelay: `${index * 0.06}s` }}
    >
      <div className="flex items-center gap-3">
        <Avatar name={person.name} imageUrl={person.avatarUrl} tone="light" size="lg" />
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-navy">{person.name}</h3>
          <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-gray-400">{person.role}</p>
        </div>
      </div>

      {person.description && (
        <p className="mt-3 text-sm leading-relaxed text-gray-600">{person.description}</p>
      )}

      {validLinks.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {validLinks.map((link) => (
            <a
              key={`${person.name}-${link.label}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${TONE.light.chip}`}
            >
              <PlatformIcon label={link.label} />
              {link.label}
            </a>
          ))}
        </div>
      ) : (
        <div className="mt-4 inline-flex rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
          Profile link coming soon
        </div>
      )}
    </article>
  );
}

export function BusinessCollaborators() {
  const sectionRef = useReveal<HTMLElement>();
  const businesses = BUSINESS_COLLABORATORS.filter((entry) => entry.name.trim().length > 0);

  return (
    <section id="business-colaborators" ref={sectionRef} className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="reveal-child max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">Collaborations</p>
          <h2 className="text-3xl font-bold leading-snug text-navy sm:text-4xl">Business Collaborators</h2>
          <p className="mt-4 text-base leading-relaxed text-gray-600">
            Professional businesses and partners the studio has worked with across creative and production projects.
          </p>
        </div>

        {businesses.length > 0 && (
          <div className="reveal-child mt-10 overflow-hidden rounded-3xl border border-gray-200 bg-warm-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.3)]">
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3 sm:px-6">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Business network</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-gold">Official logo placeholder</span>
            </div>

            <div className="flex gap-4 overflow-x-auto px-4 py-5 sm:px-6">
              {businesses.map((business, index) => (
                <BusinessCard key={`${business.name}-${index}`} business={business} index={index} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function BusinessCard({ business, index }: { business: BusinessCollaborator; index: number }) {
  const validLinks = (business.links ?? []).filter((link) => link.url && link.url.trim().length > 0);

  return (
    <article
      className="reveal-child min-w-[230px] flex-1 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:shadow-lg"
      style={{ transitionDelay: `${index * 0.06}s` }}
    >
      <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-warm-white p-4">
        <BrandMark name={business.name} imageUrl={business.logoUrl} tone="light" size="lg" />
      </div>

      <h3 className="mt-4 text-center text-base font-semibold text-navy">{business.name}</h3>
      <p className="mt-1 text-center text-[10px] uppercase tracking-[0.14em] text-gray-400">{business.role}</p>

      {business.description && (
        <p className="mt-3 text-center text-sm leading-relaxed text-gray-600">{business.description}</p>
      )}

      {validLinks.length > 0 ? (
        <div className="mt-4 flex justify-center gap-2">
          {validLinks.map((link) => (
            <a
              key={`${business.name}-${link.label}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${TONE.light.chip}`}
            >
              <PlatformIcon label={link.label} />
              {link.label}
            </a>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex justify-center">
          <div className="inline-flex rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
            Link coming soon
          </div>
        </div>
      )}
    </article>
  );
}

function PlatformIcon({ label }: { label: string }) {
  const path = platformIcon(label);

  if (!path) {
    return <ExternalLink size={11} className="shrink-0" aria-hidden="true" />;
  }

  return (
    <svg className="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function BrandMark({
  name,
  imageUrl,
  tone,
  size = "md",
}: {
  name: string;
  imageUrl?: string;
  tone: Tone;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "h-20 w-20 sm:h-24 sm:w-24" : "h-16 w-16 sm:h-20 sm:w-20";

  return (
    <span className={`flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-2xl ring-1 ${TONE[tone].tile}`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`${name} logo`}
          width={96}
          height={96}
          className="h-full w-full object-contain p-2.5"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className={`text-lg font-bold ${TONE[tone].initials}`} aria-hidden="true">
          {initials(name)}
        </span>
      )}
    </span>
  );
}

function Avatar({
  name,
  imageUrl,
  tone,
  size,
}: {
  name: string;
  imageUrl?: string;
  tone: Tone;
  size: "md" | "lg";
}) {
  const box = size === "lg" ? "h-20 w-20" : "h-14 w-14";
  const hasName = name.trim().length > 0;

  return (
    <span className={`flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ${TONE[tone].avatar}`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={hasName ? `${name} profile photo` : ""}
          width={80}
          height={80}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <User size={size === "lg" ? 22 : 19} className={TONE[tone].avatarIcon} aria-hidden="true" />
      )}
    </span>
  );
}

function initials(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
  return letters || "–";
}
