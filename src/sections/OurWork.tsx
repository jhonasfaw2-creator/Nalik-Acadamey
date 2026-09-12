"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

const YOUTUBE_ICON =
  "M23.498 6.186a3.016 3.016 0 0 0-4.242-1.506A3.016 3.016 0 0 0 15.75 6.186a3.016 3.016 0 0 0-4.242 1.506 3.016 3.016 0 0 0 1.506 4.242 3.016 3.016 0 0 0 4.242 1.506 3.016 3.016 0 0 0 1.506-4.242 3.016 3.016 0 0 0-1.506-4.242zM9.75 14.25a2.25 2.25 0 0 0 0 4.5 2.25 2.25 0 0 0 0-4.5zM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z";

const ARROW_ICON =
  "M13.72 13.42a1.43 1.43 0 0 1-1.84 0l-5.8-5.8a1.43 1.43 0 0 1 0-2.04l5.8-5.8a1.43 1.43 0 0 1 2.04 2.04L7.08 8.72a1.43 1.43 0 0 1 0 2.04l5.8 5.8a1.43 1.43 0 0 1-1.84 1.84l-2.46-2.46a1.43 1.43 0 0 1 0-2.04l2.46-2.46a1.43 1.43 0 0 1 2.04 0l5.8 5.8a1.43 1.43 0 0 1 0 2.04l-5.8 5.8a1.43 1.43 0 0 1-1.84-1.84l2.46-2.46a1.43 1.43 0 0 1 0-2.04z";

interface PortfolioProject {
  id: string;
  title: string;
  platform: "YouTube" | "Reel";
  description?: string;
  skills?: string[];
  thumbnailUrl: string;
  videoUrl?: string;
  youtubeId?: string;
  linkUrl?: string;
}

const LONG_FORM_PROJECTS: PortfolioProject[] = [
  {
    id: "lf-1",
    title: "በ 17 አመቴ የራሴን ብራንድ መሰረትኩ 🤩 / Clothing Brand",
    platform: "YouTube",
    description:
      "A founder-story vlog following a 17-year-old launching his own clothing brand: interview beats, b-roll, and music cuts timed to carry the story from first idea to first drop.",
    skills: ["Storytelling", "Pacing", "Sound Design", "Colour Grading"],
    thumbnailUrl: "https://i.ytimg.com/vi/sncn1ALnzW8/hqdefault.jpg",
    youtubeId: "sncn1ALnzW8",
    linkUrl: "https://youtu.be/sncn1ALnzW8",
  },
  {
    id: "lf-2",
    title: "48 Hours in Arba Minch 🐊",
    platform: "YouTube",
    description:
      "A 48-hour travel vlog from Arba Minch, with fast location cuts, music-synced transitions, and pacing that turns raw trip footage into a story viewers finish to the end.",
    skills: ["Storytelling", "Transitions", "Music Sync", "Pacing"],
    thumbnailUrl: "https://i.ytimg.com/vi/5LEJMiHsOAs/hqdefault.jpg",
    youtubeId: "5LEJMiHsOAs",
    linkUrl: "https://youtu.be/5LEJMiHsOAs",
  },
  {
    id: "lf-3",
    title: "ልብስ ሸመታ ከጀማው ጋር ft. Nahom Astu",
    platform: "YouTube",
    description:
      "A community give-back edit with Nahom Astu: multi-cam interview and street footage cut around the moment clothes change hands, with captions and sound design carrying the emotion.",
    skills: ["Multi-cam", "Captions", "Sound Design", "Storytelling"],
    thumbnailUrl: "https://i.ytimg.com/vi/OJpFNPgr06Q/hqdefault.jpg",
    youtubeId: "OJpFNPgr06Q",
    linkUrl: "https://youtu.be/OJpFNPgr06Q",
  },
];

