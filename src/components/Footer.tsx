"use client";

import { SOCIAL_LINKS } from "@/lib/socials";

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Courses", href: "#courses" },
  { label: "Our Work", href: "#our-work" },
  { label: "Contact", href: "#contact" },
];

interface FooterProps {
  onApplyClick?: () => void;
}

export default function Footer({ onApplyClick }: FooterProps) {
  const scrollTo = (href: string) => {
    const id = href.replace("#", "");
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  const handleRegister = () => {
    if (onApplyClick) {
      onApplyClick();
    } else {
      scrollTo("#contact");
    }
  };

  return (
    <footer className="bg-navy">
      {/* Main footer */}
      <div className="mx-auto max-w-7xl px-4 pt-14 pb-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Logo */}
          <a href="#home" onClick={(e) => { e.preventDefault(); scrollTo("#home"); }} className="group flex items-center gap-3">
            <img src="/assets/logo.jpeg" alt="Nalik Academy" className="h-10 w-10 rounded-xl object-cover shadow-sm transition-shadow group-hover:shadow-md" />
            <span className="text-xl font-bold text-white">Nalik Academy</span>
          </a>

          {/* Tagline */}
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/40">
            Ethiopia&apos;s creative production studio — training the next generation of editors and visual storytellers.
          </p>

          {/* Nav links */}
          <nav className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => { e.preventDefault(); scrollTo(link.href); }}
                className="text-[13px] font-medium uppercase tracking-wider text-white/50 transition-colors hover:text-gold"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Register CTA */}
          <button
            onClick={handleRegister}
            className="mt-8 rounded-lg bg-gold px-7 py-2.5 text-[13px] font-bold uppercase tracking-wider text-navy transition-all duration-200 hover:bg-gold-hover hover:shadow-lg hover:shadow-gold/20"
          >
            Register Now
          </button>

          {/* Divider */}
          <div className="mt-10 h-px w-full max-w-md bg-white/10" />

          {/* Contact row */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/40">
            <a href="tel:+251911223344" className="transition-colors hover:text-gold">+251 911 223 344</a>
            <span className="hidden text-white/20 sm:inline">·</span>
            <a href="mailto:info@nalikacademy.com" className="transition-colors hover:text-gold">info@nalikacademy.com</a>
            <span className="hidden text-white/20 sm:inline">·</span>
            <span>Addis Ababa, Ethiopia</span>
          </div>

          {/* Social icons */}
          <div className="mt-6 flex gap-2">
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/40 transition-all duration-200 hover:bg-gold/20 hover:text-gold"
                aria-label={link.label}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d={link.icon} />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5 px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-xs text-white/25">
            &copy; {new Date().getFullYear()} Nalik Academy. All rights reserved.
          </p>
          <p className="text-xs text-white/25">
            Production & Training Studio — Addis Ababa
          </p>
        </div>
      </div>
    </footer>
  );
}
