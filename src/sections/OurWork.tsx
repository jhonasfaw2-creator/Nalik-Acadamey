"use client";

import { useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Play } from "lucide-react";
import { useLang, type Lang } from "@/hooks/useLang";
import { useReveal } from "@/hooks/useReveal";

export interface PortfolioProject {
  id: string;
  title: string;
  titleAm?: string | null;
  platform: "YouTube" | "Reel";
  description?: string;
  descriptionAm?: string | null;
  thumbnailUrl: string;
  videoUrl?: string;
  youtubeId?: string;
  linkUrl?: string;
}

interface SelectedWorkProps {
  projects?: PortfolioProject[];
  onApplyClick?: () => void;
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

const en = {
  badge: "Selected work",
  heading: "Selected video projects",
  description: "A few stories brought to life through editing. Select a video to watch.",
  projects: "Selected video projects",
  play: (title: string) => `Play ${title}`,
  close: "Close video",
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
  play: (title) => `${title}ን ያጫውቱ`,
  close: "ቪዲዮውን ዝጋ",
  watchYouTube: "በዩቲዩብ ይመልከቱ",
  watchVideo: "ቪዲዮውን ይመልከቱ",
  ctaHeading: "እንደነዚህ ያሉ ታሪኮችን ማስተካከል ይፈልጋሉ?",
  ctaDescription: "በናሊክ አካዳሚ ተግባራዊ የኤዲቲንግ ክህሎቶችን ይገንቡ።",
  apply: "አሁን ያመልክቱ",
};

const STRINGS: Record<Lang, typeof en> = { en, am };

const revealClass = (visible: boolean) =>
  `transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none ${
    visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
  }`;

export default function SelectedWork({ projects = LONG_FORM_PROJECTS, onApplyClick }: SelectedWorkProps) {
  const { lang } = useLang();
  const t = STRINGS[lang];
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const heading = useReveal<HTMLDivElement>(0.1);

  return (
    <section
      id="our-work"
      lang={lang}
      aria-labelledby="our-work-title"
      className="relative overflow-hidden bg-warm-white px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div ref={heading.ref} className={`max-w-2xl ${revealClass(heading.visible)}`}>
          <p className="mb-3 text-sm font-medium text-gold">{t.badge}</p>
          <h2 id="our-work-title" className="text-3xl font-bold leading-snug text-navy sm:text-4xl">
            {t.heading}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-gray-600">{t.description}</p>
        </div>

        <ul aria-label={t.projects} className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {projects.map((project, index) => (
            <WorkCard
              key={project.id}
              project={project}
              lang={lang}
              strings={t}
              isActive={activeProjectId === project.id}
              onActivate={() => setActiveProjectId(project.id)}
              onDeactivate={() => setActiveProjectId(null)}
              staggerDelay={index * 100}
            />
          ))}
        </ul>

        {onApplyClick && (
          <aside className="mt-12 flex flex-col gap-5 rounded-2xl bg-navy px-6 py-7 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <h3 className="text-xl font-semibold sm:text-2xl">{t.ctaHeading}</h3>
              <p className="mt-2 text-sm leading-6 text-white/75">{t.ctaDescription}</p>
            </div>
            <button
              type="button"
              onClick={onApplyClick}
              className="action-primary inline-flex shrink-0 items-center justify-center gap-2 self-start sm:self-auto"
            >
              {t.apply}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </aside>
        )}
      </div>
    </section>
  );
}

function WorkCard({
  project,
  lang,
  strings,
  isActive,
  onActivate,
  onDeactivate,
  staggerDelay,
}: {
  project: PortfolioProject;
  lang: Lang;
  strings: typeof en;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  staggerDelay: number;
}) {
  const reveal = useReveal<HTMLLIElement>(0.05);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const title = (lang === "am" && project.titleAm) || project.title;
  const description = (lang === "am" && project.descriptionAm) || project.description;
  const hasPlayer = Boolean(project.youtubeId || project.videoUrl);

  const closePlayer = () => {
    onDeactivate();
    window.requestAnimationFrame(() => playButtonRef.current?.focus());
  };

  return (
    <li
      ref={reveal.ref}
      className={revealClass(reveal.visible)}
      style={{ transitionDelay: `${staggerDelay}ms` }}
    >
      <article className="group flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-navy/5 transition-shadow duration-300 hover:shadow-md">
        <div className="relative aspect-video overflow-hidden bg-navy">
          {isActive ? (
            <VideoPlayer project={project} closeLabel={strings.close} onClose={closePlayer} />
          ) : (
            <button
              ref={playButtonRef}
              type="button"
              disabled={!hasPlayer}
              onClick={onActivate}
              aria-label={strings.play(title)}
              className="absolute inset-0 flex w-full items-center justify-center text-left focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-gold disabled:cursor-default"
            >
              {!thumbnailFailed && (
                <img
                  src={project.thumbnailUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  loading="lazy"
                  decoding="async"
                  onError={() => setThumbnailFailed(true)}
                />
              )}
              <span className="absolute inset-0 bg-navy/25 transition-colors group-hover:bg-navy/40" aria-hidden="true" />
              {hasPlayer && (
                <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white text-navy shadow-lg transition-transform group-hover:scale-105 sm:h-12 sm:w-12">
                  <Play size={19} className="ml-0.5 fill-current" aria-hidden="true" />
                </span>
              )}
              <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-navy/85 px-2.5 py-1 text-xs font-medium text-white">
                {project.platform}
              </span>
            </button>
          )}
        </div>

        <div className="flex flex-1 flex-col px-4 pb-5 pt-4 sm:px-5">
          <h3 className="text-base font-semibold leading-snug text-navy">{title}</h3>
          {description && <p className="mt-2 text-sm leading-relaxed text-gray-600">{description}</p>}
          {project.linkUrl && (
            <div className="mt-auto pt-4">
              <a
                href={project.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-navy underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                {project.platform === "YouTube" ? strings.watchYouTube : strings.watchVideo}
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
          )}
        </div>
      </article>
    </li>
  );
}

function VideoPlayer({
  project,
  closeLabel,
  onClose,
}: {
  project: PortfolioProject;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <>
      {project.youtubeId ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(project.youtubeId)}?autoplay=1&rel=0`}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          title={`${project.title} video player`}
        />
      ) : (
        <video
          src={project.videoUrl}
          poster={project.thumbnailUrl}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          controls
          playsInline
          onEnded={onClose}
          aria-label={`${project.title} video player`}
        />
      )}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-navy/90 px-4 text-xs font-medium text-white transition-colors hover:bg-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        aria-label={closeLabel}
      >
        {closeLabel}
      </button>
    </>
  );
}
