"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Clock, Users, Wrench } from "lucide-react";

interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  discountPrice: number | null;
  discountLabel: string | null;
}

interface CoursesProps {
  onApplyWithCourse: (courseValue: string) => void;
}

const PROGRAMME = {
  title: "2-Month Professional Programme",
  facts: [
    { label: "Duration", value: "3 days per week" },
    { label: "Session", value: "2 hours per day" },
    { label: "Format", value: "Practical, career-focused training" },
    { label: "Outcome", value: "Real-world editing projects" },
  ],
  description:
    "The programme is built around hands-on projects and real production workflows. Students develop practical editing skills by working through actual editorial problems: pacing, sound selection, caption timing, colour, and finishing, rather than only watching tutorials.",
  opportunity:
    "Top-performing students may have opportunities to connect with creators, influencers, and production projects through the academy.",
};

const COURSE_ICONS: Record<string, string> = {
  "adobe-premiere-pro": "/assets/courses/adobe-premiere-pro.svg",
  "davinci-resolve": "/assets/courses/davinci-resolve.svg",
  "graphic-design": "/assets/courses/graphic-design.svg",
};

const FALLBACK_ICON = "/assets/courses/_pen_noun.svg";

function formatBirr(amount: number) {
  return amount.toLocaleString("en-ET") + " ETB";
}

const PROGRAMME_DETAILS = [
  { icon: Clock, text: "2 hours per day" },
  { icon: CalendarDays, text: "3 days per week" },
  { icon: Wrench, text: "Practical training" },
  { icon: Users, text: "Production-style projects" },
];

function IconFallback({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        const target = e.currentTarget;
        if (target.src !== FALLBACK_ICON) target.src = FALLBACK_ICON;
      }}
      className="h-full w-full object-contain rounded-2xl"
    />
  );
}

