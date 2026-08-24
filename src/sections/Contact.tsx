"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, MessageCircle, Mail, MapPin, ArrowRight } from "lucide-react";

interface ContactProps {
  onApplyClick: () => void;
}

const CONTACT_ICONS: Record<string, typeof Phone> = { Phone, WhatsApp: MessageCircle, Email: Mail, Location: MapPin };

const SOCIAL_SVGS: Record<string, string> = {
  facebook: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z",
  instagram: "M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z",
  youtube: "M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.43zM9.75 15.02V8.48l5.75 3.27-5.75 3.27z",
  tiktok: "M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.69a8.28 8.28 0 0 0 4.76 1.5v-3.4a4.85 4.85 0 0 1-1-.1z",
  telegram: "M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z",
};

const DEFAULTS = {
  badge: "Get in Touch",
  title: "Ready to start your creative journey?",
  description: "Have questions about our courses, schedules, or the application process? Reach out — we are happy to help.",
  phone: "+251 911 223 344",
  whatsapp: "+251 911 223 344",
  email: "info@nalikacademy.com",
  location: "Addis Ababa, Ethiopia",
  facebook: "https://facebook.com/nalikacademy",
  instagram: "https://instagram.com/nalikacademy",
  youtube: "https://youtube.com/@nalikacademy",
  telegram: "https://t.me/nalikacademy",
};

export default function Contact({ onApplyClick }: ContactProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState(DEFAULTS);

  useEffect(() => {
    fetch("/api/content?section=contact")
      .then((r) => r.json())
      .then((d) => {
        if (d.badge || d.title) {
          setContent({
            badge: d.badge || DEFAULTS.badge,
            title: d.title || DEFAULTS.title,
            description: d.description || DEFAULTS.description,
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
    const els = [contentRef.current, detailsRef.current].filter(Boolean);
    els.forEach((el, i) => {
      if (!el) return;
      el.classList.add("reveal");
      el.style.transitionDelay = `${i * 0.15}s`;
    });
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
    els.forEach((el) => observer.observe(el!));
    return () => els.forEach((el) => observer.unobserve(el!));
  }, []);

  const contactItems = [
    { label: "Phone", value: content.phone, href: `tel:${content.phone.replace(/\s/g, "")}`, icon: "Phone" },
    { label: "WhatsApp", value: content.whatsapp, href: `https://wa.me/${content.whatsapp.replace(/\s|\+/g, "")}`, icon: "WhatsApp" },
    { label: "Email", value: content.email, href: `mailto:${content.email}`, icon: "Email" },
    { label: "Location", value: content.location, href: "https://maps.app.goo.gl/CgbFhJJYRSGMnWbg8", icon: "Location" },
  ];

  const socialLinks = [
    { label: "Facebook", href: content.facebook, path: SOCIAL_SVGS.facebook },
    { label: "Instagram", href: content.instagram, path: SOCIAL_SVGS.instagram },
    { label: "YouTube", href: content.youtube, path: SOCIAL_SVGS.youtube },
    { label: "TikTok", href: "#", path: SOCIAL_SVGS.tiktok },
    { label: "Telegram", href: content.telegram, path: SOCIAL_SVGS.telegram },
  ];

  return (
    <section id="contact" ref={sectionRef} className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div ref={contentRef}>
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">{content.badge}</p>
            <h2 className="text-3xl font-bold leading-snug text-navy sm:text-4xl">{content.title}</h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-gray-600">{content.description}</p>
            <button onClick={onApplyClick} className="btn-gold mt-8 inline-flex items-center gap-2 rounded-md bg-gold px-7 py-3 text-sm font-semibold text-navy">
              Join Nalik Academy <ArrowRight size={16} />
            </button>
            <div className="mt-10 flex flex-wrap gap-2.5">
              {socialLinks.map((link) => (
                <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="social-link group flex items-center gap-2 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-navy hover:border-gold hover:bg-gold/5 hover:text-gold" aria-label={link.label}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0"><path d={link.path} /></svg>
                  <span className="hidden sm:inline">{link.label}</span>
                </a>
              ))}
            </div>
          </div>
          <div ref={detailsRef}>
            <div className="space-y-5">
              {contactItems.map((item) => {
                const Icon = CONTACT_ICONS[item.icon] || Phone;
                return (
                  <a key={item.label} href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined} className="group flex items-start gap-4 rounded-lg p-3 transition-colors hover:bg-warm-white">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold transition-colors group-hover:bg-gold/20"><Icon size={18} /></div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gold">{item.label}</p>
                      <p className="mt-0.5 text-base text-navy transition-colors group-hover:text-gold">{item.value}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
