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
  { id: "1", title: "Cinematic Reel", description: "A cinematic showcase of visual storytelling and film-grade color grading.", videoUrl: "/assets/our works/cinmatic vedio.mp4", posterUrl: "/assets/our works/cinmatic_vedio_poster.jpg", category: "Cinematic" },
  { id: "2", title: "Short Film Showcase", description: "Student-produced short film demonstrating narrative editing and sound design.", videoUrl: "/assets/our works/shortshow.mp4", posterUrl: "/assets/our works/shortshow_poster.jpg", category: "Short Film" },
  { id: "3", title: "Production Showcase", description: "A highlight reel of projects created throughout the academy program.", videoUrl: "/assets/our works/showcase.mp4", posterUrl: "/assets/our works/showcase_poster.jpg", category: "Production" },
  { id: "4", title: "Brand Campaign", description: "Brand-focused content crafted for commercial and social media platforms.", videoUrl: "/assets/our works/brand focused.mp4", posterUrl: "/assets/our works/brand_focused_poster.jpg", category: "Commercial" },
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

  // Scroll reveal for heading
  useEffect(() => {
    const el = headingRef.current;
    if (!el) return;
    el.classList.add("reveal");
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add("visible"); observer.unobserve(el); } },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Staggered card reveal
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const cards = Array.from(grid.children) as HTMLElement[];
    cards.forEach((card, i) => {
      card.classList.add("reveal-child");
      card.style.transitionDelay = `${i * 0.12}s`;
    });

    grid.classList.add("stagger-children");
    grid.classList.add("reveal");

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { grid.classList.add("visible"); observer.unobserve(grid); } },
      { threshold: 0.1 }
    );
    observer.observe(grid);
    return () => observer.disconnect();
  }, [projects]);

  return (
    <section id="our-work" className="bg-warm-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div ref={headingRef}>
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">Our Work</p>
          <h2 className="max-w-2xl text-3xl font-bold leading-snug text-navy sm:text-4xl">
            See what our students and team have created.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-600">
            A selection of projects produced at Nalik Academy — from cinematic reels to brand campaigns.
          </p>
        </div>

        <div ref={gridRef} className="mt-12 grid gap-8 sm:grid-cols-2">
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
          if (video.getAttribute("preload") === "none") {
            video.setAttribute("preload", "metadata");
            video.load();
          }
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [project.videoUrl]);

  if (!project.videoUrl) return null;

  const posterSrc = project.posterUrl || "/assets/our works/cinmatic_vedio_poster.jpg";

  return (
    <div className="card-hover overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="relative aspect-video overflow-hidden bg-navy">
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="none"
          poster={posterSrc}
          className="h-full w-full object-cover"
        >
          <source src={project.videoUrl} type="video/mp4" />
        </video>
        {project.category && (
          <span className="absolute left-3 top-3 rounded-full bg-navy/70 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
            {project.category}
          </span>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-lg font-bold text-navy">{project.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">{project.description}</p>
      </div>
    </div>
  );
}