export default function Courses({ onApplyWithCourse }: CoursesProps) {
  const headingRef = useRef<HTMLDivElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch("/api/courses")
      .then((r) => r.json())
      .then((courseData) => {
        if (!Array.isArray(courseData)) throw new Error("invalid courses payload");
        if (cancelled) return;
        setCourses(courseData as Course[]);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Scroll reveal for heading
  useEffect(() => {
    const el = headingRef.current;
    if (!el) return;
    el.classList.add("reveal");
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
  }, []);

  // Overview reveal
  useEffect(() => {
    const el = overviewRef.current;
    if (!el) return;
    el.classList.add("reveal");
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
  }, []);

  // Staggered card reveal
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const cards = Array.from(grid.children) as HTMLElement[];
    cards.forEach((card, i) => {
      card.classList.add("reveal-child");
      card.style.transitionDelay = `${i * 0.1}s`;
    });

    grid.classList.add("stagger-children");
    grid.classList.add("reveal");

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          grid.classList.add("visible");
          observer.unobserve(grid);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(grid);
    return () => observer.disconnect();
  }, [loading]);

  // Render with server-friendly defaults first. Course names, prices, and
  // descriptions are not lazy-loaded — they appear immediately on paint.
  // Only the course icons are lazy-loaded.
  if (loading) {
    return (
      <section id="courses" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div ref={headingRef}>
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">
              Our Courses
            </p>
            <h2 className="max-w-2xl text-3xl font-bold leading-snug text-navy sm:text-4xl">
              Start your creative career with hands-on training.
            </h2>
          </div>

          <div ref={overviewRef} className="mt-10 card-hover rounded-2xl border border-gray-200 bg-warm-white p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-widest text-gold">Programme Overview</p>
            <h3 className="mt-2 text-2xl font-bold text-navy">{PROGRAMME.title}</h3>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              {PROGRAMME.facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{fact.label}</dt>
                  <dd className="mt-0.5 text-base font-semibold text-navy">{fact.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-base leading-relaxed text-gray-600">{PROGRAMME.description}</p>
            <p className="mt-4 text-sm leading-relaxed text-gray-600 border-t border-dashed border-gray-200 pt-4">
              <span className="font-semibold text-navy">Opportunity.</span> {PROGRAMME.opportunity}
            </p>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="card-hover reveal-child rounded-xl border border-gray-200 bg-white p-6"
                style={{ transitionDelay: `${i * 0.1}s` }}
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                  <div className="h-full w-full animate-pulse bg-gray-200 rounded-2xl" />
                </div>
                <h3 className="mt-4 text-center text-lg font-bold text-navy">
                  <span className="animate-pulse block h-6 w-40 bg-gray-200 rounded" />
                </h3>
                <p className="mt-3 text-center text-sm leading-relaxed text-gray-500 h-10">
                  <span className="animate-pulse block h-4 w-full bg-gray-200 rounded" />
                </p>
                <div className="mt-3 flex items-baseline justify-center gap-2">
                  <span className="h-9 w-24 animate-pulse rounded-md bg-gold/20" />
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <span key={j} className="h-5 w-16 animate-pulse rounded-md bg-gray-200" />
                  ))}
                </div>
                <button
                  className="mt-5 w-full rounded-md bg-navy/60 px-5 py-2.5 text-sm font-semibold text-white"
                  disabled
                >
                  Register Now
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error && courses.length === 0) {
    return (
      <section id="courses" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div ref={headingRef}>
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">
              Our Courses
            </p>
            <h2 className="max-w-2xl text-3xl font-bold leading-snug text-navy sm:text-4xl">
              Start your creative career with hands-on training.
            </h2>
          </div>

          <div className="mt-10 rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
            <p className="text-sm font-medium text-amber-800">
              We couldn&apos;t load the course list right now.
            </p>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="courses" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div ref={headingRef}>
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">
            Our Courses
          </p>
          <h2 className="max-w-2xl text-3xl font-bold leading-snug text-navy sm:text-4xl">
            Start your creative career with hands-on training.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-600">
            Fixed prices and practical training. Every course is project-based, and you leave
            with work you can show, not just a certificate.
          </p>
        </div>

        <div ref={overviewRef} className="mt-10 card-hover rounded-2xl border border-gray-200 bg-warm-white p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-gold">Programme Overview</p>
          <h3 className="mt-2 text-2xl font-bold text-navy">{PROGRAMME.title}</h3>

          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {PROGRAMME.facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{fact.label}</dt>
                <dd className="mt-0.5 text-base font-semibold text-navy">{fact.value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-5 text-base leading-relaxed text-gray-600">{PROGRAMME.description}</p>

          <div className="mt-4 rounded-lg border border-gold/30 bg-gold/5 p-4">
            <p className="text-sm leading-relaxed text-gray-600">
              <span className="font-semibold text-navy">Opportunity.</span> {PROGRAMME.opportunity}
            </p>
          </div>
        </div>

        <div ref={gridRef} className="mt-10 grid gap-6 sm:grid-cols-3">
          {courses.map((course) => {
            const price = course.discountPrice ?? course.price;

            return (
              <article key={course.id} className="card-hover flex flex-col rounded-xl border border-gray-200 bg-white p-6 text-left">
                <div className="mb-4 flex h-20 w-20 items-center justify-center self-center rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                  <IconFallback src={COURSE_ICONS[course.id] ?? FALLBACK_ICON} alt={course.title} />
                </div>

                <h3 className="text-center text-lg font-bold text-navy">{course.title}</h3>

                <p className="mt-3 text-sm leading-relaxed text-gray-600 text-center">{course.description}</p>

                <div className="mt-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Fixed Price</p>
                  <div className="mt-1 flex items-baseline justify-center gap-2">
                    <p className="text-3xl font-bold text-gold">{formatBirr(price)}</p>
                    {course.discountPrice && (
                      <p className="text-sm text-gray-400 line-through">{formatBirr(course.price)}</p>
                    )}
                  </div>
                  {course.discountLabel && (
                    <p className="mt-1 text-xs font-medium text-green-600">{course.discountLabel}</p>
                  )}
                </div>

                <ul className="mt-5 w-full space-y-2.5 border-t border-gray-100 pt-5">
                  {PROGRAMME_DETAILS.map((detail) => {
                    const Icon = detail.icon;
                    return (
                      <li key={detail.text} className="flex items-center gap-2.5 text-sm text-gray-600">
                        <Icon size={16} className="shrink-0 text-gold" />
                        {detail.text}
                      </li>
                    );
                  })}
                </ul>

                <button
                  onClick={() => onApplyWithCourse(course.title)}
                  className="btn-navy mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Register Now <ArrowRight size={14} />
                </button>
              </article>
            );
          })}
        </div>

        {!loading && error && (
          <div className="mt-10 rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
            <p className="text-sm font-medium text-amber-800">
              We couldn&apos;t load the courses right now.
            </p>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && courses.length === 0 && (
          <p className="mt-12 text-center text-sm text-gray-400">No courses are available right now.</p>
        )}
      </div>
    </section>
  );
}
