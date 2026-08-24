"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULTS = {
  badge: "About Us",
  title: "Nalik Academy is where aspiring editors become professionals.",
  paragraph1:
    "We are a hands-on media production academy based in Ethiopia, focused on training the next generation of video editors, graphic designers, and visual storytellers. Our courses are built around real-world projects — not theory alone.",
  paragraph2:
    "Whether you are a complete beginner or looking to sharpen your skills, our structured programs take you from fundamentals to professional-level output using the same tools the industry relies on every day.",
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
          setContent({
            badge: d.badge || DEFAULTS.badge,
            title: d.title || DEFAULTS.title,
            paragraph1: d.paragraph1 || DEFAULTS.paragraph1,
            paragraph2: d.paragraph2 || DEFAULTS.paragraph2,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("opacity-100", "translate-y-0");
            entry.target.classList.remove("opacity-0", "translate-y-6");
          }
        });
      },
      { threshold: 0.15 }
    );
    const els = [textRef.current, videoRef.current].filter(Boolean);
    els.forEach((el) => observer.observe(el!));
    return () => els.forEach((el) => observer.unobserve(el!));
  }, []);

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
  }, []);

  const toggleSound = () => {
    const video = videoElRef.current;
    if (!video) return;
    const next = !isMuted;
    video.muted = next;
    setIsMuted(next);
  };

  return (
    <section id="about" ref={sectionRef} className="bg-warm-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">{content.badge}</p>

        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div ref={textRef} className="opacity-0 translate-y-6 transition-all duration-700 ease-out">
            <h2 className="text-3xl font-bold leading-snug text-navy sm:text-4xl">{content.title}</h2>
            <p className="mt-6 text-base leading-relaxed text-gray-600">{content.paragraph1}</p>
            <p className="mt-4 text-base leading-relaxed text-gray-600">{content.paragraph2}</p>
          </div>

          <div ref={videoRef} className="opacity-0 translate-y-6 transition-all duration-700 delay-150 ease-out">
            <div className="relative mx-auto max-w-md overflow-hidden rounded-lg bg-navy">
              <video ref={videoElRef} muted loop playsInline className="h-auto w-full">
                <source src="/assets/About/about.mp4" type="video/mp4" />
              </video>
              <button
                onClick={toggleSound}
                aria-label={isMuted ? "Unmute video" : "Mute video"}
                className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-navy/70 text-white backdrop-blur-sm transition-colors hover:bg-navy/90"
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
