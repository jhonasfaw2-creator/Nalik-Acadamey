"use client";

import { useEffect, useRef, useState } from "react";

interface Project {
  id: string;
  title: string;
  description: string;
  videoUrl: string | null;
  posterUrl: string | null;
  category: string | null;
}

const DEFAULTS: Project[] = [
  { id: "1", title: "Cinematic Reel", description: "A cinematic showcase of visual storytelling and film-grade color grading.", videoUrl: "/assets/our works/cinmatic vedio.mp4", posterUrl: null, category: "Cinematic" },
  { id: "2", title: "Short Film Showcase", description: "Student-produced short film demonstrating narrative editing and sound design.", videoUrl: "/assets/our works/shortshow.mp4", posterUrl: null, category: "Short Film" },
  { id: "3", title: "Production Showcase", description: "A highlight reel of projects created throughout the academy program.", videoUrl: "/assets/our works/showcase.mp4", posterUrl: null, category: "Production" },
  { id: "4", title: "Brand Campaign", description: "Brand-focused content crafted for commercial and social media platforms.", videoUrl: "/assets/our works/brand focused.mp4", posterUrl: null, category: "Commercial" },
];

export default function OurWork() {
  const headingRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [projects, setProjects] = useState<Project[]>(DEFAULTS);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d) && d.length > 0) {
          setProjects(d);
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
      { threshold: 0.1 }
    );
    const els = [headingRef.current, gridRef.current].filter(Boolean);
    els.forEach((el) => observer.observe(el!));
    return () => els.forEach((el) => observer.unobserve(el!));
  }, []);

  return (
    <section id="our-work" className="bg-warm-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div ref={headingRef} className="opacity-0 translate-y-6 transition-all duration-700 ease-out">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">Our Work</p>
          <h2 className="max-w-2xl text-3xl font-bold leading-snug text-navy sm:text-4xl">
            See what our students and team have created.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-600">
            A selection of projects produced at Nalik Academy — from cinematic reels to brand campaigns.
          </p>
        </div>

        <div ref={gridRef} className="mt-12 grid gap-8 sm:grid-cols-2 opacity-0 translate-y-6 transition-all duration-700 delay-150 ease-out">
          {projects.map((project) => (
            <VideoCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </section>
  );
}

function VideoCard({ project }: { project: Project }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const videoSrc = project.videoUrl || "/assets/our works/cinmatic vedio.mp4";

  return (
    <div className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow duration-300 hover:shadow-lg">
      <div className="relative aspect-video overflow-hidden bg-navy">
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="metadata"
          controls
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
        {project.category && (
          <div className="absolute left-3 top-3 rounded-full bg-navy/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            {project.category}
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-lg font-bold text-navy">{project.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">{project.description}</p>
      </div>
    </div>
  );
}
