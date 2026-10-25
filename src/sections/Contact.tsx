"use client";

import { useEffect, useState } from "react";
import { ArrowRight, MapPin, Navigation, Phone, Search } from "lucide-react";

interface ContactProps {
  onApplyClick: () => void;
}

const DEFAULTS = {
  phone: "+251979989079",
};

const LEGACY_CONTACT_PHONES = new Set(["251911223344"]);

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
const MAP_EMBED_URL = `https://maps.google.com/maps?q=${MAPS_COORDS}&z=18&output=embed`;
const PLACE_LABEL = `${LOCATION.name}, ${LOCATION.building}, ${LOCATION.area}`;

function getTelephoneHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const international = digits.startsWith("251")
    ? digits
    : `251${digits.startsWith("0") ? digits.slice(1) : digits}`;
  return `tel:+${international}`;
}

export default function Contact({ onApplyClick }: ContactProps) {
  const [content, setContent] = useState(DEFAULTS);

  useEffect(() => {
    fetch("/api/content?section=contact")
      .then((r) => r.json())
      .then((d) => {
        const phone = typeof d?.phone === "string" ? d.phone.trim() : "";
        const digits = phone.replace(/\D/g, "");
        const canonicalPhone = digits.startsWith("251")
          ? digits
          : digits.startsWith("0")
            ? `251${digits.slice(1)}`
            : digits;
        if (phone && !LEGACY_CONTACT_PHONES.has(canonicalPhone)) setContent({ phone });
      })
      .catch(() => {});
  }, []);

  return (
    <section id="contact" aria-labelledby="contact-title" className="bg-warm-white px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-2xl">
          <p className="text-sm font-medium text-gold">Contact the academy</p>
          <h2 id="contact-title" className="mt-3 text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
            Talk through your next step.
          </h2>
          <p className="mt-3 text-[15px] leading-6 text-gray-600 sm:text-base sm:leading-7">
            Ask about a course, admissions, or visiting us in Addis Ababa. We&apos;ll help you find the right next step.
          </p>
        </header>

        <div className="mt-9 grid gap-5 lg:mt-11 lg:grid-cols-[0.82fr_1.18fr] lg:gap-7">
          <div className="flex flex-col rounded-2xl bg-navy p-6 text-white sm:p-8">
            <p className="text-sm font-medium text-gold">Speak with our team</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Call the academy</h3>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/70">
              Have a question about courses or registration? Give us a call.
            </p>

            <a
              href={getTelephoneHref(content.phone)}
              className="mt-6 inline-flex min-h-11 items-center gap-2 self-start text-lg font-semibold text-white underline decoration-white/30 underline-offset-4 transition-colors hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold sm:text-xl"
            >
              <Phone size={18} className="shrink-0 text-gold" aria-hidden="true" />
              <span className="break-all">{content.phone}</span>
            </a>

            <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-8">
              <button
                type="button"
                onClick={onApplyClick}
                className="action-primary group inline-flex items-center gap-2"
              >
                Register now
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
              <a
                href="/registration"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-white/80 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                <Search size={15} aria-hidden="true" />
                Check registration
              </a>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 ring-1 ring-navy/10 sm:p-5">
            <div className="flex flex-col gap-4 px-1 pb-4 sm:flex-row sm:items-start sm:justify-between sm:px-2">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warm-white text-gold">
                  <MapPin size={18} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-500">Visit us</p>
                  <p className="mt-1 font-semibold text-navy">{LOCATION.building}, {LOCATION.floor}</p>
                  <p className="mt-0.5 text-sm text-gray-600">{LOCATION.area}, {LOCATION.city}, {LOCATION.country}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 pl-[3.25rem] sm:pl-0">
                <a
                  href={LOCATION.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center text-sm font-medium text-navy underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  Open map
                </a>
                <a
                  href={DIRECTIONS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-navy underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  <Navigation size={14} aria-hidden="true" />
                  Get directions
                </a>
              </div>
            </div>

            <div className="relative aspect-[4/3] min-h-[240px] overflow-hidden rounded-xl bg-gray-100 sm:aspect-[16/10] sm:min-h-[300px]">
              <iframe
                src={MAP_EMBED_URL}
                title={`Map showing ${PLACE_LABEL}`}
                className="absolute inset-0 h-full w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
