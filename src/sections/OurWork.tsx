"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Play } from "lucide-react";

const YOUTUBE_ICON = "M23.498 6.186a3.016 3.016 0 0 0-4.242-1.506A3.016 3.016 0 0 0 15.75 6.186a3.016 3.016 0 0 0-4.242 1.506 3.016 3.016 0 0 0 1.506 4.242 3.016 3.016 0 0 0 4.242 1.506 3.016 3.016 0 0 0 1.506-4.242 3.016 3.016 0 0 0-1.506-4.242zM9.75 14.25a2.25 2.25 0 0 0 0 4.5 2.25 2.25 0 0 0 0-4.5zM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z";

export default function SelectedWork() {
  const headingRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Heading scroll reveal
  useEffect(() => {
    const el = headingRef.current;
    if (!el || !mounted) return;
    el.classList.add("reveal");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { el.classList.add("visible"); observer.unobserve(el); }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted]);

  return (
    <section id="our-work" className="bg-warm-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div ref={headingRef} className="max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">Selected Work</p>
          <h2 className="hero-title text-3xl font-bold leading-snug text-navy sm:text-4xl">
            Editing, by format.
          </h2>
          <p className="mt-4 hero-desc text-base leading-relaxed text-gray-600">
            A curated split of long-form and short-form work — each project is a full cut, not a highlight reel. Thumbnails only; the player loads on demand.
          </p>
        </div>

        <div className="mt-6 grid gap-12 sm:grid-cols-2">
          <PortfolioCategory
            title="Long-form editing"
            subtitle="YouTube · 3 to 12 minute cuts built around story, pacing, and retention."
            color="navy"
            projects={LONG_FORM_PROJECTS}
          />
          <PortfolioCategory
            title="Short-form editing"
            subtitle="TikTok · Under-60-second edits engineered for hooks, captions, and watch time."
            color="gold"
            projects={SHORT_FORM_PROJECTS}
          />
        </div>
      </div>
    </section>
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
  linkUrl: string;
}

const LONG_FORM_PROJECTS: PortfolioProject[] = [
  {
    id: "lf-1",
    title: "The Edit That Held Attention",
    platform: "YouTube",
    description: "A documentary-style piece that uses pacing and sound design to keep viewers on the story rather than the spectacle.",
    skills: ["Storytelling", "Pacing", "Sound Design", "Colour Grading", "Audience Retention"],
    thumbnailUrl: "/assets/portfolio/lf-1.jpg",
    videoUrl: "/assets/portfolio/lf-1.mp4",
    linkUrl: "https://www.youtube.com/watch?v=EXAMPLE1",
  },
  {
    id: "lf-2",
    title: "Cinematic Breakdown",
    platform: "YouTube",
    description: "A colour-graded breakdown reel that moves from flat footage to a filmic image without losing the subject.",
    skills: ["Colour Grading", "Transitions", "Pacing", "Storytelling"],
    thumbnailUrl: "/assets/portfolio/lf-2.jpg",
    videoUrl: "/assets/portfolio/lf-2.mp4",
    linkUrl: "https://www.youtube.com/watch?v=EXAMPLE2",
  },
  {
    id: "lf-3",
    title: "Feature-Length Trailer Cut",
    platform: "YouTube",
    description: "A trailer cut assembled from scratch: rhythm, music hits, and a climax built to retain viewers to the end.",
    skills: ["Storytelling", "Pacing", "Transitions", "Hooks", "Audience Retention"],
    thumbnailUrl: "/assets/portfolio/lf-3.jpg",
    videoUrl: "/assets/portfolio/lf-3.mp4",
    linkUrl: "https://www.youtube.com/watch?v=EXAMPLE3",
  },
  {
    id: "lf-4",
    title: "Brand Documentaries",
    platform: "YouTube",
    description: "A longer-form brand piece that edits interview and b-roll into a coherent narrative rather than a montage.",
    skills: ["Storytelling", "Captions", "Sound Design", "Pacing", "Colour Grading"],
    thumbnailUrl: "/assets/portfolio/lf-4.jpg",
    videoUrl: "/assets/portfolio/lf-4.mp4",
    linkUrl: "https://www.youtube.com/watch?v=EXAMPLE4",
  },
];

const SHORT_FORM_PROJECTS: PortfolioProject[] = [
  {
    id: "sf-1",
    title: "3-Second Hook Test",
    platform: "TikTok",
    description: "A short-form edit where the first three seconds are the whole point — visual hit, text hook, and motion that keeps the thumb from scrolling.",
    skills: ["Hooks", "Captions", "Pacing", "Audience Retention"],
    thumbnailUrl: "/assets/portfolio/sf-1.jpg",
    videoUrl: "/assets/portfolio/sf-1.mp4",
    linkUrl: "https://www.tiktok.com/@handle/video/EXAMPLE1",
  },
  {
    id: "sf-2",
    title: "Caption-Led Edit",
    platform: "TikTok",
    description: "A clip edited around on-screen captions — timing the text to speech beats instead of treating captions as an afterthought.",
    skills: ["Captions", "Pacing", "Sound Design", "Hooks"],
    thumbnailUrl: "/assets/portfolio/sf-2.jpg",
    videoUrl: "/assets/portfolio/sf-2.mp4",
    linkUrl: "https://www.tiktok.com/@handle/video/EXAMPLE2",
  },
  {
    id: "sf-3",
    title: "Rhythm-Driven Montage",
    platform: "TikTok",
    description: "A fast montage cut to the beat, where every cut and transition earns its place instead of stacking effects for their own sake.",
    skills: ["Pacing", "Transitions", "Sound Design", "Hooks"],
    thumbnailUrl: "/assets/portfolio/sf-3.jpg",
    videoUrl: "/assets/portfolio/sf-3.mp4",
    linkUrl: "https://www.tiktok.com/@handle/video/EXAMPLE3",
  },
  {
    id: "sf-4",
    title: "Story in Under a Minute",
    platform: "TikTok",
    description: "A tightly structured short that still tells a beginning-middle-end story, not just a sequence of funny moments.",
    skills: ["Storytelling", "Hooks", "Captions", "Pacing", "Audience Retention"],
    thumbnailUrl: "/assets/portfolio/sf-4.jpg",
    videoUrl: "/assets/portfolio/sf-4.mp4",
    linkUrl: "https://www.tiktok.com/@handle/video/EXAMPLE4",
  },
];

interface PortfolioCategoryProps {
  title: string;
  subtitle: string;
  color: "navy" | "gold";
  projects: PortfolioProject[];
}

function PortfolioCategory({ title, subtitle, color, projects }: PortfolioCategoryProps) {
  const categoryRef: RefObject<HTMLDivElement | null> = { current: null };
  const cardsRef: RefObject<HTMLDivElement | null> = { current: null };
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const el = categoryRef.current;
    if (!el || !mounted) return;
    el.classList.add("reveal");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { el.classList.add("visible"); observer.unobserve(el); }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const container = cardsRef.current;
    if (!container) return;
    const list = Array.from(container.children) as HTMLElement[];
    list.forEach((card, i) => {
      card.classList.add("reveal-child");
      card.style.transitionDelay = `${i * 0.1}s`;
    });
    container.classList.add("stagger-children");
    container.classList.add("reveal");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { container.classList.add("visible"); observer.unobserve(container); }
      },
      { threshold: 0.1 }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [mounted]);

  return (
    <div ref={categoryRef} className="reveal">
      <div className="mb-2 flex items-center gap-3">
        <span className="inline-flex h-1.5 w-16 overflow-hidden rounded-full">
          <span
            className="h-full w-full"
            style={color === "navy" ? { backgroundColor: "var(--color-navy)" } : { backgroundColor: "var(--color-gold)" }}
          />
        </span>
        <h3 className="text-xl font-semibold tracking-tight text-navy">{title}</h3>
      </div>
      <p className="mb-8 text-sm leading-relaxed text-gray-500">{subtitle}</p>

      <div ref={cardsRef} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: PortfolioProject }) {
  const [mounted, setMounted] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const posterRef = useRef<HTMLImageElement | null>(null);

  // Avoid hydration mismatch: render the poster first on the server/mount.
  useEffect(() => { setMounted(true); }, []);

  const handlePlayClick = () => {
    setShowPlayer(true);
  };

  const handleLoadedData = () => {
    videoRef.current?.play().catch(() => {});
  };

  const handleVideoEnd = () => {
    // Return to the poster when the clip ends so the card is reusable.
    setShowPlayer(false);
  };

  const skillTags = project.skills.slice(0, 4);

  // Server-rendered shell: poster card only. No video element is sent until the
  // user opens the project, so the section paints fast and pays no media cost
  // for the 8 thumbnails.
  if (!mounted) {
    return (
      <article className="group relative overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
        <ProjectThumbnail
          project={project}
          onPlayClick={handlePlayClick}
          posterRef={posterRef}
        />
        <div className="px-5 pb-5 pt-5">
          <ProjectMeta project={project} skillTags={skillTags} showLink />
        </div>
      </article>
    );
  }

  if (showPlayer) {
    return (
      <article className="group relative overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
        <div className="relative aspect-video overflow-hidden bg-navy">
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
          <button
            onClick={() => setShowPlayer(false)}
            className="absolute right-3 top-3 inline-flex h-9 items-center gap-2 rounded-full border border-white/20 bg-navy/70 px-3 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-navy/90 focus:outline-none"
            aria-label="Close video"
          >
            Close
          </button>
        </div>
        <div className="px-5 pb-5 pt-5">
          <ProjectMeta project={project} skillTags={skillTags} showLink />
        </div>
      </article>
    );
  }

  // Default: poster card with play affordance.
  return (
    <article className="group relative overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <ProjectThumbnail
        project={project}
        onPlayClick={handlePlayClick}
        posterRef={posterRef}
      />
      <div className="px-5 pb-5 pt-5">
        <ProjectMeta project={project} skillTags={skillTags} showLink />
      </div>
    </article>
  );
}

