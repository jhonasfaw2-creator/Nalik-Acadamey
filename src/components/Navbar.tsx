"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/cn";
import { Menu, X, ArrowRight, Phone } from "lucide-react";

interface NavbarProps {
  onApplyClick: () => void;
}

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Courses", href: "#courses" },
  { label: "Our Work", href: "#our-work" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar({ onApplyClick }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("#home");

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const sections = NAV_LINKS.map((l) => l.href.replace("#", ""));
    const handleScroll = () => {
      const scrollPos = window.scrollY + 120;
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el && el.offsetTop <= scrollPos) {
          setActiveSection(`#${sections[i]}`);
          break;
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = useCallback((href: string) => {
    setMobileOpen(false);
    const id = href.replace("#", "");
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  const handleApply = useCallback(() => {
    setMobileOpen(false);
    onApplyClick();
  }, [onApplyClick]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
          scrolled
            ? "bg-white/80 shadow-[0_1px_3px_rgba(0,0,0,0.08)] backdrop-blur-xl"
            : "bg-transparent"
        )}
      >
        {/* Top accent line */}
        <div
          className={cn(
            "h-[2px] transition-all duration-500",
            scrolled ? "bg-gold/80" : "bg-gradient-to-r from-transparent via-gold/40 to-transparent"
          )}
        />

        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <a
            href="#home"
            onClick={(e) => { e.preventDefault(); handleNavClick("#home"); }}
            className="flex items-center gap-3 group"
          >
            <div className="relative">
              <img
                src="/assets/logo.jpeg"
                alt="Nalik Academy"
                className="h-10 w-10 rounded-xl object-cover shadow-sm transition-shadow duration-300 group-hover:shadow-md"
              />
            </div>
            <div className="hidden sm:block">
              <span
                className={cn(
                  "block text-[15px] font-bold tracking-tight leading-tight transition-colors duration-300",
                  scrolled ? "text-navy" : "text-white"
                )}
              >
                Nalik Academy
              </span>
            </div>
          </a>

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => {
              const isActive = activeSection === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => { e.preventDefault(); handleNavClick(link.href); }}
                  className={cn(
                    "relative px-4 py-2 text-[13px] font-semibold uppercase tracking-wider transition-all duration-300",
                    isActive
                      ? scrolled
                        ? "text-gold"
                        : "text-gold"
                      : scrolled
                        ? "text-navy/60 hover:text-navy"
                        : "text-white/60 hover:text-white"
                  )}
                >
                  {link.label}
                  {/* Active dot indicator */}
                  <span
                    className={cn(
                      "absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] rounded-full bg-gold transition-all duration-300",
                      isActive ? "w-4 opacity-100" : "w-0 opacity-0"
                    )}
                  />
                </a>
              );
            })}
          </div>

          {/* Desktop CTA area */}
          <div className="hidden items-center gap-3 lg:flex">
            <a
              href="tel:+251911223344"
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium transition-colors duration-300",
                scrolled ? "text-navy/50 hover:text-navy" : "text-white/50 hover:text-white"
              )}
            >
              <Phone size={12} />
              +251 911 223 344
            </a>

            <div
              className={cn(
                "h-5 w-px",
                scrolled ? "bg-navy/10" : "bg-white/15"
              )}
            />

            <button
              onClick={handleApply}
              className="btn-gold group relative overflow-hidden rounded-lg bg-gold px-5 py-2.5 text-[13px] font-bold uppercase tracking-wider text-navy"
            >
              <span className="relative z-10 flex items-center gap-1.5">
                Apply Now <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300 lg:hidden",
              mobileOpen
                ? "bg-white/10"
                : scrolled
                  ? "text-navy hover:bg-navy/5"
                  : "text-white hover:bg-white/10"
            )}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            <div className="relative h-5 w-5">
              <span
                className={cn(
                  "absolute left-0 h-0.5 w-5 rounded-full transition-all duration-300",
                  scrolled ? "bg-navy" : "bg-white",
                  mobileOpen ? "top-2 rotate-45" : "top-0"
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-2 h-0.5 w-5 rounded-full transition-all duration-300",
                  scrolled ? "bg-navy" : "bg-white",
                  mobileOpen ? "opacity-0 scale-0" : "opacity-100 scale-100"
                )}
              />
              <span
                className={cn(
                  "absolute left-0 h-0.5 w-5 rounded-full transition-all duration-300",
                  scrolled ? "bg-navy" : "bg-white",
                  mobileOpen ? "top-2 -rotate-45" : "top-4"
                )}
              />
            </div>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden transition-all duration-500",
          mobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-navy/95 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />

        {/* Menu content */}
        <div
          className={cn(
            "relative flex h-full flex-col items-center justify-center gap-2",
            "transition-all duration-500",
            mobileOpen ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          )}
        >
          {NAV_LINKS.map((link, i) => {
            const isActive = activeSection === link.href;
            return (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => { e.preventDefault(); handleNavClick(link.href); }}
                className={cn(
                  "text-3xl font-bold tracking-tight transition-all duration-300",
                  isActive ? "text-gold" : "text-white/70 hover:text-white",
                  mobileOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                )}
                style={{ transitionDelay: mobileOpen ? `${100 + i * 60}ms` : "0ms" }}
              >
                {link.label}
              </a>
            );
          })}

          <button
            onClick={handleApply}
            className={cn(
              "mt-6 inline-flex items-center gap-2 rounded-xl bg-gold px-8 py-3.5 text-base font-bold text-navy transition-all duration-300 hover:bg-gold-hover hover:shadow-lg hover:shadow-gold/20",
              mobileOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            )}
            style={{ transitionDelay: mobileOpen ? "500ms" : "0ms" }}
          >
            Apply Now <ArrowRight size={16} />
          </button>

          <a
            href="tel:+251911223344"
            className={cn(
              "mt-4 flex items-center gap-2 text-sm text-white/40 transition-all duration-300",
              mobileOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            )}
            style={{ transitionDelay: mobileOpen ? "560ms" : "0ms" }}
          >
            <Phone size={14} />
            +251 911 223 344
          </a>
        </div>
      </div>
    </>
  );
}
