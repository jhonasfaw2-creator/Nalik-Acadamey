"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

interface Course {
  id: string;
  title: string;
  description: string;
  price: string;
  discountPrice: string | null;
  discountLabel: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  sortOrder: number;
}

interface CoursesProps {
  onApplyWithCourse: (courseValue: string) => void;
}

const DEFAULTS: Course[] = [
  { id: "1", title: "Adobe Illustrator + Photoshop", description: "Learn to create logos, thumbnails, social media assets, and print-ready designs from scratch.", price: "6,000 Birr", discountPrice: "4,800 Birr", discountLabel: "Opening Offer — 20% off", videoUrl: null, posterUrl: null, sortOrder: 1 },
  { id: "2", title: "DaVinci Resolve", description: "Professional color grading, editing, and audio finishing used on Hollywood productions.", price: "8,000 Birr", discountPrice: "6,500 Birr", discountLabel: "Opening Offer — 19% off", videoUrl: null, posterUrl: null, sortOrder: 2 },
  { id: "3", title: "Adobe Premiere", description: "Master professional video editing from timeline basics to advanced multicam workflows and export settings.", price: "8,000 Birr", discountPrice: "6,500 Birr", discountLabel: "Opening Offer — 19% off", videoUrl: null, posterUrl: null, sortOrder: 3 },
];

const COURSE_IMAGES: Record<string, string> = {
  "Adobe Illustrator + Photoshop": "/assets/courses/adobe and photo shop.avif",
  "DaVinci Resolve": "/assets/courses/davinci resolve.jpeg",
  "Adobe Premiere": "/assets/courses/adobe-logo-icon-set-vector-white-background_981536-451.avif",
};

export default function Courses({ onApplyWithCourse }: CoursesProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [courses, setCourses] = useState<Course[]>(DEFAULTS);

  useEffect(() => {
    fetch("/api/courses")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d) && d.length > 0) {
          setCourses(d);
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
  }, [courses]);

  return (
    <section id="courses" ref={sectionRef} className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div ref={headingRef}>
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">Our Courses</p>
          <h2 className="max-w-2xl text-3xl font-bold leading-snug text-navy sm:text-4xl">
            Start your creative career with hands-on training.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-600">
            Every course is project-based. You leave with a portfolio, not just a certificate.
          </p>
        </div>

        <div ref={gridRef} className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const image = course.posterUrl || COURSE_IMAGES[course.title] || null;
            return (
              <div
                key={course.id}
                className="card-hover group relative flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 text-center"
              >
                {image && (
                  <div className="mb-4 h-28 w-28 overflow-hidden rounded-xl bg-gray-50 transition-transform duration-300 group-hover:scale-105">
                    <img src={image} alt={course.title} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                )}

                {course.discountLabel && (
                  <div className="mb-2 rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                    {course.discountLabel}
                  </div>
                )}

                <h3 className="text-lg font-bold text-navy">{course.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-600">{course.description}</p>

                <div className="mt-5">
                  {course.discountPrice ? (
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-2xl font-bold text-gold">{course.discountPrice}</span>
                      <span className="text-sm text-gray-400 line-through">{course.price}</span>
                    </div>
                  ) : (
                    <span className="text-2xl font-bold text-navy">{course.price}</span>
                  )}
                </div>

                <button
                  onClick={() => onApplyWithCourse(course.title)}
                  className="btn-navy mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Apply Now <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
