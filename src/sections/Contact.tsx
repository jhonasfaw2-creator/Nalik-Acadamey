"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, Mail, MessageCircle, ArrowRight, MapPin } from "lucide-react";

interface ContactProps {
  onApplyClick: () => void;
}

const SOCIAL_SVGS: Record<string, string> = {
  facebook: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z",
  instagram: "M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z",
  youtube: "M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.43zM9.75 15.02V8.48l5.75 3.27-5.75 3.27z",
  tiktok: "M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.69a8.28 8.28 0 0 0 4.76 1.5v-3.4a4.85 4.85 0 0 1-1-.1z",
  telegram: "M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z",
};

const DEFAULTS = {
  phone: "+251 911 223 344",
  whatsapp: "+251911223344",
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
            whatsapp: d.whatsapp || DEFAULTS.whatsapp,
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
      label: "WhatsApp",
      value: "Message us",
      href: `https://wa.me/${content.whatsapp.replace(/[^0-9]/g, "")}`,
      icon: MessageCircle,
      color: "bg-green-50 text-green-600",
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

  const socialLinks = [
    { label: "Facebook", href: content.facebook, path: SOCIAL_SVGS.facebook },
    { label: "Instagram", href: content.instagram, path: SOCIAL_SVGS.instagram },
    { label: "YouTube", href: content.youtube, path: SOCIAL_SVGS.youtube },
    { label: "TikTok", href: "#", path: SOCIAL_SVGS.tiktok },
    { label: "Telegram", href: content.telegram, path: SOCIAL_SVGS.telegram },
  ];

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
