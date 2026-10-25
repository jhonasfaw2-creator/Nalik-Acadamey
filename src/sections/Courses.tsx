"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useLang, type Lang } from "@/hooks/useLang";
import { useReveal } from "@/hooks/useReveal";

/* -------------------------------------------------------------------------- */
/*  Types and constants                                                        */
/* -------------------------------------------------------------------------- */

interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  discountPrice: number | null;
  discountLabel: string | null;
  /** Optional Amharic copy from the API. The registration flow always uses `title`. */
  titleAm?: string | null;
  descriptionAm?: string | null;
}

interface CoursesProps {
  onApplyWithCourse: (courseValue: string) => void;
}

const COURSE_ICONS: Record<string, string> = {
  "adobe-premiere-pro": "/assets/courses/adobe-premiere-pro.svg",
  "davinci-resolve": "/assets/courses/davinci-resolve.svg",
  "graphic-design": "/assets/courses/graphic-design.svg",
};

const FALLBACK_ICON = "/assets/courses/_pen_noun.svg";

/* -------------------------------------------------------------------------- */
/*  Copy (English / Amharic). Have a native speaker review the Amharic.        */
/* -------------------------------------------------------------------------- */

const en = {
  badge: "Our Courses",
  heading: "Learn the skills behind professional editing.",
  subheading:
    "Practical training built around the tools, decisions, and workflows used to create finished visual content.",
  programmeLabel: "Programme",
  programmeTitle: "2-Month Professional Programme",
  facts: [
    { label: "Schedule", value: "3 days per week" },
    { label: "Sessions", value: "2 hours per day" },
    { label: "Training", value: "Practical and career focused" },
    { label: "Result", value: "Real editing projects" },
  ],
  programmeDescription:
    "Students learn through real editing projects, practicing pacing, sound, captions, colour, and finishing.",
  opportunityNote:
    "Ready students may also be introduced to client work when suitable projects are available.",
  tuition: "Tuition",
  originalPrice: "Original price",
  currency: "Birr",
  register: "Register for this course",
  loadingCourses: "Loading courses",
  loadFail: "We could not load the course list right now.",
  tryAgain: "Try again",
  empty: "No courses are available right now.",
  refreshFail: "Some course information could not be refreshed.",
  refresh: "Refresh",
  courseList: "Courses",
};

const am: typeof en = {
  badge: "ኮርሶቻችን",
  heading: "ከሙያዊ ኤዲቲንግ ጀርባ ያሉ ክህሎቶችን ይማሩ።",
  subheading:
    "የተጠናቀቁ የምስል ይዘቶችን ለመፍጠር በሚያገለግሉ መሣሪያዎች፣ ውሳኔዎች እና የሥራ ሂደቶች ላይ የተመሠረተ ተግባራዊ ሥልጠና።",
  programmeLabel: "ፕሮግራም",
  programmeTitle: "የ2 ወር ሙያዊ ፕሮግራም",
  facts: [
    { label: "መርሐ ግብር", value: "በሳምንት 3 ቀናት" },
    { label: "ክፍለ ጊዜ", value: "በቀን 2 ሰዓት" },
    { label: "ሥልጠና", value: "ተግባራዊ እና ሙያ ተኮር" },
    { label: "ውጤት", value: "እውነተኛ የኤዲቲንግ ፕሮጀክቶች" },
  ],
  programmeDescription:
    "ተማሪዎች በእውነተኛ የኤዲቲንግ ፕሮጀክቶች አማካኝነት ፍጥነት፣ ድምፅ፣ የትርጉም ጽሑፍ፣ ቀለም እና ማጠናቀቅን እየተለማመዱ ይማራሉ።",
  opportunityNote: "ዝግጁ የሆኑ ተማሪዎች ተስማሚ ፕሮጀክቶች ሲኖሩ ከደንበኞች ሥራ ጋር ሊተዋወቁ ይችላሉ።",
  tuition: "የትምህርት ክፍያ",
  originalPrice: "የቀድሞ ዋጋ",
  currency: "ብር",
  register: "ለዚህ ኮርስ ይመዝገቡ",
  loadingCourses: "ኮርሶች በመጫን ላይ",
  loadFail: "የኮርሶቹን ዝርዝር አሁን መጫን አልተቻለም።",
  tryAgain: "እንደገና ይሞክሩ",
  empty: "አሁን የሚገኝ ኮርስ የለም።",
  refreshFail: "አንዳንድ የኮርስ መረጃዎችን ማደስ አልተቻለም።",
  refresh: "አድስ",
  courseList: "ኮርሶች",
};

const STRINGS: Record<Lang, typeof en> = { en, am };

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const revealClass = (visible: boolean) => `courses-reveal${visible ? " courses-visible" : ""}`;

function CourseIcon({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={(e) => {
        const target = e.currentTarget;
        if (!target.src.endsWith(FALLBACK_ICON)) target.src = FALLBACK_ICON;
      }}
      className="h-full w-full object-contain"
    />
  );
}

