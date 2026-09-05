"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Check, Clock, Users, Wrench } from "lucide-react";

interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  discountPrice: number | null;
  discountLabel: string | null;
  schedules: Schedule[];
}

interface Schedule {
  id: string;
  batchName: string;
  days: string;
  startTime: string;
  endTime: string;
  maxSeats: number;
  enrolled: number;
}

interface CoursesProps {
  onApplyWithCourse: (courseValue: string) => void;
}

const COURSE_ICONS: Record<string, string> = {
  "adobe-premiere-pro": "/assets/courses/adobe-premiere-pro.svg",
  "davinci-resolve": "/assets/courses/davinci-resolve.svg",
  "graphic-design": "/assets/courses/graphic-design.svg",
};

function formatBirr(amount: number) {
  return amount.toLocaleString("en-ET") + " ETB";
}

const COURSE_DETAILS = [
  { icon: Clock, text: "2 hours per day" },
  { icon: CalendarDays, text: "3 days per week" },
  { icon: Wrench, text: "Practical training" },
];

export default function Courses({ onApplyWithCourse }: CoursesProps) {
  const headingRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    // Courses are required; schedules are optional decoration — a failure of
    // either must never blank out the section or claim there are no courses.
    fetch("/api/courses")
      .then((r) => r.json())
      .then(async (courseData) => {
        if (!Array.isArray(courseData)) throw new Error("invalid courses payload");
        let scheduleMap: Record<string, Schedule[]> = {};
        try {
          const scheduleData = await fetch("/api/schedules").then((r) => r.json());
          if (Array.isArray(scheduleData)) {
            scheduleMap = {};
            for (const s of scheduleData as (Schedule & { course: { id: string } })[]) {
              if (!scheduleMap[s.course.id]) scheduleMap[s.course.id] = [];
              scheduleMap[s.course.id].push(s);
            }
          }
        } catch {
          // schedules are optional — courses still render
        }
        if (cancelled) return;
        setCourses(courseData.map((c: Omit<Course, "schedules">) => ({
          ...c,
          schedules: scheduleMap[c.id] || [],
        })));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [reloadKey]);

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
  }, [loading]);

  const displayCourses = loading ? [] : courses;

  return (
    <section id="courses" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div ref={headingRef}>
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">Our Courses</p>
          <h2 className="max-w-2xl text-3xl font-bold leading-snug text-navy sm:text-4xl">
            Start your creative career with hands-on training.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-600">
            Fixed prices, practical training, and a schedule that fits your week. Every course is
            project-based — you leave with a portfolio, not just a certificate.
          </p>
        </div>

        <div ref={gridRef} className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {displayCourses.map((course) => {
            const price = course.discountPrice ?? course.price;
            const openSchedules = course.schedules.filter((s) => s.maxSeats - s.enrolled > 0);
            const fullSchedules = course.schedules.filter((s) => s.maxSeats - s.enrolled <= 0);
            return (
              <div
                key={course.id}
                className="card-hover group flex flex-col rounded-xl border border-gray-200 bg-white p-6 text-left"
              >
                <div className="mb-4 flex h-20 w-20 items-center justify-center self-center rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                  <img
                    src={COURSE_ICONS[course.id] || "/assets/courses/_pen_noun.svg"}
                    alt={course.title}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </div>
                <h3 className="text-center text-lg font-bold text-navy">{course.title}</h3>

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

                <ul className="mt-6 w-full space-y-2.5 border-t border-gray-100 pt-5">
                  {COURSE_DETAILS.map((detail) => {
                    const Icon = detail.icon;
                    return (
                      <li key={detail.text} className="flex items-center gap-2.5 text-sm text-gray-600">
                        <Icon size={16} className="shrink-0 text-gold" />
                        {detail.text}
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-5 rounded-lg bg-warm-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Available Schedules</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {openSchedules.slice(0, 3).map((s) => (
                      <span key={s.id} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-navy">
                        <Check size={12} className="text-gold" />
                        {s.batchName}
                        <span className="flex items-center gap-0.5 text-gray-400"><Users size={10} /> {s.maxSeats - s.enrolled}</span>
                      </span>
                    ))}
                    {fullSchedules.map((s) => (
                      <span key={s.id} className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-500">
                        {s.batchName} — Full
                      </span>
                    ))}
                    {course.schedules.length === 0 && (
                      <span className="text-xs text-gray-400">Schedules coming soon</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onApplyWithCourse(course.title)}
                  className="btn-navy mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Apply Now <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
        </div>

        {!loading && error && (
          <div className="mt-10 rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
            <p className="text-sm font-medium text-amber-800">We couldn&apos;t load the courses right now.</p>
            <button onClick={() => setReloadKey((k) => k + 1)} className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-700">
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