"use client";

import { useState } from "react";
import { ArrowRight, ArrowUpRight, Play } from "lucide-react";
import { useLang, type Lang } from "@/hooks/useLang";
import { LONG_FORM_PROJECTS, type PortfolioProject } from "@/lib/portfolio";

interface SelectedWorkProps {
  projects?: PortfolioProject[];
  onApplyClick?: () => void;
}

const en = {
  badge: "Selected work",
  heading: "Selected video projects",
  description: "A few stories brought to life through editing. Select a video to watch.",
  projects: "Selected video projects",
  watchYouTube: "Watch on YouTube",
  watchVideo: "Watch video",
  ctaHeading: "Want to edit stories like these?",
  ctaDescription: "Build practical editing skills with Nalik Academy.",
  apply: "Apply now",
};

const am: typeof en = {
  badge: "የተመረጡ ሥራዎች",
  heading: "የተመረጡ የቪዲዮ ፕሮጀክቶች",
  description: "በኤዲቲንግ ሕያው የሆኑ ጥቂት ታሪኮች። ለማየት ቪዲዮ ይምረጡ።",
  projects: "የተመረጡ የቪዲዮ ፕሮጀክቶች",
  watchYouTube: "በዩቲዩብ ይመልከቱ",
  watchVideo: "ቪዲዮውን ይመልከቱ",
  ctaHeading: "እንደነዚህ ያሉ ታሪኮችን ማስተካከል ይፈልጋሉ?",
  ctaDescription: "በናሊክ አካዳሚ ተግባራዊ የኤዲቲንግ ክህሎቶችን ይገንቡ።",
  apply: "አሁን ያመልክቱ",
};

const STRINGS: Record<Lang, typeof en> = { en, am };

export default function SelectedWork({ projects = LONG_FORM_PROJECTS, onApplyClick }: SelectedWorkProps) {
  const { lang } = useLang();
  const t = STRINGS[lang];
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const [featured, ...rest] = projects;

  return (
    <section
      id="our-work"
      lang={lang}
      aria-labelledby="our-work-title"
      className="relative scroll-mt-20 overflow-hidden bg-warm-white px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-medium text-gold">{t.badge}</p>
          <div className="relative mb-6 inline-block">
            <h2 id="our-work-title" className="text-3xl font-bold leading-[1.05] tracking-tight text-navy sm:text-4xl lg:text-5xl">
              {t.heading}
            </h2>
            <span className="absolute -bottom-1.5 left-0 h-0.5 w-12 bg-gold" />
          </div>
          <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">{t.description}</p>
        </div>

        <ul
          aria-label={t.projects}
          role="list"
          className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6"
        >
          {projects.map((project) => (
            <WorkCard
              key={project.id}
              project={project}
              lang={lang}
              strings={t}
              isActive={activeVideoId === project.id}
              onPlay={() => setActiveVideoId(project.id)}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

function WorkCard({
  project,
  lang,
  strings,
  className = "",
  isActive,
  onPlay,
}: {
  project: PortfolioProject;
  lang: Lang;
  strings: typeof en;
  className?: string;
  isActive: boolean;
  onPlay: () => void;
}) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const title = (lang === "am" && project.titleAm) || project.title;
  const description = (lang === "am" && project.descriptionAm) || project.description;

  return (
    <li
      className={`min-w-0 ${className}`}
    >
      <article
        className={[
          "flex flex-col overflow-hidden rounded-xl bg-white border border-gray-100 shadow-sm",
          "transition-all duration-300 hover:border-gold hover:shadow-md",
        ].join(" ")}
      >
        <div
          className={`relative aspect-video overflow-hidden bg-navy`}
        >
          {isActive && project.youtubeId ? (
            <iframe
              src={`https://www.youtube.com/embed/${project.youtubeId}?autoplay=1`}
              title={title}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button
              onClick={onPlay}
              className="block h-full w-full relative"
              aria-label={`${strings.watchVideo}: ${title}`}
            >
              {!thumbnailFailed && (
                <img
                  src={project.thumbnailUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
                  loading="lazy"
                  decoding="async"
                  onError={() => setThumbnailFailed(true)}
                />
              )}
              <span className="absolute inset-0 bg-navy/15 transition-colors hover:bg-navy/25" aria-hidden="true" />
              <span
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300`}
                aria-hidden="true"
              >
                <span className={`flex items-center justify-center rounded-full bg-white text-navy shadow-lg h-14 w-14`}>
                  <Play size={20} className="ml-0.5 fill-current" />
                </span>
              </span>
              <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-navy/85 px-2 py-0.5 text-xs font-medium text-white">
                {project.platform}
              </span>
            </button>
          )}
        </div>

        <div className="flex flex-1 flex-col px-5 pb-6 pt-5 sm:px-6">
          <h3 className={`text-base font-semibold leading-snug text-navy`}>
            {title}
          </h3>
          {description && (
            <p className={`mt-3 text-sm leading-relaxed text-gray-600 line-clamp-2`}>
              {description}
            </p>
          )}
          <div className="mt-auto pt-4">
            <a
              href={project.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-navy underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {project.platform === "YouTube" ? strings.watchYouTube : strings.watchVideo}
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
        </div>
      </article>
    </li>
  );
}
