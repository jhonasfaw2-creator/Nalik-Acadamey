"use client";

import { Container } from "@/components/ui/Container";
import { FadeUp } from "@/components/motion/FadeUp";
import { FadeIn } from "@/components/motion/FadeIn";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { BookOpen, Repeat, Layers, Rocket } from "lucide-react";
import { useSiteContent } from "@/lib/hooks/use-site-content";

const STEP_ICONS = [BookOpen, Repeat, Layers, Rocket];

export function CareerPath() {
  const prefersReduced = useReducedMotion();
  const { career_path } = useSiteContent();

  const steps = [
    { icon: STEP_ICONS[0], label: career_path.step1Label || "Learn", description: career_path.step1Desc || "Master the fundamentals of video editing, motion design, and creative storytelling through structured lessons." },
    { icon: STEP_ICONS[1], label: career_path.step2Label || "Practice", description: career_path.step2Desc || "Reinforce your skills with hands-on exercises and real-world editing challenges that build muscle memory." },
    { icon: STEP_ICONS[2], label: career_path.step3Label || "Build Your Skills", description: career_path.step3Desc || "Develop a polished portfolio of professional-quality edits that showcase your creative and technical range." },
    { icon: STEP_ICONS[3], label: career_path.step4Label || "Become Work-Ready", description: career_path.step4Desc || "Graduate with the confidence, workflows, and industry knowledge to take on freelance or team-based editing work." },
  ];

  return (
    <section id="career-path" className="bg-navy py-24 sm:py-32">
      <Container>
        <FadeUp>
          <div className="mb-16 text-center">
            <div className="mx-auto mb-5 inline-block h-1 w-10 bg-gold" />
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">
              {career_path.title || "Your Path to"}{" "}
              <span className="text-gold">{career_path.titleHighlight || "Work-Ready"}</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/50">
              {career_path.subtitle || "Nalik Academy focuses on developing strong video-editing skills and preparing students for career opportunities in the creative industry."}
            </p>
          </div>
        </FadeUp>

        <div className="relative mx-auto max-w-3xl">
          <div className="absolute left-6 top-0 hidden h-full w-px bg-gradient-to-b from-gold/40 via-gold/20 to-transparent sm:block" />

          <Stagger stagger="slow" delay={0.2}>
            {steps.map((step, index) => (
              <StaggerItem key={step.label}>
                <motion.div
                  className="group relative mb-12 last:mb-0 sm:mb-16"
                  {...(prefersReduced
                    ? {}
                    : {
                        whileHover: { x: 4 },
                        transition: {
                          type: "spring",
                          stiffness: 400,
                          damping: 25,
                        },
                      })}
                >
                  <div className="flex gap-5 sm:gap-8">
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-gold/30 bg-navy text-gold transition-colors duration-200 group-hover:border-gold/60 group-hover:bg-gold/10">
                        <step.icon className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                    </div>

                    <div className="flex-1 pt-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold/60">
                          Step {String(index + 1).padStart(2, "0")}
                        </span>
                      </div>
                      <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">
                        {step.label}
                      </h3>
                      <p className="mt-3 max-w-md text-base leading-relaxed text-white/50">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {index < steps.length - 1 && (
                    <div className="ml-[23px] mt-4 hidden h-4 w-px bg-gradient-to-b from-gold/20 to-transparent sm:ml-[23px]" />
                  )}
                </motion.div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <FadeIn delay={0.6} y={16}>
          <div className="mx-auto mt-16 max-w-2xl rounded-sm border border-gold/20 bg-gold/[0.04] px-6 py-5 sm:px-8 sm:py-6">
            <p className="text-center text-sm leading-relaxed text-white/60 sm:text-base">
              <span className="font-semibold text-gold">Note: </span>
              {career_path.note || "High-performing students may have opportunities to be connected with potential first clients through the academy\u2019s network. This is an opportunity, not a guarantee."}
            </p>
          </div>
        </FadeIn>
      </Container>
    </section>
  );
}
