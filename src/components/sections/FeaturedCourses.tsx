"use client";

import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { FadeUp } from "@/components/motion/FadeUp";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { useSiteContent } from "@/lib/hooks/use-site-content";
import { COURSES, type Course } from "@/data/courses";

export function FeaturedCourses() {
  const prefersReduced = useReducedMotion();
  const { featured_courses } = useSiteContent();

  return (
    <section id="courses" className="bg-white py-24 sm:py-32">
      <Container>
        {/* ── Header ─────────────────────────────── */}
        <FadeUp>
          <div className="mb-16 text-center">
            <span className="mb-5 inline-block text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              {featured_courses.eyebrow || "Our Programs"}
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl lg:text-[2.75rem]">
              {featured_courses.heading || "Learn. Create. Master."}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {featured_courses.subtitle ||
                "Two focused programs designed to take you from beginner to professional editor."}
            </p>
          </div>
        </FadeUp>

        {/* ── Course Cards ───────────────────────── */}
        <Stagger stagger="base" delay={0.15}>
          <div className="grid gap-8 sm:grid-cols-2 lg:gap-12">
            {COURSES.map((course) => (
              <StaggerItem key={course.slug}>
                <CourseCard
                  course={course}
                  prefersReduced={prefersReduced}
                />
              </StaggerItem>
            ))}
          </div>
        </Stagger>

      </Container>
    </section>
  );
}

/* ── Single Course Card ──────────────────────────── */

function CourseCard({
  course,
  prefersReduced,
}: {
  course: Course;
  prefersReduced: boolean;
}) {
  return (
    <motion.article
      className="group relative overflow-hidden border border-navy/8 bg-white"
      {...(prefersReduced
        ? {}
        : {
            whileHover: { y: -4 },
            transition: { type: "spring", stiffness: 400, damping: 25 },
          })}
    >
      {/* ── Image ─────────────────────────────── */}
      <div className="relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden bg-navy p-8">
        <Image
          src={course.image}
          alt={course.imageAlt}
          width={160}
          height={160}
          sizes="(max-width: 640px) 120px, 160px"
          className="h-auto w-auto object-contain transition-transform duration-500 ease-out group-hover:scale-105"
        />
        {/* Level badge */}
        <span className="absolute left-4 top-4 rounded bg-navy/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
          {course.tag}
        </span>
      </div>

      {/* ── Content ────────────────────────────── */}
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
          <span>{course.level}</span>
          <span className="h-px w-3 bg-navy/15" />
          <span>{course.duration}</span>
        </div>

        <h3 className="mt-3 text-xl font-bold tracking-tight text-navy sm:text-2xl">
          {course.title}
        </h3>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {course.description}
        </p>


      </div>
    </motion.article>
  );
}
