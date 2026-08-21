"use client";

import { ChevronDown } from "lucide-react";
import { BackgroundVideo } from "@/components/video/BackgroundVideo";
import { FadeIn } from "@/components/motion/FadeIn";
import { MOTION } from "@/components/motion/constants";
import { useApplicationModal } from "@/components/application/ApplicationContext";
import { useSiteContent } from "@/lib/hooks/use-site-content";

export function Hero() {
  const { openModal } = useApplicationModal();
  const { hero } = useSiteContent();

  return (
    <section id="home" className="relative h-[100dvh] min-h-[600px]">
      <BackgroundVideo
        src={hero.video || "/videos/hero.mp4"}
        poster={hero.poster || "/images/general/hero-poster.jpg"}
        overlayOpacity={0.65}
        className="h-full"
      >
        <div className="flex h-[100dvh] min-h-[600px] flex-col items-center justify-center px-5 text-center">
          <div className="mx-auto max-w-3xl">
            <FadeIn delay={0.1} duration="fast" y={MOTION.offset.xs}>
              <span className="mb-6 inline-block rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                {hero.badge || "Nalik Academy | Creative Learning"}
              </span>
            </FadeIn>

            <FadeIn delay={0.25} duration="base" y={MOTION.offset.md}>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
                {hero.heading || "Edit Your Vision."}
                <br />
                <span className="text-gold">
                  {hero.headingHighlight || "Create Your Future."}
                </span>
              </h1>
            </FadeIn>

            <FadeIn delay={0.4} duration="base" y={MOTION.offset.sm}>
              <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/50 sm:text-lg">
                {hero.description ||
                  "Master video editing, motion graphics, and creative technology with hands-on courses designed to launch your career in the creative industry."}
              </p>
            </FadeIn>

            <FadeIn delay={0.55} duration="base" y={MOTION.offset.sm}>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    const raw = (hero.ctaPrimaryLink || "/#courses");
                    // Strip leading slash and hash, extract last path segment
                    const id = raw.replace(/^\//, "").replace(/^#/, "").split("/").pop() || "program";
                    // Map plural names to actual section IDs
                    const sectionId = id === "programs" ? "program" : id;
                    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="inline-flex h-12 items-center rounded bg-gold px-7 text-sm font-semibold text-navy transition-colors duration-150 hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  {hero.ctaPrimary || "Explore Courses"}
                </button>
                <button
                  type="button"
                  onClick={openModal}
                  className="inline-flex h-12 items-center rounded border border-white/20 px-7 text-sm font-semibold text-white transition-colors duration-150 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  {hero.ctaSecondary || "Start Learning"}
                </button>
              </div>
            </FadeIn>
          </div>

          <FadeIn delay={0.9} y={0} className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <button
              type="button"
              onClick={() => {
                document.getElementById("about")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="group flex min-h-[44px] flex-col items-center justify-center gap-2 text-white/40 transition-colors hover:text-white/70"
              aria-label="Learn more about us"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em]">
                Scroll
              </span>
              <ChevronDown className="h-4 w-4" />
            </button>
          </FadeIn>
        </div>
      </BackgroundVideo>
    </section>
  );
}
