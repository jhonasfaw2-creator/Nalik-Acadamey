"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, Mail, ArrowRight, MapPin } from "lucide-react";
import { SOCIAL_LINKS } from "@/lib/socials";

interface ContactProps {
  onApplyClick: () => void;
}

const DEFAULTS = {
  phone: "+251 911 223 344",
  email: "info@nalikacademy.com",
  location: "Addis Ababa, Ethiopia",
  facebook: "https://facebook.com/nalikacademy",
  instagram: "https://instagram.com/nalikacademy",
  youtube: "https://youtube.com/@nalikacademy",
  telegram: "https://t.me/nalikacademy",
};

export default function Contact({ onApplyClick }: ContactProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState(DEFAULTS);

  useEffect(() => {
    fetch("/api/content?section=contact")
      .then((r) => r.json())
      .then((d) => {
        if (d.phone || d.email) {
          setContent({
            phone: d.phone || DEFAULTS.phone,
            email: d.email || DEFAULTS.email,
            location: d.location || DEFAULTS.location,
            facebook: d.facebook || DEFAULTS.facebook,
            instagram: d.instagram || DEFAULTS.instagram,
            youtube: d.youtube || DEFAULTS.youtube,
            telegram: d.telegram || DEFAULTS.telegram,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Scroll reveal
  useEffect(() => {
    const el = cardRef.current;
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
    return () => observer.unobserve(el);
  }, []);

  const contactChannels = [
    {
      label: "Call Us",
      value: content.phone,
      href: `tel:${content.phone.replace(/\s/g, "")}`,
      icon: Phone,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Email",
      value: content.email,
      href: `mailto:${content.email}`,
      icon: Mail,
      color: "bg-amber-50 text-amber-600",
    },
    {
      label: "Visit",
      value: content.location,
      href: "https://maps.app.goo.gl/CgbFhJJYRSGMnWbg8",
      icon: MapPin,
      color: "bg-purple-50 text-purple-600",
    },
  ];

  // CMS can override social URLs; icons + default URLs come from the shared
  // module so Footer and Contact never drift apart.
  const socialHrefOverrides: Record<string, string> = {
    facebook: content.facebook,
    instagram: content.instagram,
    youtube: content.youtube,
    telegram: content.telegram,
  };
  const socialLinks = SOCIAL_LINKS.map((link) => ({
    label: link.label,
    href: socialHrefOverrides[link.label.toLowerCase()] || link.href,
    path: link.icon,
  }));

  return (
    <section id="contact" ref={sectionRef} className="bg-warm-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div ref={cardRef} className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]">
          {/* Header */}
          <div className="bg-navy px-6 py-8 text-center sm:px-10 sm:py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold/80">Get in Touch</p>
            <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Let&apos;s create something <span className="text-gold">together</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/50">
              For course enquiries, business collaborations, or production work — reach out through any channel below.
            </p>
          </div>

          {/* Contact channels grid */}
          <div className="grid grid-cols-1 gap-px bg-gray-100 sm:grid-cols-2">
            {contactChannels.map((ch) => {
              const Icon = ch.icon;
              return (
                <a
                  key={ch.label}
                  href={ch.href}
                  target={ch.href.startsWith("http") ? "_blank" : undefined}
                  rel={ch.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="group flex items-center gap-4 bg-white px-6 py-5 transition-colors hover:bg-warm-white sm:px-8"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ch.color} transition-transform group-hover:scale-110`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{ch.label}</p>
                    <p className="mt-0.5 truncate text-sm font-medium text-navy transition-colors group-hover:text-gold">{ch.value}</p>
                  </div>
                </a>
              );
            })}
          </div>

          {/* CTA + Social */}
          <div className="flex flex-col items-center gap-6 bg-warm-white px-6 py-8 sm:px-10 sm:py-10">
            {/* Register button */}
            <button
              onClick={onApplyClick}
              className="group inline-flex items-center gap-2.5 rounded-xl bg-gold px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-navy shadow-md shadow-gold/15 transition-all duration-200 hover:bg-gold-hover hover:shadow-lg hover:shadow-gold/25"
            >
              Register Now
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </button>

            {/* Divider */}
            <div className="flex w-full max-w-xs items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">or follow us</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            {/* Social row */}
            <div className="flex gap-2">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 transition-all duration-200 hover:border-gold hover:bg-gold/5 hover:text-gold hover:shadow-sm"
                  aria-label={link.label}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
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