export default function SelectedWork() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !mounted) return;
    el.classList.add("reveal");
    el.classList.add("stagger-children");
    const heading = headingRef.current;
    if (heading) {
      heading.classList.add("reveal-child");
      heading.style.transitionDelay = "0s";
    }
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
      id="our-work"
      ref={sectionRef}
      className="relative overflow-hidden bg-warm-white px-4 py-20 sm:px-6 lg:px-8"
    >
      {/* Quiet background accent for a more editorial feel */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 h-72 bg-gradient-to-b from-navy/5 via-transparent to-transparent"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl">
        <div ref={headingRef} className="max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">
            Selected Work
          </p>
          <h2 className="hero-title text-3xl font-bold leading-snug text-navy sm:text-4xl">
            Editing, by format.
          </h2>
          <p className="mt-4 hero-desc text-base leading-relaxed text-gray-600">
            A curated selection of long-form work. Each piece is a full cut, not a highlight
            reel. Thumbnails only; the player loads on demand.
          </p>
        </div>

        {/* Featured: first cut leads, two more follow — an editorial 3-piece composition */}
        <div className="mt-12">
          <SectionLabel
            title="Long-form editing"
            subtitle="YouTube · Story, pacing, and retention."
            color="navy"
          />
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <WorkCard
              project={LONG_FORM_PROJECTS[0]}
              index={0}
              total={LONG_FORM_PROJECTS.length}
              featured
              className="lg:col-span-2"
            />
            <div className="flex flex-col gap-6">
              {LONG_FORM_PROJECTS.slice(1).map((project, i) => (
                <WorkCard
                  key={project.id}
                  project={project}
                  index={i + 1}
                  total={LONG_FORM_PROJECTS.length}
                />
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

function SectionLabel({
  title,
  subtitle,
  color,
}: {
  title: string;
  subtitle: string;
  color: "navy" | "gold";
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-1.5 w-16 overflow-hidden rounded-full">
          <span
            className="h-full w-full"
            style={
              color === "navy"
                ? { backgroundColor: "var(--color-navy)" }
                : { backgroundColor: "var(--color-gold)" }
            }
          />
        </span>
        <h3 className="text-xl font-semibold tracking-tight text-navy sm:text-2xl">{title}</h3>
      </div>
      {subtitle && <p className="text-sm text-gray-500 sm:text-right">{subtitle}</p>}
    </div>
  );
}

function WorkCard({
  project,
  index,
  total,
  featured = false,
  className = "",
}: {
  project: PortfolioProject;
  index: number;
  total: number;
  featured?: boolean;
  className?: string;
}) {
  const [showPlayer, setShowPlayer] = useState(false);
  const delay = `${(index % total) * 0.08}s`;

  return (
    <article
      className={`group reveal-child relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${className}`}
      style={{ transitionDelay: delay }}
    >
      <div className="relative aspect-video overflow-hidden bg-navy">
        {showPlayer ? (
          <VideoPlayer project={project} onClose={() => setShowPlayer(false)} />
        ) : (
          <VideoThumb
            project={project}
            onPlay={() => setShowPlayer(true)}
            featured={featured}
          />
        )}
      </div>
      <WorkMeta project={project} index={index} total={total} featured={featured} />
    </article>
  );
}

function VideoThumb({
  project,
  onPlay,
  featured,
}: {
  project: PortfolioProject;
  onPlay: () => void;
  featured: boolean;
}) {
  const isYouTube = project.platform === "YouTube";
  const playSize = featured ? "h-14 w-14" : "h-12 w-12";
  const iconSize = featured ? 22 : 18;

  return (
    <>
      <img
        src={project.thumbnailUrl}
        alt={`${project.title} thumbnail`}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
        decoding="async"
      />

      {/* Quiet center affordance, not a huge button */}
      <div className="absolute inset-0 flex items-center justify-center bg-navy/20 transition-colors duration-300 group-hover:bg-navy/30">
        <button
          onClick={onPlay}
          className={`pointer-events-auto flex cursor-pointer items-center justify-center rounded-full bg-white/95 text-navy shadow-lg ring-1 ring-white/40 backdrop-blur-sm transition-all duration-300 group-hover:scale-110 group-hover:ring-gold/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${playSize}`}
          aria-label={`Play ${project.title}`}
        >
          <Play size={iconSize} className="ml-0.5 fill-navy" />
        </button>
      </div>

      {/* Platform pill */}
      <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-navy shadow-sm backdrop-blur-sm">
        <span
          className={`inline-flex h-2 w-2 rounded-full ${isYouTube ? "bg-red-600" : "bg-gold"}`}
          aria-hidden="true"
        />
        {isYouTube && (
          <svg
            className="h-[11px] w-[11px] shrink-0 text-navy"
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d={YOUTUBE_ICON} />
          </svg>
        )}
        <span className="text-[11px] uppercase tracking-wide">{project.platform}</span>
      </div>
    </>
  );
}

function VideoPlayer({
  project,
  onClose,
}: {
  project: PortfolioProject;
  onClose: () => void;
}) {
  return (
    <>
      {project.youtubeId ? (
        <iframe
          src={`https://www.youtube.com/embed/${project.youtubeId}?autoplay=1&rel=0`}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={`${project.title} video player`}
        />
      ) : (
        <video
          src={project.videoUrl}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          playsInline
          onEnded={onClose}
          aria-label={`${project.title} video player`}
        />
      )}
      <button
        onClick={onClose}
        className="absolute right-3 top-3 inline-flex h-9 items-center gap-2 rounded-full border border-white/20 bg-navy/70 px-3 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-navy/90 focus:outline-none"
        aria-label="Close video"
      >
        Close
      </button>
    </>
  );
}

function WorkMeta({
  project,
  index,
  total,
  featured,
}: {
  project: PortfolioProject;
  index: number;
  total: number;
  featured: boolean;
}) {
  if (featured) {
    return (
      <div className="flex flex-1 flex-col px-6 pb-6 pt-5 sm:px-7 sm:pb-7 sm:pt-6">
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="text-xl font-bold leading-snug text-navy sm:text-2xl">
            {project.title}
          </h4>
          <span className="shrink-0 text-xs font-medium tracking-wide text-gray-400 tabular-nums">
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>

        <p className="mt-2.5 text-sm leading-relaxed text-gray-600 sm:text-[15px]">
          {project.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {(project.skills ?? []).slice(0, 4).map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700"
            >
              {skill}
            </span>
          ))}
        </div>

        <div className="mt-auto pt-5">
          <ProjectLink project={project} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-base font-semibold leading-snug text-navy">{project.title}</h4>
        <span className="shrink-0 text-[11px] font-medium tracking-wide text-gray-400 tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      {project.description && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-gray-600 line-clamp-2">
          {project.description}
        </p>
      )}
      {project.linkUrl && (
        <div className="mt-auto pt-3">
          <ProjectLink project={project} />
        </div>
      )}
    </div>
  );
}

function ProjectLink({ project }: { project: PortfolioProject }) {
  if (!project.linkUrl) return null;
  return (
    <a
      href={project.linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-gold transition-colors hover:text-gold-hover"
    >
      {project.platform === "YouTube" ? "Watch on YouTube" : "Watch video"}
      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d={ARROW_ICON} />
      </svg>
    </a>
  );
}