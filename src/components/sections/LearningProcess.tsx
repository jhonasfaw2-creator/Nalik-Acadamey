"use client";

import { Container } from "@/components/ui/Container";
import { FadeUp } from "@/components/motion/FadeUp";
import { FadeIn } from "@/components/motion/FadeIn";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { Compass, GraduationCap, PenTool, Briefcase } from "lucide-react";
import { useSiteContent } from "@/lib/hooks/use-site-content";

const STEP_ICONS = [Compass, GraduationCap, PenTool, Briefcase];

export function LearningProcess() {
  const prefersReduced = useReducedMotion();
  const { learning_process } = useSiteContent();

  const steps = [
    { icon: STEP_ICONS[0], label: learning_process.step1Label || "Choose Your Program", description: learning_process.step1Desc || "Select a program that aligns with your goals \u2014 from DaVinci Resolve to Adobe Premiere Pro \u2014 and start with a clear roadmap." },
    { icon: STEP_ICONS[1], label: learning_process.step2Label || "Learn the Skills", description: learning_process.step2Desc || "Follow structured lessons covering editing fundamentals, motion design, color grading, and creative storytelling." },
    { icon: STEP_ICONS[2], label: learning_process.step3Label || "Practice & Create", description: learning_process.step3Desc || "Apply what you learn through hands-on projects, real footage, and exercises that build professional muscle memory." },
    { icon: STEP_ICONS[3], label: learning_process.step4Label || "Build Your Career", description: learning_process.step4Desc || "Develop a portfolio of polished work and gain the confidence to pursue freelance or team-based editing opportunities." },
  ];

  return (
    <section id="how-you-learn" className="bg-warm-white py-24 sm:py-32">
      <Container>
        <FadeUp>
          <div className="mb-16 text-center">
            <div className="mx-auto mb-5 inline-block h-1 w-10 bg-gold" />
            <h2 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl lg:text-[2.75rem]">
              {learning_process.title || "How You"}{" "}
              <span className="text-gold">{learning_process.titleHighlight || "Learn"}</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {learning_process.subtitle || "A structured, skill-focused journey from first lesson to portfolio-ready editor."}
            </p>
          </div>
        </FadeUp>

        {/* Horizontal Timeline — Desktop */}
        <div className="hidden lg:block">
          <div className="relative mx-auto max-w-5xl">
            <div className="absolute left-0 right-0 top-6 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

            <Stagger stagger="slow" delay={0.2}>
              <div className="grid grid-cols-4 gap-8">
                {steps.map((step, index) => (
                  <StaggerItem key={step.label}>
                    <motion.div
                      className="group relative flex flex-col items-center text-center"
                      {...(prefersReduced
                        ? {}
                        : {
                            whileHover: { y: -4 },
                            transition: {
                              type: "spring",
                              stiffness: 400,
                              damping: 25,
                            },
                          })}
                    >
                      <div className="relative z-10 mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-warm-white text-gold transition-colors duration-200 group-hover:border-gold/60 group-hover:bg-gold/10">
                        <step.icon className="h-5 w-5" strokeWidth={1.5} />
                      </div>

                      <span className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold/60">
                        Step {String(index + 1).padStart(2, "0")}
                      </span>

                      <h3 className="mb-3 text-lg font-bold text-navy">
                        {step.label}
                      </h3>

                      <p className="max-w-[200px] text-sm leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                    </motion.div>
                  </StaggerItem>
                ))}
              </div>
            </Stagger>
          </div>
        </div>

        {/* Vertical Timeline — Mobile / Tablet */}
        <div className="lg:hidden">
          <div className="relative mx-auto max-w-xl">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-gold/40 via-gold/20 to-transparent" />

            <Stagger stagger="slow" delay={0.2}>
              {steps.map((step, index) => (
                <StaggerItem key={step.label}>
                  <motion.div
                    className="group relative mb-12 last:mb-0"
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
                    <div className="flex gap-5">
                      <div className="relative z-10 flex flex-col items-center">
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-gold/30 bg-warm-white text-gold transition-colors duration-200 group-hover:border-gold/60 group-hover:bg-gold/10">
                          <step.icon className="h-5 w-5" strokeWidth={1.5} />
                        </div>
                      </div>

                      <div className="flex-1 pt-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold/60">
                          Step {String(index + 1).padStart(2, "0")}
                        </span>
                        <h3 className="mt-2 text-xl font-bold text-navy sm:text-2xl">
                          {step.label}
                        </h3>
                        <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>

        <FadeIn delay={0.6} y={16}>
          <div className="mx-auto mt-16 max-w-2xl rounded-sm border border-gold/20 bg-gold/[0.04] px-6 py-5 sm:px-8 sm:py-6">
            <p className="text-center text-sm leading-relaxed text-navy/60 sm:text-base">
              {learning_process.note || "Built for skill. Every step is designed to develop your craft \u2014 no shortcuts, just focused, practical learning that prepares you for real creative work."}
            </p>
          </div>
        </FadeIn>
      </Container>
    </section>
  );
}
