"use client";

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Courses", href: "#courses" },
  { label: "Our Work", href: "#our-work" },
  { label: "Contact", href: "#contact" },
];

const SOCIAL_LINKS = [
  { label: "Facebook", href: "https://facebook.com/nalikacademy", icon: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" },
  { label: "Instagram", href: "https://instagram.com/nalikacademy", icon: "M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" },
  { label: "YouTube", href: "https://youtube.com/@nalikacademy", icon: "M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.43zM9.75 15.02V8.48l5.75 3.27-5.75 3.27z" },
  { label: "TikTok", href: "https://tiktok.com/@nalikacademy", icon: "M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.69a8.28 8.28 0 0 0 4.76 1.5v-3.4a4.85 4.85 0 0 1-1-.1z" },
  { label: "Telegram", href: "https://t.me/nalikacademy", icon: "M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" },
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
