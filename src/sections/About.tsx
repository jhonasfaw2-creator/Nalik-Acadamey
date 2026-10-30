"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useLang, type Lang } from "@/hooks/useLang";

/* -------------------------------------------------------------------------- */
/*  Types and constants                                                        */
/* -------------------------------------------------------------------------- */

interface AboutProps {
  /** Optional: when provided, an "Apply now" button is shown under the text. */
  onApplyClick?: () => void;
}

// Connections slower than this never autoplay the video.
const SKIP_VIDEO_CONNECTIONS = ["slow-2g", "2g"];

const DEFAULTS = {
  badge: "About Nalik",
  title: "Where aspiring editors become professionals.",
  paragraph1:
    "Nalik Academy is a hands-on creative media academy based in Ethiopia, focused on developing the next generation of video editors and visual storytellers.",
  paragraph2:
    "Our training goes beyond theory. You learn by working with real projects, professional workflows, and the tools used every day in modern media production.",
  video: "/assets/About/about.mp4",
  poster: "/assets/About/poster.jpg",
  captions: "", // optional URL of a .vtt captions file
  badgeAm: "",
  titleAm: "",
  paragraph1Am: "",
  paragraph2Am: "",
};

const AM_DEFAULTS = {
  badge: "ስለ ናሊክ",
  title: "ተስፋ ያላቸው ኤዲተሮች ባለሙያ የሚሆኑበት ቦታ።",
  paragraph1:
    "ናሊክ አካዳሚ በኢትዮጵያ የሚገኝ ተግባር ተኮር የፈጠራ ሚዲያ አካዳሚ ሲሆን፣ የቀጣዩን ትውልድ ቪዲዮ ኤዲተሮች እና የምስል ታሪክ ሰሪዎች ማፍራት ላይ ያተኩራል።",
  paragraph2:
    "ሥልጠናችን ከንድፈ ሐሳብ ያልፋል። በእውነተኛ ፕሮጀክቶች፣ በሙያዊ የሥራ ሂደቶች እና በዘመናዊ ሚዲያ ፕሮዳክሽን ውስጥ በየዕለቱ በሚጠቀሙባቸው መሣሪያዎች እየሠሩ ይማራሉ።",
};

/** Amharic text if the CMS has it; the Amharic default only while the English text is still the default. */
function localize(lang: Lang, current: string, currentAm: string, defaultEn: string, defaultAm: string) {
  if (lang !== "am") return current;
  if (currentAm) return currentAm;
  return current === defaultEn ? defaultAm : current;
}

/* -------------------------------------------------------------------------- */
/*  Copy (English / Amharic). Have a native speaker review the Amharic.        */
/* -------------------------------------------------------------------------- */

const en = {
  focusLabel: "Our focus",
  focus: ["Video editing", "Visual storytelling", "Real projects"],
  apply: "Apply now",
  videoLabel: "Video about Nalik Academy",
  startVideo: "Play video",
  pauseVideo: "Pause video",
  resumeVideo: "Play video",
  unmute: "Unmute video",
  mute: "Mute video",
  captionsLabel: "English captions",
};

const am: typeof en = {
  focusLabel: "ትኩረታችን",
  focus: ["ቪዲዮ ኤዲቲንግ", "የምስል ታሪክ አተራረክ", "እውነተኛ ፕሮጀክቶች"],
  apply: "አሁን ያመልክቱ",
  videoLabel: "ስለ ናሊክ አካዳሚ ቪዲዮ",
  startVideo: "ቪዲዮውን አጫውት",
  pauseVideo: "ቪዲዮውን አቁም",
  resumeVideo: "ቪዲዮውን አጫውት",
  unmute: "ድምፅ አብራ",
  mute: "ድምፅ አጥፋ",
  captionsLabel: "የአማርኛ ጽሑፍ ትርጉም",
};

