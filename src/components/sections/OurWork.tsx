"use client";

import { Container } from "@/components/ui/Container";
import { FadeUp } from "@/components/motion/FadeUp";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { VideoCard } from "@/components/portfolio/VideoCard";
import { useSiteContent } from "@/lib/hooks/use-site-content";
import { useEffect, useState } from "react";

interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  videoSrc: string;
  posterImage: string;
}

// Fallback data when database is empty
const FALLBACK_ITEMS: PortfolioItem[] = [
  { id: "portfolio-1", title: "Cinematic Brand", description: "Cinematic edit blending narrative pacing with visual storytelling.", videoSrc: "/videos/cinmatic vedio.mp4", posterImage: "" },
  { id: "portfolio-2", title: "Brand Focus", description: "Brand-focused content crafted for social media impact.", videoSrc: "/videos/brand focused.mp4", posterImage: "" },
  { id: "portfolio-3", title: "Showcase Reel", description: "A fast-paced reel showcasing editing rhythm and motion.", videoSrc: "/videos/shortshow.mp4", posterImage: "" },
  { id: "portfolio-4", title: "Content Edit", description: "Engaging short-form content built for viral reach.", videoSrc: "/videos/showcase.mp4", posterImage: "" },
];

export function OurWork() {
  const { our_work } = useSiteContent();
  const [items, setItems] = useState<PortfolioItem[]>(FALLBACK_ITEMS);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/portfolio");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.items?.length) {
          setItems(data.items.map((item: Record<string, unknown>) => ({
            id: item.id as string,
            title: item.title as string,
            description: item.description as string,
            videoSrc: (item.videoSrc || item.video_src) as string,
            posterImage: (item.posterImage || item.poster_image) as string,
          })));
        }
      } catch {
        // use fallback
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <section id="work" className="bg-navy py-24 sm:py-32">
      <Container>
        <FadeUp>
          <div className="mb-16 text-center">
            <div className="mx-auto mb-5 inline-block h-1 w-10 bg-gold" />
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">
              {our_work.title || "Work That"}{" "}
              <span className="text-gold">{our_work.titleHighlight || "Inspires."}</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/50">
              {our_work.subtitle || "A look at the projects we have created. Real edits, built for real audiences."}
            </p>
          </div>
        </FadeUp>

        <Stagger stagger="base">
          <div className="grid gap-5 sm:gap-6 md:grid-cols-2">
            {items.map((item) => (
              <StaggerItem key={item.id}>
                <VideoCard item={item} />
              </StaggerItem>
            ))}
          </div>
        </Stagger>
      </Container>
    </section>
  );
}
