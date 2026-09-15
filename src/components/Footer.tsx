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
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                scrollTo("#home");
              }}
              className="flex items-center gap-3"
            >
              <img src="/assets/logo.jpeg" alt="Nalik Academy" className="h-9 w-9 rounded-lg object-cover" />
              <span className="text-lg font-bold text-navy">Nalik Academy</span>
            </a>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Creative production and training for editors, designers, and visual storytellers.
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Quick links</p>
            <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo(link.href);
                  }}
                  className="transition-colors hover:text-gold"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Follow</p>
            <div className="mt-3 flex items-center gap-2">
              {SOCIAL_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-all duration-200 hover:border-gold hover:bg-gold/5 hover:text-gold"
                  aria-label={link.label}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d={link.icon} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Visit</p>
            <div className="mt-3 space-y-2 text-sm text-gray-600">
              <a href="tel:+251911223344" className="block transition-colors hover:text-gold">+251 911 223 344</a>
              <a
                href="https://maps.app.goo.gl/26zbvuqd1VrzoSPE8"
                target="_blank"
                rel="noopener noreferrer"
                className="block transition-colors hover:text-gold"
              >
                Yeab Building, 5th Floor
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-4">
          <div className="flex flex-col gap-2 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <p>&copy; {new Date().getFullYear()} Nalik Academy. All rights reserved.</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRegister}
                className="font-semibold uppercase tracking-[0.12em] text-gold transition-colors hover:text-gold-hover"
              >
                Register Now
              </button>
              <span className="hidden text-gray-300 sm:inline">|</span>
              <span>Addis Ababa, Ethiopia</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
