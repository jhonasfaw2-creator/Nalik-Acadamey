"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

const ARROW_ICON =
  "M13.72 13.42a1.43 1.43 0 0 1-1.84 0l-5.8-5.8a1.43 1.43 0 0 1 0-2.04l5.8-5.8a1.43 1.43 0 0 1 2.04 2.04L7.08 8.72a1.43 1.43 0 0 1 0 2.04l5.8 5.8a1.43 1.43 0 0 1-1.84 1.84l-2.46-2.46a1.43 1.43 0 0 1 0-2.04l2.46-2.46a1.43 1.43 0 0 1 2.04 0l5.8 5.8a1.43 1.43 0 0 1 0 2.04l-5.8 5.8a1.43 1.43 0 0 1-1.84-1.84l2.46-2.46a1.43 1.43 0 0 1 0-2.04z";

interface PortfolioProject {
  id: string;
  title: string;
  platform: "YouTube" | "Reel";
  description?: string;
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
      "A founder story following a 17-year-old from the first idea to the launch of his clothing brand.",
    thumbnailUrl: "https://i.ytimg.com/vi/sncn1ALnzW8/hqdefault.jpg",
    youtubeId: "sncn1ALnzW8",
    linkUrl: "https://youtu.be/sncn1ALnzW8",
  },
  {
    id: "lf-2",
    title: "48 Hours in Arba Minch 🐊",
    platform: "YouTube",
    description:
      "A two-day trip through Arba Minch, shaped into a fast-moving travel story.",
    thumbnailUrl: "https://i.ytimg.com/vi/5LEJMiHsOAs/hqdefault.jpg",
    youtubeId: "5LEJMiHsOAs",
    linkUrl: "https://youtu.be/5LEJMiHsOAs",
  },
  {
    id: "lf-3",
    title: "ልብስ ሸመታ ከጀማው ጋር ft. Nahom Astu",
    platform: "YouTube",
    description:
      "A community give-back with Nahom Astu, captured through interviews and street footage.",
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
      <div className="mx-auto max-w-7xl">
        <div ref={headingRef} className="max-w-2xl">
          <p className="mb-3 text-sm font-medium text-gold">
            Selected Work
          </p>
          <h2 className="hero-title text-3xl font-bold leading-snug text-navy sm:text-4xl">
            Selected video projects
          </h2>
          <p className="mt-4 hero-desc text-base leading-relaxed text-gray-600">
            A few stories brought to life through editing. Select a video to watch.
          </p>
        </div>

        {/* Equal project cards keep the portfolio easy to scan. */}
        <div className="mt-12">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {LONG_FORM_PROJECTS.map((project) => (
              <WorkCard key={project.id} project={project} />
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

function WorkCard({
  project,
  className = "",
}: {
  project: PortfolioProject;
  className?: string;
}) {
  const [showPlayer, setShowPlayer] = useState(false);
  return (
    <article
      className={`group reveal-child relative flex flex-col overflow-hidden rounded-lg bg-white transition-colors duration-300 ${className}`}
    >
      <div className="relative aspect-video overflow-hidden bg-navy">
        {showPlayer ? (
          <VideoPlayer project={project} onClose={() => setShowPlayer(false)} />
        ) : (
          <VideoThumb
            project={project}
            onPlay={() => setShowPlayer(true)}
          />
        )}
      </div>
      <WorkMeta project={project} />
    </article>
  );
}

function VideoThumb({
  project,
  onPlay,
}: {
  project: PortfolioProject;
  onPlay: () => void;
}) {
  const playSize = "h-12 w-12";
  const iconSize = 18;

  return (
    <>
      <img
        src={project.thumbnailUrl}
        alt={`${project.title} thumbnail`}
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
        decoding="async"
      />

      {/* Quiet center affordance, not a huge button */}
      <div className="absolute inset-0 flex items-center justify-center bg-navy/20 transition-colors duration-300 group-hover:bg-navy/30">
        <button
          onClick={onPlay}
          className={`pointer-events-auto flex cursor-pointer items-center justify-center rounded-full bg-white text-navy ring-1 ring-white/40 transition-colors duration-300 group-hover:ring-gold/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${playSize}`}
          aria-label={`Play ${project.title}`}
        >
          <Play size={iconSize} className="ml-0.5 fill-navy" />
        </button>
      </div>

      <span className="absolute left-4 top-4 text-xs font-medium text-white drop-shadow">{project.platform}</span>
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
        className="absolute right-3 top-3 inline-flex h-9 items-center gap-2 rounded-full border border-white/20 bg-navy/80 px-3 text-xs font-medium text-white transition-colors hover:bg-navy focus:outline-none"
        aria-label="Close video"
      >
        Close
      </button>
    </>
  );
}

function WorkMeta({
  project,
}: {
  project: PortfolioProject;
}) {
  return (
    <div className="flex flex-1 flex-col px-4 pb-5 pt-4 sm:px-5">
      <h4 className="text-base font-semibold leading-snug text-navy">{project.title}</h4>
      {project.description && (
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          {project.description}
        </p>
      )}
      {project.linkUrl && (
        <div className="mt-auto pt-4">
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
      className="inline-flex items-center gap-1.5 text-sm font-medium text-gold transition-colors hover:text-gold-hover focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-warm-white"
    >
      {project.platform === "YouTube" ? "Watch on YouTube" : "Watch video"}
      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d={ARROW_ICON} />
      </svg>
    </a>
  );
}
