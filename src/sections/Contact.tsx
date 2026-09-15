"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, MapPin, Navigation, Phone } from "lucide-react";
import { SOCIAL_LINKS } from "@/lib/socials";

interface ContactProps {
  onApplyClick: () => void;
}

const DEFAULTS = {
  phone: "+251 911 223 344",
  facebook: "https://facebook.com/nalikacademy",
  instagram: "https://instagram.com/nalikacademy",
  youtube: "https://youtube.com/@nalikacademy",
  telegram: "https://t.me/nalikacademy",
};

const LOCATION = {
  name: "Nalik Academy",
  building: "Yeab Building",
  floor: "5th Floor",
  area: "Haya Hulet",
  city: "Addis Ababa",
  country: "Ethiopia",
  plusCode: "XQJ4+95",
  lat: 8.9809109,
  lng: 38.7554393,
  mapsUrl: "https://maps.app.goo.gl/26zbvuqd1VrzoSPE8",
} as const;

const MAPS_COORDS = `${LOCATION.lat},${LOCATION.lng}`;
const DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${MAPS_COORDS}`;
const MAP_EMBED_URL = `https://maps.google.com/maps?q=${MAPS_COORDS}&z=17&output=embed`;
const PLACE_LABEL = `${LOCATION.name}, ${LOCATION.building}, ${LOCATION.area}`;

export default function Contact({ onApplyClick }: ContactProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState(DEFAULTS);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/content?section=contact")
      .then((r) => r.json())
      .then((d) => {
        if (d.phone || d.facebook) {
          setContent({
            phone: d.phone || DEFAULTS.phone,
            facebook: d.facebook || DEFAULTS.facebook,
            instagram: d.instagram || DEFAULTS.instagram,
            youtube: d.youtube || DEFAULTS.youtube,
            telegram: d.telegram || DEFAULTS.telegram,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    el.classList.add("reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const socialLinks = SOCIAL_LINKS.map((link) => ({
    label: link.label,
    href: {
      facebook: content.facebook,
      instagram: content.instagram,
      youtube: content.youtube,
      telegram: content.telegram,
    }[link.label.toLowerCase()] || link.href,
    path: link.icon,
  }));

  return (
    <section id="contact" ref={sectionRef} className="bg-warm-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div ref={panelRef} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_12px_28px_rgba(15,23,42,0.04)]">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:p-10">
            <div className="flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">Contact</p>
                <h2 className="mt-3 max-w-md text-3xl font-bold tracking-tight text-navy sm:text-4xl">
                  Speak with the academy.
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-gray-600 sm:text-base">
                  For course questions, admissions, or a quick conversation about your next step, we&apos;re here to help.
                </p>
              </div>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-warm-white p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
                    <Phone size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Call us</p>
                    <a href={`tel:${content.phone.replace(/\s/g, "")}`} className="mt-1 inline-block text-base font-semibold text-navy transition-colors hover:text-gold">
                      {content.phone}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-warm-white p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Location</p>
                    <p className="mt-1 text-base font-semibold text-navy">{LOCATION.building}, {LOCATION.floor}</p>
                    <p className="text-sm text-gray-600">{LOCATION.area}, {LOCATION.city}, {LOCATION.country}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onApplyClick}
                  className="group inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-3 text-sm font-bold uppercase tracking-[0.12em] text-navy transition-all duration-200 hover:bg-gold-hover"
                >
                  Register Now
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </button>

                <a
                  href={DIRECTIONS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-bold uppercase tracking-[0.12em] text-navy transition-colors hover:border-gold hover:text-gold"
                >
                  <Navigation size={15} />
                  Get Directions
                </a>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-warm-white">
              <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Location preview</p>
                <a
                  href={LOCATION.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold uppercase tracking-[0.12em] text-gold hover:text-gold-hover"
                >
                  Open map
                </a>
              </div>

              <div className="relative min-h-[260px] bg-navy sm:min-h-[280px]">
                {mapLoaded ? (
                  <iframe
                    src={MAP_EMBED_URL}
                    title={`Map showing ${PLACE_LABEL}`}
                    className="absolute inset-0 h-full w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setMapLoaded(true)}
                    aria-label={`Load map preview for ${PLACE_LABEL}`}
                    className="group absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"
                  >
                    <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gold text-navy shadow-lg transition-transform duration-300 group-hover:scale-105">
                      <MapPin size={20} />
                    </span>
                    <span className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">
                      Show map
                    </span>
                    <span className="relative text-xs text-white/50">
                      {LOCATION.plusCode} · {LOCATION.area}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-gray-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Follow us</p>
            <div className="flex items-center gap-2">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-all duration-200 hover:border-gold hover:bg-gold/5 hover:text-gold"
                  aria-label={link.label}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d={link.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
