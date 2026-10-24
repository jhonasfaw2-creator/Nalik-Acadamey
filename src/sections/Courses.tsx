"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

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
    { label: "Schedule", value: "3 days per week" },
    { label: "Sessions", value: "2 hours per day" },
    { label: "Training", value: "Practical and career focused" },
    { label: "Result", value: "Real editing projects" },
  ],
  description:
    "Students learn through real editing projects, practicing pacing, sound, captions, colour, and finishing.",
  opportunityNote:
    "Ready students may also be introduced to client work when suitable projects are available.",
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

function CourseIcon({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        const target = e.currentTarget;

        if (!target.src.endsWith(FALLBACK_ICON)) {
          target.src = FALLBACK_ICON;
        }
      }}
      className="h-full w-full object-contain"
    />
  );
}

export default function Courses({
  onApplyWithCourse,
}: CoursesProps) {
  const headingRef = useRef<HTMLDivElement>(null);
  const programmeRef = useRef<HTMLDivElement>(null);
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
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load courses");
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error("Invalid courses response");
        }

        if (cancelled) return;

        setCourses(data as Course[]);
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

  useEffect(() => {
    const elements = [
      headingRef.current,
      programmeRef.current,
      gridRef.current,
    ].filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add("courses-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.12,
      }
    );

    elements.forEach((element) => {
      element.classList.add("courses-reveal");
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  if (loading) {
    return (
      <section
        id="courses"
        className="bg-white px-5 py-16 sm:py-20 lg:px-10 lg:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <div className="mb-5 h-3 w-28 animate-pulse bg-gold/20" />

            <div className="h-12 w-full max-w-2xl animate-pulse bg-gray-100 sm:h-16" />

            <div className="mt-5 h-5 w-full max-w-xl animate-pulse bg-gray-100" />
          </div>

          <div className="mt-12 py-6">
            <div className="grid gap-6 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index}>
                  <div className="h-3 w-20 animate-pulse bg-gray-100" />
                  <div className="mt-3 h-5 w-32 animate-pulse bg-gray-100" />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="min-h-[320px] animate-pulse bg-white py-8"
              >
                <div className="h-16 w-16 bg-gray-100" />
                <div className="mt-8 h-7 w-40 bg-gray-100" />
                <div className="mt-5 h-20 bg-gray-100" />
                <div className="mt-8 h-10 w-32 bg-gold/10" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error && courses.length === 0) {
    return (
      <section
        id="courses"
        className="bg-white px-5 py-16 sm:py-20 lg:px-10 lg:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-medium text-gold">
            Our Courses
          </p>

          <h2 className="mt-5 max-w-2xl text-4xl font-bold leading-tight text-navy sm:text-5xl">
            Learn the skills behind professional editing.
          </h2>

          <div className="mt-12 bg-warm-white px-5 py-8 text-center">
            <p className="text-sm text-gray-600">
              We could not load the course list right now.
            </p>

            <button
              onClick={() => setReloadKey((key) => key + 1)}
              className="action-primary mt-5 inline-flex items-center justify-center"
            >
              Try Again
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="courses"
        className="bg-white px-5 py-16 sm:py-20 lg:px-10 lg:py-24"
    >
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div ref={headingRef} className="max-w-3xl">
          <p className="text-sm font-medium text-gold">
            Our Courses
          </p>

          <h2 className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight text-navy sm:text-5xl lg:text-6xl">
            Learn the skills behind professional editing.
          </h2>

          <p className="mt-3 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
            Practical training built around the tools, decisions, and
            workflows used to create finished visual content.
          </p>
        </div>

        {/* Programme information */}
        <div
          ref={programmeRef}
          className="mt-10 py-2 lg:mt-12"
        >
          <div className="grid gap-7 lg:grid-cols-[1.1fr_1.9fr] lg:gap-12">

            <div>
              <p className="text-sm font-medium text-gold">
                Programme
              </p>

              <h3 className="mt-3 text-2xl font-bold text-navy sm:text-3xl">
                {PROGRAMME.title}
              </h3>
            </div>

            <div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                {PROGRAMME.facts.map((fact) => (
                  <div key={fact.label}>
                      <dt className="text-xs font-medium text-gray-500">
                      {fact.label}
                    </dt>

                    <dd className="mt-2 text-sm font-semibold leading-5 text-navy">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-5 max-w-3xl text-sm leading-6 text-gray-600">
                {PROGRAMME.description}
              </p>

              <div className="mt-3 max-w-3xl">
                <p className="text-sm leading-6 text-gray-600">
                  {PROGRAMME.opportunityNote}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Courses */}
        <div
          ref={gridRef}
          className="mt-10 grid gap-x-8 gap-y-10 md:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-x-10"
        >
          {courses.map((course) => {
            const price = course.discountPrice ?? course.price;

            return (
              <article
                key={course.id}
                className="group flex h-full min-w-0 flex-col py-2"
              >
                {/* Number */}
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center">
                    <CourseIcon
                      src={COURSE_ICONS[course.id] ?? FALLBACK_ICON}
                      alt={course.title}
                    />
                  </div>
                </div>

                {/* Course */}
                <div className="mt-5 flex-1">
                  <h3 className="max-w-xs text-2xl font-bold leading-tight text-navy">
                    {course.title}
                  </h3>

                  <p className="mt-3 text-base leading-7 text-gray-600">
                    {course.description}
                  </p>
                </div>

                {/* Price + action */}
                <div className="mt-6">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-sm text-gray-500">
                        Tuition
                      </p>

                      <div className="mt-1 flex flex-wrap items-baseline gap-2">
                        <span className="text-2xl font-bold text-gold">
                          {formatBirr(price)}
                        </span>

                        {course.discountPrice && (
                          <span className="text-xs text-gray-400 line-through">
                            {formatBirr(course.price)}
                          </span>
                        )}
                      </div>

                      {course.discountLabel && (
                        <p className="mt-1 text-xs font-medium text-green-600">
                          {course.discountLabel}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onApplyWithCourse(course.title)}
                    className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-navy transition-colors hover:text-gold focus-visible:ring-2 focus-visible:ring-gold"
                  >
                    <span>Register for this course</span>

                    <ArrowRight size={16} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Empty state */}
        {!loading && !error && courses.length === 0 && (
          <div className="mt-16 py-10 text-center">
            <p className="text-sm text-gray-500">
              No courses are available right now.
            </p>
          </div>
        )}

        {/* Secondary error */}
        {!loading && error && courses.length > 0 && (
          <div className="mt-10 border-l-2 border-gold bg-warm-white px-5 py-4">
            <p className="text-sm text-gray-600">
              Some course information could not be refreshed.
            </p>

            <button
              onClick={() => setReloadKey((key) => key + 1)}
              className="mt-2 text-xs font-semibold text-navy underline underline-offset-4 hover:text-gold"
            >
              Refresh
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
