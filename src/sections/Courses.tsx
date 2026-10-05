"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Users,
  Wrench,
} from "lucide-react";

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
    "The programme is built around hands-on projects and real production workflows. Students develop practical editing skills by working through actual editorial problems including pacing, sound selection, caption timing, colour, and finishing.",
};

const COURSE_ICONS: Record<string, string> = {
  "adobe-premiere-pro": "/assets/courses/adobe-premiere-pro.svg",
  "davinci-resolve": "/assets/courses/davinci-resolve.svg",
  "graphic-design": "/assets/courses/graphic-design.svg",
};

const FALLBACK_ICON = "/assets/courses/_pen_noun.svg";

const PROGRAMME_DETAILS = [
  { icon: Clock, text: "2 hours per day" },
  { icon: CalendarDays, text: "3 days per week" },
  { icon: Wrench, text: "Practical training" },
  { icon: Users, text: "Production projects" },
];

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
        className="bg-white px-5 py-20 sm:px-8 lg:px-10 lg:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <div className="mb-5 h-3 w-28 animate-pulse bg-gold/20" />

            <div className="h-12 w-full max-w-2xl animate-pulse bg-gray-100 sm:h-16" />

            <div className="mt-5 h-5 w-full max-w-xl animate-pulse bg-gray-100" />
          </div>

          <div className="mt-16 border-y border-gray-200 py-8">
            <div className="grid gap-8 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index}>
                  <div className="h-3 w-20 animate-pulse bg-gray-100" />
                  <div className="mt-3 h-5 w-32 animate-pulse bg-gray-100" />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-16 grid gap-px bg-gray-200 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="min-h-[420px] animate-pulse bg-white p-8"
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
        className="bg-white px-5 py-20 sm:px-8 lg:px-10 lg:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
            Our Courses
          </p>

          <h2 className="mt-5 max-w-2xl text-4xl font-bold leading-tight text-navy sm:text-5xl">
            Learn the skills behind professional editing.
          </h2>

          <div className="mt-12 border border-gray-200 bg-warm-white p-8 text-center">
            <p className="text-sm text-gray-600">
              We could not load the course list right now.
            </p>

            <button
              onClick={() => setReloadKey((key) => key + 1)}
              className="mt-5 bg-navy px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-gold hover:text-navy"
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
      className="bg-white px-5 py-20 sm:px-8 lg:px-10 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div ref={headingRef} className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
            Our Courses
          </p>

          <h2 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-navy sm:text-5xl lg:text-6xl">
            Learn the skills behind professional editing.
          </h2>

          <p className="mt-6 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
            Practical training built around the tools, decisions, and
            workflows used to create finished visual content.
          </p>
        </div>

        {/* Programme information */}
        <div
          ref={programmeRef}
          className="mt-16 border-y border-gray-200 py-8 lg:mt-20"
        >
          <div className="grid gap-10 lg:grid-cols-[1.1fr_1.9fr] lg:gap-16">

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Programme
              </p>

              <h3 className="mt-3 text-2xl font-bold text-navy sm:text-3xl">
                {PROGRAMME.title}
              </h3>
            </div>

            <div>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-7 sm:grid-cols-4">
                {PROGRAMME.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                      {fact.label}
                    </dt>

                    <dd className="mt-2 text-sm font-semibold leading-5 text-navy">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-8 max-w-3xl text-sm leading-6 text-gray-600">
                {PROGRAMME.description}
              </p>

              <div className="mt-6 border-l-2 border-gold pl-4">
                <p className="text-sm leading-6 text-gray-600">
                  Strong students may be introduced to real client and
                  production opportunities through the academy, depending
                  on readiness and project requirements.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Courses */}
        <div
          ref={gridRef}
          className="mt-16 grid gap-px bg-gray-200 md:grid-cols-3 lg:mt-20"
        >
          {courses.map((course, index) => {
            const price = course.discountPrice ?? course.price;

            return (
              <article
                key={course.id}
                className="group flex min-h-[500px] flex-col bg-white p-7 transition-colors duration-300 hover:bg-warm-white sm:p-8 lg:p-9"
              >
                {/* Number */}
                <div className="flex items-start justify-between">
                  <span className="text-xs font-semibold tracking-[0.18em] text-gray-300">
                    0{index + 1}
                  </span>

                  <div className="flex h-14 w-14 items-center justify-center border border-gray-200 bg-white p-3 transition-colors duration-300 group-hover:border-gold">
                    <CourseIcon
                      src={COURSE_ICONS[course.id] ?? FALLBACK_ICON}
                      alt={course.title}
                    />
                  </div>
                </div>

                {/* Course */}
                <div className="mt-10">
                  <h3 className="max-w-xs text-2xl font-bold leading-tight text-navy">
                    {course.title}
                  </h3>

                  <p className="mt-5 text-sm leading-6 text-gray-600">
                    {course.description}
                  </p>
                </div>

                {/* Details */}
                <div className="mt-8 border-t border-gray-200 pt-6">
                  <ul className="space-y-3">
                    {PROGRAMME_DETAILS.map((detail) => {
                      const Icon = detail.icon;

                      return (
                        <li
                          key={detail.text}
                          className="flex items-center gap-3 text-sm text-gray-600"
                        >
                          <Icon
                            size={15}
                            strokeWidth={1.7}
                            className="shrink-0 text-gold"
                          />

                          <span>{detail.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Price + action */}
                <div className="mt-auto pt-10">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">
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
                    className="mt-6 flex w-full items-center justify-between border border-navy bg-navy px-5 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:border-gold hover:bg-gold hover:text-navy"
                  >
                    <span>Register for this course</span>

                    <ArrowRight
                      size={16}
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Empty state */}
        {!loading && !error && courses.length === 0 && (
          <div className="mt-16 border-t border-gray-200 pt-10 text-center">
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
