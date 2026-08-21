"use client";

import { Container } from "@/components/ui/Container";
import { FadeUp } from "@/components/motion/FadeUp";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { Film, Sparkles, Palette, Volume2 } from "lucide-react";
import { useSiteContent } from "@/lib/hooks/use-site-content";

const TOPIC_ICONS = [Film, Sparkles, Palette, Volume2];

export function WhatWeTeach() {
  const prefersReduced = useReducedMotion();
  const { what_we_teach } = useSiteContent();

  const items = [
    {
      icon: TOPIC_ICONS[0],
      title: what_we_teach.item1Title || "Video Editing",
      description:
        what_we_teach.item1Desc ||
        "Precision cuts, pacing, and timeline craft that shape raw footage into a compelling story.",
    },
    {
      icon: TOPIC_ICONS[1],
      title: what_we_teach.item2Title || "Motion Graphics",
      description:
        what_we_teach.item2Desc ||
        "Dynamic animations, text effects, and visual elements that bring energy to every frame.",
    },
    {
      icon: TOPIC_ICONS[2],
      title: what_we_teach.item3Title || "Color Grading",
      description:
        what_we_teach.item3Desc ||
        "Cinematic color correction and grading techniques that set the mood and tone of your work.",
    },
    {
      icon: TOPIC_ICONS[3],
      title: what_we_teach.item4Title || "Audio & Sound",
      description:
        what_we_teach.item4Desc ||
        "Sound design, mixing, and audio cleanup that give your edits a polished, professional finish.",
    },
  ];

  return (
    <section id="what-we-teach" className="bg-warm-white py-24 sm:py-32">
      <Container>
        <FadeUp>
          <div className="mb-16 text-center">
            <span className="mb-5 inline-block text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              {what_we_teach.eyebrow || "What We Teach"}
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl lg:text-[2.75rem]">
              {what_we_teach.heading || "Turn Creativity Into a Skill."}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {what_we_teach.subtitle ||
                "The core disciplines every editor needs to master."}
            </p>
          </div>
        </FadeUp>

        <Stagger stagger="base" delay={0.15}>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {items.map((item) => (
              <StaggerItem key={item.title}>
                <motion.div
                  className="group relative border-t border-navy/10 pt-6"
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
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded border border-gold/20 bg-transparent transition-colors duration-200 group-hover:border-gold/40 group-hover:bg-gold/[0.06]">
                    <item.icon
                      className="h-5 w-5 text-gold"
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3 className="text-lg font-bold text-navy">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </motion.div>
              </StaggerItem>
            ))}
          </div>
        </Stagger>
      </Container>
    </section>
  );
}
