"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULTS = {
  badge: "About Us",
  title: "Nalik Academy is where aspiring editors become professionals.",
  paragraph1:
    "We are a hands-on media production academy based in Ethiopia, focused on training the next generation of video editors, graphic designers, and visual storytellers. Our courses are built around real-world projects, not theory alone.",
  paragraph2:
    "Whether you are a complete beginner or looking to sharpen your skills, our structured programs take you from fundamentals to professional-level output using the same tools the industry relies on every day.",
  video: "/assets/About/about.mp4",
  poster: "/assets/About/poster.jpg",
};

export default function About() {
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const videoElRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [content, setContent] = useState(DEFAULTS);

  useEffect(() => {
    fetch("/api/content?section=about")
      .then((r) => r.json())
      .then((d) => {
        if (d.badge || d.title) {
          setContent((prev) => ({
            badge: d.badge || prev.badge,
            title: d.title || prev.title,
            paragraph1: d.paragraph1 || prev.paragraph1,
            paragraph2: d.paragraph2 || prev.paragraph2,
            video: d.video || prev.video,
            poster: d.poster || prev.poster,
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Scroll reveal animation for text and video
  useEffect(() => {
    const els = [textRef.current, videoRef.current].filter(Boolean);
    els.forEach((el, i) => {
      if (!el) return;
      el.classList.add("reveal");
      el.style.transitionDelay = `${i * 0.15}s`;
    });
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => observer.observe(el!));
    return () => els.forEach((el) => observer.unobserve(el!));
  }, []);

  // Instant scroll-triggered video play/pause
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
      { threshold: 0.25 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [content.video]);

  const toggleSound = () => {
    const video = videoElRef.current;
    if (!video) return;
    const next = !isMuted;
    video.muted = next;
    setIsMuted(next);
  };

  return (
    <section id="about" ref={sectionRef} className="bg-warm-white px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 sm:mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold sm:text-sm">{content.badge}</p>
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12">
          <div ref={textRef} className="max-w-xl">
            <h2 className="text-3xl font-bold leading-tight text-navy sm:text-4xl lg:text-[2.75rem] lg:leading-[1.05]">
              {content.title}
            </h2>
            <div className="mt-5 space-y-4 text-base leading-relaxed text-gray-600 sm:text-[1.05rem]">
              <p>{content.paragraph1}</p>
              <p>{content.paragraph2}</p>
            </div>
          </div>

          <div ref={videoRef} className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[22rem] overflow-hidden rounded-[1.75rem] border border-gray-200 bg-navy shadow-[0_18px_60px_-28px_rgba(21,27,41,0.35)]">
              <div className="aspect-[3/4] overflow-hidden bg-navy">
                <video
                  ref={videoElRef}
                  muted={isMuted}
                  loop
                  playsInline
                  preload="metadata"
                  poster={content.poster}
                  className="h-full w-full object-cover opacity-95"
                >
                  <source src={content.video} type="video/mp4" />
                </video>
              </div>

              <button
                onClick={toggleSound}
                aria-label={isMuted ? "Unmute video" : "Mute video"}
                className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-navy shadow-sm backdrop-blur-sm transition-transform duration-200 hover:scale-105"
              >
                {isMuted ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}