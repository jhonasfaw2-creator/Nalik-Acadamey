"use client";

import { useEffect, useState } from "react";
import { ArrowRight, MapPin, Navigation, Phone, Search } from "lucide-react";

interface ContactProps {
  onApplyClick: () => void;
}

const DEFAULTS = {
  phone: "+251 911 223 344",
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
  const [content, setContent] = useState(DEFAULTS);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/content?section=contact")
      .then((r) => r.json())
      .then((d) => {
        if (d.phone) setContent({ phone: d.phone });
      })
      .catch(() => {});
  }, []);

  return (
    <section id="contact" className="bg-warm-white px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-2xl">
          <p className="text-sm font-medium text-gold">Contact</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
            Speak with the academy.
          </h2>
          <p className="mt-3 text-[15px] leading-6 text-gray-600 sm:text-base sm:leading-7">
            For course questions, admissions, or a quick conversation about your next step, we&apos;re here to help.
          </p>
        </header>

        <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-12">
          <div className="flex flex-col">
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <Phone size={18} className="mt-1 shrink-0 text-gold" />
                <div>
                  <p className="text-sm text-gray-500">Call us</p>
                  <a href={`tel:${content.phone.replace(/\s/g, "")}`} className="mt-1 inline-block text-base font-semibold text-navy transition-colors hover:text-gold focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-warm-white">
                    {content.phone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin size={18} className="mt-1 shrink-0 text-gold" />
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="mt-1 text-base font-semibold text-navy">{LOCATION.building}, {LOCATION.floor}</p>
                  <p className="text-sm text-gray-600">{LOCATION.area}, {LOCATION.city}, {LOCATION.country}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
              <button
                type="button"
                onClick={onApplyClick}
                className="action-primary group inline-flex items-center gap-2"
              >
                Register Now
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </button>

              <a
                href="/registration"
                className="inline-flex min-h-11 items-center gap-2 py-2 text-sm font-medium text-navy underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gold focus-visible:ring-2 focus-visible:ring-gold"
              >
                <Search size={15} />
                Check Registration
              </a>

            </div>
          </div>

          <div>
            <div className="mb-2 flex min-h-11 flex-wrap items-center justify-between gap-x-3">
              <p className="text-sm font-medium text-gray-600">Find us in Addis Ababa</p>
              <div className="flex items-center gap-4">
                <a
                  href={LOCATION.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center text-sm font-medium text-gold hover:text-gold-hover focus-visible:ring-2 focus-visible:ring-gold"
                >
                  Open map
                </a>
                <a
                  href={DIRECTIONS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-navy hover:text-gold focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <Navigation size={14} aria-hidden="true" />
                  Get directions
                </a>
              </div>
            </div>

            <div className="relative aspect-[4/3] min-h-[240px] overflow-hidden rounded-lg bg-navy sm:aspect-[16/10] sm:min-h-[280px]">
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
                  className="group absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"
                >
                  <span className="flex h-11 w-11 items-center justify-center text-gold">
                    <MapPin size={20} />
                  </span>
                  <span className="text-sm font-semibold text-white/90">Show map</span>
                  <span className="text-xs text-white/60">{LOCATION.plusCode} · {LOCATION.area}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
