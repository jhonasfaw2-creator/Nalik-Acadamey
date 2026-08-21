"use client";

import { Container } from "@/components/ui/Container";
import { FadeUp } from "@/components/motion/FadeUp";
import { useApplicationModal } from "@/components/application/ApplicationContext";
import { useSiteContent } from "@/lib/hooks/use-site-content";

export function FinalCTA() {
  const { final_cta } = useSiteContent();

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-cover"
          poster={final_cta.poster || "/images/general/editing-workspace.jpg"}
        >
          <source src={final_cta.video || "/videos/hero.mp4"} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-navy/80" />
        <div className="absolute inset-0 bg-gradient-to-b from-navy/40 via-navy/60 to-navy/90" />
      </div>

      <Container className="relative z-10 py-28 sm:py-36">
        <FadeUp>
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-8 h-px w-16 bg-gold/60" />

            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">
              {final_cta.heading || "Ready to Start Editing?"}
            </h2>

            <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-white/60">
              {final_cta.description ||
                "Develop professional video-editing skills and bring your creative vision to life with hands-on training from industry experts."}
            </p>

            <div className="mt-10">
              <FinalCTAButton text={final_cta.cta || "Join Nalik Academy"} />
            </div>
          </div>
        </FadeUp>
      </Container>
    </section>
  );
}

function FinalCTAButton({ text }: { text: string }) {
  const { openModal } = useApplicationModal();

  return (
    <button
      type="button"
      onClick={openModal}
      className="group inline-flex h-12 items-center rounded bg-gold px-8 text-sm font-semibold text-navy shadow-lg shadow-gold/20 transition-all duration-200 hover:bg-gold/90 hover:shadow-gold/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      {text}
      <svg
        className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </button>
  );
}
