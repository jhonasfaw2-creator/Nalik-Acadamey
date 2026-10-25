"use client";

import { SOCIAL_LINKS } from "@/lib/socials";

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Courses", href: "#courses" },
  { label: "Our Work", href: "#our-work" },
  { label: "Contact", href: "#contact" },
];

export default function Footer() {
  const scrollTo = (href: string) => {
    const id = href.replace("#", "");
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <footer className="bg-white">
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
            <p className="text-sm font-semibold text-navy">Explore</p>
            <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo(link.href);
                  }}
                  className="transition-colors hover:text-gold focus-visible:underline"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          <div>
            <p className="text-sm font-semibold text-navy">Follow</p>
            <div className="mt-3 flex items-center gap-2">
              {SOCIAL_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 w-11 items-center justify-center text-gray-500 transition-colors hover:text-gold focus-visible:ring-2 focus-visible:ring-gold"
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
            <p className="text-sm font-semibold text-navy">Visit</p>
            <div className="mt-3 space-y-2 text-sm text-gray-600">
              <a href="tel:+251979989079" className="block transition-colors hover:text-gold focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white">+251979989079</a>
              <a
                href="https://maps.app.goo.gl/26zbvuqd1VrzoSPE8"
                target="_blank"
                rel="noopener noreferrer"
                className="block transition-colors hover:text-gold focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                Yeab Building, 5th Floor
              </a>
              <p>Addis Ababa, Ethiopia</p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4">
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Nalik Academy. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