function CourseSkeleton() {
  return (
    <div className="grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-10" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="animate-pulse border-t border-gray-200 pt-6">
          <div className="h-12 w-12 rounded bg-gray-100" />
          <div className="mt-5 h-7 w-44 rounded bg-gray-100" />
          <div className="mt-4 h-20 rounded bg-gray-100" />
          <div className="mt-6 h-8 w-36 rounded bg-gray-100" />
          <div className="mt-4 h-12 rounded-md bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function Courses({ onApplyWithCourse }: CoursesProps) {
  const { lang } = useLang();
  const t = STRINGS[lang];

  const header = useReveal<HTMLDivElement>(0.12);
  const programme = useReveal<HTMLDivElement>(0.12);
  const grid = useReveal<HTMLDivElement>(0.05);

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
        if (!Array.isArray(data)) throw new Error("Invalid courses response");
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

  const formatBirr = (amount: number) => `${amount.toLocaleString("en-ET")} ${t.currency}`;
  const showSkeleton = loading && courses.length === 0;
  const showLoadError = !loading && error && courses.length === 0;
  const showEmpty = !loading && !error && courses.length === 0;

  return (
    <section
      id="courses"
      lang={lang}
      aria-labelledby="courses-title"
      className="bg-white px-5 py-16 sm:py-20 lg:px-10 lg:py-24"
    >
      <div className="mx-auto max-w-7xl">
        {/* Header (static: never waits for the API) */}
        <div ref={header.ref} className={`max-w-3xl ${revealClass(header.visible)}`}>
          <p className="text-sm font-medium text-gold">{t.badge}</p>

          <h2
            id="courses-title"
            className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight text-navy sm:text-5xl lg:text-6xl"
          >
            {t.heading}
          </h2>

          <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">{t.subheading}</p>
        </div>

        {/* Programme information */}
        <div
          ref={programme.ref}
          className={`mt-10 rounded-2xl bg-warm-white p-5 sm:p-7 lg:mt-12 ${revealClass(programme.visible)}`}
        >
          <div className="grid gap-7 lg:grid-cols-[1.1fr_1.9fr] lg:gap-12">
            <div>
              <p className="text-sm font-medium text-gold">{t.programmeLabel}</p>
              <h3 className="mt-3 text-2xl font-bold text-navy sm:text-3xl">{t.programmeTitle}</h3>
            </div>

            <div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                {t.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="text-xs font-medium text-gray-500">{fact.label}</dt>
                    <dd className="mt-2 text-sm font-semibold leading-5 text-navy">{fact.value}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-5 max-w-3xl text-sm leading-6 text-gray-600">{t.programmeDescription}</p>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">{t.opportunityNote}</p>
            </div>
          </div>
        </div>

        {/* Courses */}
        <div
          ref={grid.ref}
          aria-busy={showSkeleton}
          className={`mt-10 lg:mt-12 ${revealClass(grid.visible)}`}
        >
          {showSkeleton && (
            <>
              <span className="sr-only" role="status">
                {t.loadingCourses}
              </span>
              <CourseSkeleton />
            </>
          )}

          {showLoadError && (
            <div className="rounded-xl bg-warm-white px-5 py-8 text-center" role="alert">
              <p className="text-sm text-gray-600">{t.loadFail}</p>
              <button
                onClick={() => setReloadKey((key) => key + 1)}
                className="action-primary mt-5 inline-flex items-center justify-center"
              >
                {t.tryAgain}
              </button>
            </div>
          )}

          {showEmpty && (
            <div className="py-10 text-center">
              <p className="text-sm text-gray-500">{t.empty}</p>
            </div>
          )}

          {courses.length > 0 && (
            <ul
              role="list"
              aria-label={t.courseList}
              className="grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-10"
            >
              {courses.map((course) => {
                const price = course.discountPrice ?? course.price;
                const title = (lang === "am" && course.titleAm) || course.title;
                const description = (lang === "am" && course.descriptionAm) || course.description;

                return (
                  <li key={course.id} className="min-w-0">
                    <article className="group flex h-full min-w-0 flex-col border-t border-gray-200 pt-6 transition-colors duration-300 hover:border-gold">
                      <div className="flex h-12 w-12 items-center justify-center">
                        <CourseIcon src={COURSE_ICONS[course.id] ?? FALLBACK_ICON} />
                      </div>

                      <div className="mt-5 flex-1">
                        <h3 className="max-w-xs text-2xl font-bold leading-tight text-navy">{title}</h3>
                        <p className="mt-3 text-base leading-7 text-gray-600">{description}</p>
                      </div>

                      <div className="mt-6">
                        <p className="text-sm text-gray-500">{t.tuition}</p>

                        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="text-2xl font-bold text-navy">{formatBirr(price)}</span>
                          {course.discountPrice && (
                            <s className="text-sm text-gray-500">
                              <span className="sr-only">{t.originalPrice}: </span>
                              {formatBirr(course.price)}
                            </s>
                          )}
                        </div>

                        {course.discountLabel && (
                          <p className="mt-1 text-xs font-medium text-emerald-700">{course.discountLabel}</p>
                        )}

                        <button
                          type="button"
                          onClick={() => onApplyWithCourse(course.title)}
                          className="action-secondary mt-5 inline-flex w-full items-center justify-center gap-2"
                        >
                          <span>{t.register}</span>
                          <ArrowRight
                            size={16}
                            className="transition-transform duration-200 group-hover:translate-x-1"
                          />
                        </button>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Background refresh failed but we still have a list to show */}
          {!loading && error && courses.length > 0 && (
            <div className="mt-10 border-l-2 border-gold bg-warm-white px-5 py-4" role="status">
              <p className="text-sm text-gray-600">{t.refreshFail}</p>
              <button
                onClick={() => setReloadKey((key) => key + 1)}
                className="mt-2 inline-flex min-h-11 items-center text-xs font-semibold text-navy underline underline-offset-4 hover:text-gold"
              >
                {t.refresh}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
