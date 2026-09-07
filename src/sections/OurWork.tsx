"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

const YOUTUBE_ICON =
  "M23.498 6.186a3.016 3.016 0 0 0-4.242-1.506A3.016 3.016 0 0 0 15.75 6.186a3.016 3.016 0 0 0-4.242 1.506 3.016 3.016 0 0 0 1.506 4.242 3.016 3.016 0 0 0 4.242 1.506 3.016 3.016 0 0 0 1.506-4.242 3.016 3.016 0 0 0-1.506-4.242zM9.75 14.25a2.25 2.25 0 0 0 0 4.5 2.25 2.25 0 0 0 0-4.5zM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z";
const TIKTOK_ICON =
  "M22.25 12c0-1.43-.88-2.75-2.19-3.37.46-1.33.2-2.82-.83-3.95s-2.53-1.34-3.88-.82c-1.45.5-3.09.83-4.7 1-.26 2.18.27 4.33 1.3 6.07-.47 1.42-1.31 2.78-2.37 3.93-.07.07-.15.13-.22.2-.21.19-.44.36-.68.49-.07.04-.15.07-.22.1-.41.14-.88.18-1.31.14-.37-.03-.74-.1-.98-.35-.25-.26-.4-.65-.4-1.09 0-.4.12-.79.36-1.14.06-.1.12-.21.16-.31.04-.1.06-.21.06-.32 0-1.43.88-2.75 2.19-3.37-.46-1.33-.2-2.82.83-3.95s2.53-1.34 3.88-.82c1.45.5 3.09.83 4.7 1 .26 2.18-.27 4.33-1.3 6.07.47 1.42 1.31 2.78 2.37 3.93.07.07.15.13.22.2.21.19.44.36.68.49.07.04.15.07.22.1.41.14.88.18 1.31.14.37-.03.74-.1.98-.35.25-.26.4-.65.4-1.09 0-.4-.12-.79-.36-1.14-.06-.1-.12-.21-.16-.31-.04-.1-.06-.21-.06-.32zM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z";

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
            A curated split of long-form and short-form work. Each project is a full cut, not a highlight
            reel. Thumbnails only; the player loads on demand.
          </p>
        </div>

        {/* Long-form */}
        <div className="mt-12">
          <SectionLabel
            title="Long-form editing"
            subtitle="YouTube · 3 to 12 minute cuts built around story, pacing, and retention."
            color="navy"
          />
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
            {LONG_FORM_PROJECTS.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={index}
                total={LONG_FORM_PROJECTS.length}
              />
            ))}
          </div>
        </div>

        {/* Short-form */}
        <div className="mt-14">
          <SectionLabel
            title="Short-form editing"
            subtitle="TikTok · Under-60-second edits engineered for hooks, captions, and watch time."
            color="gold"
          />
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {SHORT_FORM_PROJECTS.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={index}
                total={SHORT_FORM_PROJECTS.length}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionLabel({ title, subtitle, color }: { title: string; subtitle: string; color: "navy" | "gold" }) {
  return (
    <div className="mb-2 flex items-center gap-3">
      <span className="inline-flex h-1.5 w-16 overflow-hidden rounded-full">
        <span
          className="h-full w-full"
          style={color === "navy" ? { backgroundColor: "var(--color-navy)" } : { backgroundColor: "var(--color-gold)" }}
        />
      </span>
      <h3 className="text-xl font-semibold tracking-tight text-navy">{title}</h3>
    </div>
  );
}

interface PortfolioProject {
  id: string;
  title: string;
  platform: "YouTube" | "TikTok";
  description: string;
  skills: string[];
  thumbnailUrl: string;
  videoUrl?: string;
  youtubeId?: string;
  linkUrl: string;
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

const SHORT_FORM_PROJECTS: PortfolioProject[] = [
  {
    id: "sf-1",
    title: "3-Second Hook Test",
    platform: "TikTok",
    description:
      "A short-form edit where the first three seconds are the whole point: visual hit, text hook, and motion that keeps the thumb from scrolling.",
    skills: ["Hooks", "Captions", "Pacing", "Audience Retention"],
    thumbnailUrl: "/assets/portfolio/sf-1.jpg",
    videoUrl: "/assets/portfolio/sf-1.mp4",
    linkUrl: "https://www.tiktok.com/@handle/video/EXAMPLE1",
  },
  {
    id: "sf-2",
    title: "Caption-Led Edit",
    platform: "TikTok",
    description:
      "A clip edited around on-screen captions, timing the text to speech beats instead of treating captions as an afterthought.",
    skills: ["Captions", "Pacing", "Sound Design", "Hooks"],
    thumbnailUrl: "/assets/portfolio/sf-2.jpg",
    videoUrl: "/assets/portfolio/sf-2.mp4",
    linkUrl: "https://www.tiktok.com/@handle/video/EXAMPLE2",
  },
];

function ProjectCard({ project, index, total }: { project: PortfolioProject; index: number; total: number }) {
  const [mounted, setMounted] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePlayClick = () => {
    setShowPlayer(true);
  };

  const handleLoadedData = () => {
    videoRef.current?.play().catch(() => {});
  };

  const handleVideoEnd = () => {
    setShowPlayer(false);
  };

  const skillTags = project.skills.slice(0, 4);

  const delay = `${(index % total) * 0.07}s`;

  if (!mounted) {
    return (
      <article
        className="group relative overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
        style={{ transitionDelay: delay }}
      >
        <ProjectThumbnail project={project} onPlayClick={handlePlayClick} />
        <div className="px-6 pb-6 pt-5">
          <ProjectMeta project={project} skillTags={skillTags} showLink />
        </div>
      </article>
    );
  }

  if (showPlayer) {
    return (
      <article
        className="group relative overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
        style={{ transitionDelay: delay }}
      >
        <div className="relative aspect-video overflow-hidden bg-navy rounded-t-2xl">
          {project.youtubeId ? (
            <iframe
              src={`https://www.youtube.com/embed/${project.youtubeId}?autoplay=1&rel=0`}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={`${project.title} video player`}
            />
          ) : (
            <video
              ref={videoRef}
              src={project.videoUrl}
              className="h-full w-full object-cover"
              onLoadedData={handleLoadedData}
              onEnded={handleVideoEnd}
              playsInline
              preload="auto"
              aria-label={`${project.title} video player`}
            />
          )}
          <button
            onClick={() => setShowPlayer(false)}
            className="absolute right-3 top-3 inline-flex h-9 items-center gap-2 rounded-full border border-white/20 bg-navy/70 px-3 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-navy/90 focus:outline-none"
            aria-label="Close video"
          >
            Close
          </button>
        </div>
        <div className="px-6 pb-6 pt-5">
          <ProjectMeta project={project} skillTags={skillTags} showLink />
        </div>
      </article>
    );
  }

  return (
    <article
      className="group relative overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
      style={{ transitionDelay: delay }}
    >
      <ProjectThumbnail project={project} onPlayClick={handlePlayClick} />
      <div className="px-6 pb-6 pt-5">
        <ProjectMeta project={project} skillTags={skillTags} showLink />
      </div>
    </article>
  );
}

function ProjectThumbnail({ project, onPlayClick }: { project: PortfolioProject; onPlayClick: () => void }) {
  const isYouTube = project.platform === "YouTube";
  const platformColor = isYouTube ? "bg-red-600" : "bg-green-700";

  return (
    <div className="relative aspect-video overflow-hidden bg-navy rounded-t-2xl">
      <img
        src={project.thumbnailUrl}
        alt={`${project.title} thumbnail`}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
        decoding="async"
      />

      {/* Subtle center affordance, not a huge button */}
      <div className="absolute inset-0 flex items-center justify-center bg-navy/20 transition-colors duration-300 group-hover:bg-navy/30">
        <button
          onClick={onPlayClick}
          className="pointer-events-auto flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-white/95 text-navy shadow-lg transition-transform duration-300 group-hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          aria-label={`Play ${project.title}`}
        >
          <Play size={20} className="ml-0.5 fill-navy" />
        </button>
      </div>

      {/* Platform pill */}
      <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-navy shadow-sm backdrop-blur-sm">
        <span className={`inline-flex h-2 w-2 rounded-full ${platformColor}`} aria-hidden="true" />
        <svg
          className="shrink-0 h-[11px] w-[11px] text-navy"
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d={isYouTube ? YOUTUBE_ICON : TIKTOK_ICON} />
        </svg>
        <span className="ml-1 text-[11px] tracking-wide uppercase">{project.platform}</span>
      </div>

      {/* Quick skill chips along the bottom */}
      <div className="absolute bottom-0 left-0 right-0 overflow-hidden bg-gradient-to-t from-navy/80 via-navy/20 to-transparent p-3">
        <div className="flex flex-wrap gap-1.5">
          {project.skills.slice(0, 3).map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-sm"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ProjectMetaProps {
  project: PortfolioProject;
  skillTags: string[];
  showLink: boolean;
}

function ProjectMeta({ project, skillTags, showLink }: ProjectMetaProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-lg font-semibold leading-snug text-navy">{project.title}</h4>
      </div>
      <p className="text-sm leading-relaxed text-gray-600">{project.description}</p>

      <div className="flex flex-wrap gap-1.5">
        {skillTags.map((skill) => (
          <span
            key={skill}
            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700"
          >
            {skill}
          </span>
        ))}
        {project.skills.length > 4 && (
          <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-500">
            +{project.skills.length - 4}
          </span>
        )}
      </div>

      {showLink && (
        <a
          href={project.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gold transition-colors hover:text-gold-hover"
        >
          View on {project.platform}
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M13.72 13.42a1.43 1.43 0 0 1-1.84 0l-5.8-5.8a1.43 1.43 0 0 1 0-2.04l5.8-5.8a1.43 1.43 0 0 1 2.04 2.04L7.08 8.72a1.43 1.43 0 0 1 0 2.04l5.8 5.8a1.43 1.43 0 0 1-1.84 1.84l-2.46-2.46a1.43 1.43 0 0 1 0-2.04l2.46-2.46a1.43 1.43 0 0 1 2.04 0l5.8 5.8a1.43 1.43 0 0 1 0 2.04l-5.8 5.8a1.43 1.43 0 0 1-1.84-1.84l2.46-2.46a1.43 1.43 0 0 1 0-2.04z" />
          </svg>
        </a>
      )}
    </div>
  );
}
