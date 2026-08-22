"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { NAV_LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { NavIndicator } from "@/components/motion/NavIndicator";
import { useApplicationModal } from "@/components/application/ApplicationContext";

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const { openModal } = useApplicationModal();

  // ── Scroll detection ──────────────────────────
  const onScroll = useCallback(() => {
    setScrolled(window.scrollY > 10);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  // ── Track active section via intersection observer ──
  useEffect(() => {
    const sections = ["home", "about", "program", "work", "contact"];
    const observers: IntersectionObserver[] = [];

    for (const id of sections) {
      const el = document.getElementById(id);
      if (!el) continue;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id);
          }
        },
        { rootMargin: "-20% 0px -60% 0px" }
      );
      observer.observe(el);
      observers.push(observer);
    }

    return () => {
      for (const obs of observers) obs.disconnect();
    };
  }, []);

  // ── Lock body scroll when mobile menu open ────
  useEffect(() => {
    if (!mobileOpen) return;
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, [mobileOpen]);

  // ── Close mobile on route change ──────────────
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // ── Active link check ─────────────────────────
  const isActive = (href: string) => {
    const anchor = href.replace("/#", "#");
    if (anchor === "/") return pathname === "/" && activeSection === "home";
    return activeSection === anchor.replace("#", "");
  };

  // ── Smooth scroll to anchor ───────────────────
  const scrollToSection = (href: string, e: React.MouseEvent) => {
    const anchor = href.replace("/#", "#");
    if (!anchor.startsWith("#")) return;

    const id = anchor.replace("#", "");
    const el = document.getElementById(id);
    if (el) {
      e.preventDefault();
      closeMobile();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.pushState(null, "", anchor);
    }
  };

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled || mobileOpen
          ? "bg-navy shadow-elevated backdrop-blur-md"
          : "bg-transparent"
      )}
    >
      <nav
        className={cn(
          "mx-auto flex max-w-7xl items-center justify-between px-5 transition-colors duration-300 sm:px-8 lg:px-12",
          !scrolled && !mobileOpen && "border-b border-white/5"
        )}
        aria-label="Main navigation"
      >
        {/* ── Logo ─────────────────────────────── */}
        <div className="flex h-16 items-center lg:h-[4.5rem]">
          <Logo height={32} className="flex-shrink-0" />
        </div>

        {/* ── Desktop links ────────────────────── */}
        <ul className="hidden items-center gap-0.5 lg:flex" role="list">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <li key={link.href} className="relative">
                <Link
                  href={link.href}
                  className={cn(
                    "relative px-3.5 py-2 text-sm font-medium transition-colors duration-150",
                    active
                      ? "text-gold"
                      : "text-white/60 hover:text-white"
                  )}
                  aria-current={active ? "page" : undefined}
                  onClick={(e) => scrollToSection(link.href, e)}
                >
                  {link.label}
                </Link>
                <NavIndicator
                  isActive={active}
                  className="absolute bottom-0 left-3.5 right-3.5 h-0.5 rounded-full bg-gold"
                />
              </li>
            );
          })}
        </ul>

        {/* ── Desktop CTA ──────────────────────── */}
        <div className="hidden lg:block">
          <button
            type="button"
            onClick={openModal}
            className="inline-flex h-12 items-center rounded bg-gold px-5 text-sm font-semibold text-navy transition-colors duration-150 hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Join Nalik Academy
          </button>
        </div>

        {/* ── Mobile hamburger ──────────────────── */}
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold lg:hidden"
          style={{ touchAction: "manipulation" }}
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          <span className="relative h-5 w-5">
            <Menu
              className={cn(
                "absolute inset-0 h-5 w-5 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
                mobileOpen
                  ? "rotate-90 scale-0 opacity-0"
                  : "rotate-0 scale-100 opacity-100"
              )}
            />
            <X
              className={cn(
                "absolute inset-0 h-5 w-5 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
                mobileOpen
                  ? "rotate-0 scale-100 opacity-100"
                  : "-rotate-90 scale-0 opacity-0"
              )}
            />
          </span>
        </button>
      </nav>

      {/* ── Mobile menu ────────────────────────── */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal={mobileOpen}
        aria-label="Mobile navigation"
        className={cn(
          "border-t border-white/10 lg:hidden",
          "transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          mobileOpen
            ? "max-h-[80vh] opacity-100"
            : "max-h-0 opacity-0 border-t-0 overflow-hidden"
        )}
      >
        <div className="space-y-1 bg-navy px-5 pb-6 pt-4 sm:px-8">
          {NAV_LINKS.map((link, i) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center rounded-lg px-3.5 py-3 text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-white/10 text-gold"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
                style={{ touchAction: "manipulation" as const, transitionDelay: mobileOpen ? `${i * 40}ms` : "0ms" }}
                aria-current={active ? "page" : undefined}
                tabIndex={mobileOpen ? 0 : -1}
                onClick={(e) => scrollToSection(link.href, e)}
              >
                {link.label}
                <NavIndicator
                  isActive={active}
                  className="ml-auto h-1.5 w-1.5 rounded-full bg-gold"
                />
              </Link>
            );
          })}

          {/* Mobile CTA */}
          <div
            className="pt-4"
            style={{
              transitionDelay: mobileOpen ? `${NAV_LINKS.length * 40}ms` : "0ms",
            }}
          >
            <button
              type="button"
              className="flex h-11 w-full items-center justify-center rounded bg-gold text-sm font-semibold text-navy transition-colors hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              tabIndex={mobileOpen ? 0 : -1}
              onClick={() => {
                closeMobile();
                openModal();
              }}
            >
              Join Nalik Academy
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
