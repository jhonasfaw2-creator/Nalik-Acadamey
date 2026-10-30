"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const CREATORS = [
  { name: "Lofty Haron", role: "Streamer", image: "/assets/Collabritors/Loftyharon.jpeg", tiktok: "", instagram: "" },
  { name: "Seyoum Tad", role: "Streamer", image: "/assets/Collabritors/SeyoumTad.jpeg", tiktok: "", instagram: "" },
  { name: "Natty2cold", role: "Streamer", image: "/assets/Collabritors/Natty2cold.jpeg", tiktok: "", instagram: "" },
  { name: "Kaya Faya", role: "Streamer", image: "/assets/Collabritors/Kayafaya.jpeg", tiktok: "", instagram: "" },
  { name: "Shiro B", role: "Creator & Host", image: "/assets/Collabritors/shirobaee.png", tiktok: "", instagram: "" },
  { name: "TAT", role: "Streamer", image: "/assets/Collabritors/TAT.jpeg", tiktok: "", instagram: "" },
  { name: "Lil Kidus", role: "Creator & Stylist", image: "/assets/Collabritors/LilKidus.jpg", tiktok: "", instagram: "" },
  { name: "Jahnny", role: "Vlogger & YouTuber", image: "/assets/Collabritors/jahnny.jpeg", tiktok: "", instagram: "" },
];

const BUSINESSES = [
  { name: "Salt Burger", role: "Cafe & Hospitality", image: "/assets/Collabritors/SaltBurger.jpeg" },
  { name: "Yorgo", role: "Business", image: "/assets/Collabritors/Yorgo.jpeg" },
];

export default function Collaborations() {
  const sectionRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !mounted) return;

    el.classList.add("reveal", "stagger-children");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted]);

  return (
    <section
      id="collaborations"
      ref={sectionRef}
      className="relative overflow-hidden bg-warm-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div className="relative mx-auto max-w-5xl">
        {/* Header */}
        <div className="reveal-child mx-auto max-w-xl text-center">
          <p className="text-sm font-medium text-gold">
            Client Work
          </p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-navy sm:text-4xl">
            Selected collaborations
          </h2>
          <p className="mt-3 text-base text-gray-500">
            Freelance video editing for streamers, content creators, and
            businesses, made for social media.
          </p>
        </div>

        {/* Creators and streamers */}
        <div className="reveal-child mt-10">
          <p className="text-sm font-medium text-gray-500">
            Creators &amp; Streamers
          </p>
          <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {CREATORS.map((creator, i) => (
              <CastCard key={creator.name} creator={creator} index={i} />
            ))}

            {/* Invitation tile */}
            <article className="reveal-child flex flex-col items-start justify-center p-2 text-left">
              <p className="text-base font-semibold text-navy">Have a project in mind?</p>
              <Link href="/#contact" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-gold hover:text-gold-hover focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-warm-white">
                Start a project
                <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </article>
          </div>
        </div>

        {/* Brands and businesses */}
        <div className="reveal-child mt-10">
          <p className="text-sm font-medium text-gray-500">
            Brands &amp; Businesses
          </p>
          <div className="mx-auto mt-6 grid max-w-[300px] grid-cols-2 gap-x-5 sm:max-w-[340px]">
            {BUSINESSES.map((business) => (
              <article
                key={business.name}
                className="text-center"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-sm">
                  <Image
                    src={business.image}
                    alt={business.name}
                    fill
                    sizes="(max-width: 640px) 140px, 160px"
                    className="object-cover"
                  />
                </div>
                <p className="mt-2 text-sm font-semibold text-navy">{business.name}</p>
                <p className="text-xs text-gray-500">{business.role}</p>
              </article>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

function CastCard({
  creator,
  index,
}: {
  creator: (typeof CREATORS)[number];
  index: number;
}) {
  return (
    <article
      className="reveal-child mx-auto w-full max-w-[140px] text-center"
      style={{ transitionDelay: `${(index % 4) * 0.06}s` }}
    >
        <div className="relative aspect-square overflow-hidden rounded-sm">
        <Image
          src={creator.image}
          alt={creator.name}
          fill
          sizes="(max-width: 640px) 126px, 140px"
          className="object-cover"
        />

      </div>

      {/* Name below photo */}
      <h3 className="mt-3 text-base font-semibold tracking-tight text-navy sm:text-lg">
        {creator.name}
      </h3>
      <p className="mt-0.5 text-sm text-gray-500">
        {creator.role}
      </p>
    </article>
  );
}