interface ProjectThumbnailProps {
  project: PortfolioProject;
  onPlayClick: () => void;
  posterRef: React.RefObject<HTMLImageElement | null>;
}

function ProjectThumbnail({ project, onPlayClick, posterRef }: ProjectThumbnailProps) {
  const isYouTube = project.platform === "YouTube";
  const platformColor = isYouTube ? "bg-red-600" : "bg-green-700";

  return (
    <div className="relative aspect-video overflow-hidden bg-navy">
      <img
        ref={posterRef}
        src={project.thumbnailUrl}
        alt={`${project.title} thumbnail`}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
        decoding="async"
      />

      {/* Soft tint + play affordance on hover */}
      <div className="absolute inset-0 flex items-center justify-center bg-navy/20 transition-colors duration-300 group-hover:bg-navy/30">
        <button
          onClick={onPlayClick}
          className="pointer-events-auto flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-white/95 text-navy shadow-lg transition-transform duration-300 group-hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          aria-label={`Play ${project.title}`}
        >
          <Play size={22} className="ml-0.5 fill-navy" />
        </button>
      </div>

      {/* Platform badge */}
      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-navy shadow-sm backdrop-blur-sm">
        <span className={`inline-flex h-2 w-2 rounded-full ${platformColor}`} aria-hidden="true" />
        <svg
          className="shrink-0 h-[11px] w-[11px] text-navy"
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d={isYouTube ? YOUTUBE_ICON : "M22.25 12c0-1.43-.88-2.75-2.19-3.37.46-1.33.2-2.82-.83-3.95s-2.53-1.34-3.88-.82c-1.45.5-3.09.83-4.7 1 -.26 2.18.27 4.33 1.3 6.07-.47 1.42-1.31 2.78-2.37 3.93-.07.07-.15.13-.22.2-.21.19-.44.36-.68.49-.07.04-.15.07-.22.1-.41.14-.88.18-1.31.14-.37-.03-.74-.1-.98-.35-.25-.26-.4-.65-.4-1.09 0-.4.12-.79.36-1.14.06-.1.12-.21.16-.31.04-.1.06-.21.06-.32 0-1.43.88-2.75 2.19-3.37-.46-1.33-.2-2.82.83-3.95s2.53-1.34 3.88-.82c1.45.5 3.09.83 4.7 1 .26 2.18-.27 4.33-1.3 6.07.47 1.42 1.31 2.78 2.37 3.93.07.07.15.13.22.2.21.19.44.36.68.49.07.04.15.07.22.1.41.14.88.18 1.31.14.37-.03.74-.1.98-.35.25-.26.4-.65.4-1.09 0-.4-.12-.79-.36-1.14-.06-.1-.12-.21-.16-.31-.04-.1-.06-.21-.06-.32zM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"} />
        </svg>
        <span className="ml-1 text-[11px] tracking-wide uppercase">{project.platform}</span>
      </div>

      {/* Skills ribbon for quick scanning */}
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
    <div className="space-y-3">
      <div>
        <h4 className="text-lg font-semibold leading-snug text-navy">{project.title}</h4>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{project.description}</p>
      </div>

      {/* Skills used */}
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

      {/* Original link */}
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

