"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

const DEFAULTS = {
  badge: "About Nalik",
  title: "Where aspiring editors become professionals.",
  paragraph1:
    "Nalik Academy is a hands-on creative media academy based in Ethiopia, focused on developing the next generation of video editors and visual storytellers.",
  paragraph2:
    "Our training goes beyond theory. You learn by working with real projects, professional workflows, and the tools used every day in modern media production.",
  video: "/assets/About/about.mp4",
  poster: "/assets/About/poster.jpg",
};

export default function About() {
  const textRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const videoElRef = useRef<HTMLVideoElement>(null);

  const [isMuted, setIsMuted] = useState(true);
  const [content, setContent] = useState(DEFAULTS);
  const [isVideoReady, setIsVideoReady] = useState(false);

  /* Fetch editable content */
  useEffect(() => {
    fetch("/api/content?section=about")
      .then((r) => r.json())
      .then((d) => {
        setContent((prev) => ({
          badge: d.badge || prev.badge,
          title: d.title || prev.title,
          paragraph1: d.paragraph1 || prev.paragraph1,
          paragraph2: d.paragraph2 || prev.paragraph2,
          video: d.video || prev.video,
          poster: d.poster || prev.poster,
        }));
      })
      .catch(() => {});
  }, []);

  /* Scroll reveal */
  useEffect(() => {
    const elements = [textRef.current, videoRef.current].filter(
      Boolean
    ) as HTMLElement[];

    elements.forEach((el, index) => {
      el.classList.add("about-reveal");
      el.style.transitionDelay = `${index * 120}ms`;
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("about-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
      }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  /* Intelligent video playback */
  useEffect(() => {
    const video = videoElRef.current;

    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      {
        threshold: 0.25,
      }
    );

    observer.observe(video);

    return () => observer.disconnect();
  }, [content.video]);

  const toggleSound = () => {
    const video = videoElRef.current;

    if (!video) return;

    const nextMuted = !isMuted;

    video.muted = nextMuted;
    setIsMuted(nextMuted);

    if (!nextMuted) {
      video.play().catch(() => {});
    }
  };

  return (
    <section
      id="about"
      className="relative overflow-hidden bg-warm-white px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">

        {/* Section header */}
        <div className="mb-12 sm:mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">
            {content.badge}
          </p>
        </div>

        <div className="grid items-center gap-14 lg:grid-cols-[1fr_0.75fr] lg:gap-24">

          {/* Text */}
          <div ref={textRef} className="max-w-2xl">

            <h2 className="text-4xl font-bold leading-[1.05] tracking-tight text-navy sm:text-5xl lg:text-[3.5rem]">
              {content.title}
            </h2>

            <div className="mt-8 max-w-xl space-y-5 text-base leading-7 text-gray-600 sm:text-lg sm:leading-8">
              <p>{content.paragraph1}</p>

              <p>{content.paragraph2}</p>
            </div>

            {/* Focus line */}
            <div className="mt-10 border-t border-navy/10 pt-5">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-navy/50">
                  Our Focus
                </span>

                <span className="text-sm font-medium text-navy">
                  Video Editing
                </span>

                <span className="h-1 w-1 rounded-full bg-gold" />

                <span className="text-sm font-medium text-navy">
                  Visual Storytelling
                </span>

                <span className="h-1 w-1 rounded-full bg-gold" />

                <span className="text-sm font-medium text-navy">
                  Real Projects
                </span>
              </div>
            </div>
          </div>

          {/* Video */}
          <div
            ref={videoRef}
            className="relative mx-auto w-full max-w-[26rem] lg:mx-0 lg:ml-auto"
          >
            <div className="relative">

              {/* Video frame */}
              <div className="relative aspect-[4/5] overflow-hidden bg-navy">

                <video
                  ref={videoElRef}
                  muted={isMuted}
                  loop
                  playsInline
                  preload="metadata"
                  poster={content.poster}
                  onCanPlay={() => setIsVideoReady(true)}
                  className={`h-full w-full object-cover transition-all duration-1000 ${
                    isVideoReady
                      ? "scale-100 opacity-100"
                      : "scale-[1.03] opacity-0"
                  }`}
                >
                  <source src={content.video} type="video/mp4" />
                </video>

                <div className="pointer-events-none absolute inset-0 bg-navy/20" />

                {/* Video label */}
                <div className="absolute left-5 top-5">
                  <span className="border border-white/30 bg-navy/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                    Inside Nalik
                  </span>
                </div>

                {/* Sound */}
                <button
                  onClick={toggleSound}
                  aria-label={isMuted ? "Unmute video" : "Mute video"}
                  className="absolute bottom-5 right-5 flex h-11 w-11 items-center justify-center rounded-full bg-white text-navy transition-colors duration-300 hover:bg-gold focus:outline-none focus:ring-2 focus:ring-white"
                >
                  {isMuted ? (
                    <VolumeX size={17} strokeWidth={2} />
                  ) : (
                    <Volume2 size={17} strokeWidth={2} />
                  )}
                </button>

              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}