const STRINGS: Record<Lang, typeof en> = { en, am };

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function About({ onApplyClick }: AboutProps) {
  const { lang } = useLang();
  const t = STRINGS[lang];

  // Editable content from the CMS
  const [content, setContent] = useState(DEFAULTS);
  const [contentReady, setContentReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/content?section=about")
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: Partial<typeof DEFAULTS>) => {
        if (cancelled) return;
        setContent((prev) => ({
          badge: d.badge || prev.badge,
          title: d.title || prev.title,
          paragraph1: d.paragraph1 || prev.paragraph1,
          paragraph2: d.paragraph2 || prev.paragraph2,
          video: d.video || prev.video,
          poster: d.poster || prev.poster,
          captions: d.captions || prev.captions,
          badgeAm: d.badgeAm || prev.badgeAm,
          titleAm: d.titleAm || prev.titleAm,
          paragraph1Am: d.paragraph1Am || prev.paragraph1Am,
          paragraph2Am: d.paragraph2Am || prev.paragraph2Am,
        }));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setContentReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const badge = localize(lang, content.badge, content.badgeAm, DEFAULTS.badge, AM_DEFAULTS.badge);
  const title = localize(lang, content.title, content.titleAm, DEFAULTS.title, AM_DEFAULTS.title);
  const paragraph1 = localize(lang, content.paragraph1, content.paragraph1Am, DEFAULTS.paragraph1, AM_DEFAULTS.paragraph1);
  const paragraph2 = localize(lang, content.paragraph2, content.paragraph2Am, DEFAULTS.paragraph2, AM_DEFAULTS.paragraph2);

  /* ------------------------------ scroll reveal ----------------------------- */

  const textRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const [textVisible, setTextVisible] = useState(false);
  const [mediaVisible, setMediaVisible] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || typeof IntersectionObserver === "undefined") {
      setTextVisible(true);
      setMediaVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          if (entry.target === textRef.current) setTextVisible(true);
          else if (entry.target === mediaRef.current) setMediaVisible(true);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.15 },
    );
    [textRef.current, mediaRef.current].forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  /* --------------------------------- video ---------------------------------- */

  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // null = not checked yet (avoids flashing the Play button before the check runs)
  const [canAutoplay, setCanAutoplay] = useState<boolean | null>(null);
  const [userStarted, setUserStarted] = useState(false);
  const [nearView, setNearView] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [userPaused, setUserPaused] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    const saveData = connection?.saveData === true;
    const slow = SKIP_VIDEO_CONNECTIONS.includes(connection?.effectiveType ?? "");
    setCanAutoplay(!reduceMotion && !saveData && !slow);
  }, []);

  // Start loading the video only once the media frame actually enters the
  // viewport, so the hero is never competing with a second full download.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    if (typeof IntersectionObserver === "undefined") {
      setNearView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNearView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px" },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const mountVideo = contentReady && nearView && !videoError && (canAutoplay === true || userStarted);
  const showStartButton = contentReady && !videoError && canAutoplay === false && !userStarted;

  // Keep the element's muted property in sync (React's `muted` prop only applies on mount).
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = isMuted;
  }, [isMuted, mountVideo]);

  // Play while visible, pause when scrolled away or when the visitor paused it.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mountVideo) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !userPaused) {
          video.play().catch(() => {
            // Autoplay was blocked: keep the poster and offer an explicit play button.
            setCanAutoplay(false);
          });
        } else video.pause();
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [mountVideo, content.video, userPaused]);

  const startVideo = () => {
    setIsMuted(false); // the visitor asked to play it, so start with sound
    setUserStarted(true);
  };

  const revealClass = (visible: boolean) => `about-reveal${visible ? " about-visible" : ""}`;

  return (
    <section
      id="about"
      lang={lang}
      aria-labelledby="about-title"
      className="relative overflow-hidden bg-warm-white px-5 py-20 sm:px-8 sm:py-28 lg:px-10 lg:py-36"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_0.85fr] lg:gap-28">
          {/* Text */}
          <div ref={textRef} className={`max-w-2xl ${revealClass(textVisible)}`}>
            <p className="mb-4 text-sm font-medium text-gold">{badge}</p>

            <h2
              id="about-title"
              className="text-[clamp(2.5rem,6vw,3.75rem)] font-semibold leading-[1.08] tracking-tight text-navy"
            >
              {title}
            </h2>

            <div className="mt-8 max-w-xl space-y-6 text-lg leading-8 text-gray-700 sm:mt-10 sm:space-y-7 sm:text-xl sm:leading-9">
              <p>{paragraph1}</p>
              <p>{paragraph2}</p>
            </div>

            <div className="mt-10 sm:mt-12">
              <p className="text-sm font-semibold text-navy">{t.focusLabel}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {t.focus.map((item) => (
                  <li
                    key={item}
                    className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-sm text-gray-700"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {onApplyClick && (
              <button
                type="button"
                onClick={onApplyClick}
                className="action-primary group/btn mt-8 inline-flex items-center justify-center gap-3 sm:mt-10"
              >
                {t.apply}
                <ArrowRight
                  size={18}
                  className="transition-transform duration-200 group-hover/btn:translate-x-1"
                />
              </button>
            )}
          </div>

          {/* Video */}
          <div
            ref={mediaRef}
            className={`relative mx-auto w-full max-w-[26rem] lg:mx-0 lg:ml-auto ${revealClass(mediaVisible)}`}
            style={{ transitionDelay: "120ms" }}
          >
            <div ref={frameRef} className="relative aspect-[4/5] overflow-hidden bg-navy">
              {/* Poster: the whole picture when the video is off, and the fallback while it loads */}
              <img
                src={content.poster}
                alt=""
                loading="lazy"
                decoding="async"
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                  mountVideo && isVideoReady ? "opacity-0" : "opacity-100"
                }`}
              />

              {mountVideo && (
                <video
                  key={content.video}
                  ref={videoRef}
                  autoPlay
                  muted={isMuted}
                  loop
                  playsInline
                  preload="auto"
                  poster={content.poster}
                  aria-label={t.videoLabel}
                  onPlaying={() => setIsVideoReady(true)}
                  onError={() => setVideoError(true)}
                  className={`absolute inset-0 h-full w-full object-cover transition-all duration-1000 ${
                    isVideoReady ? "scale-100 opacity-100" : "scale-[1.03] opacity-0"
                  }`}
                >
                  <source src={content.video} type="video/mp4" />
                  {content.captions && (
                    <track
                      kind="captions"
                      src={content.captions}
                      srcLang={lang}
                      label={t.captionsLabel}
                      default
                    />
                  )}
                </video>
              )}

              <div className="pointer-events-none absolute inset-0 bg-navy/20" />

              {/* Visitor-started playback (Save-Data, slow connection, or reduced motion) */}
              {showStartButton && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={startVideo}
                    className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-navy shadow-lg transition-colors hover:bg-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <Play size={16} fill="currentColor" />
                    {t.startVideo}
                  </button>
                </div>
              )}

              {/* Playback controls */}
              {mountVideo && isVideoReady && (
                <div className="absolute bottom-5 right-5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUserPaused((paused) => !paused)}
                    aria-label={userPaused ? t.resumeVideo : t.pauseVideo}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-navy transition-colors duration-300 hover:bg-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    {userPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMuted((muted) => !muted)}
                    aria-label={isMuted ? t.unmute : t.mute}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-navy transition-colors duration-300 hover:bg-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    {isMuted ? <VolumeX size={17} strokeWidth={2} /> : <Volume2 size={17} strokeWidth={2} />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
