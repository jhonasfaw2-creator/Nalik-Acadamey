"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { LogOut, ExternalLink, Menu, X, LayoutDashboard, GraduationCap, Calendar, Users, Settings } from "lucide-react";

const NAV_SECTIONS = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Courses", href: "/admin/courses", icon: GraduationCap },
  { label: "Schedules", href: "/admin/schedules", icon: Calendar },
  { label: "Registrations", href: "/admin/registrations", icon: Users },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [utilitiesOpen, setUtilitiesOpen] = useState(false);
  const utilitiesTriggerRef = useRef<HTMLButtonElement>(null);
  const firstUtilityRef = useRef<HTMLAnchorElement>(null);
  const wasUtilitiesOpen = useRef(false);

  useEffect(() => {
    if (utilitiesOpen) firstUtilityRef.current?.focus();
    else if (wasUtilitiesOpen.current) utilitiesTriggerRef.current?.focus();
    wasUtilitiesOpen.current = utilitiesOpen;
  }, [utilitiesOpen]);

  useEffect(() => {
    if (!utilitiesOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUtilitiesOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [utilitiesOpen]);

  const handleLogout = useCallback(async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }, [router]);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-warm-white">
      {/* Mobile overlay */}
      {utilitiesOpen && (
        <button
          type="button"
          aria-label="Close utilities menu"
          tabIndex={-1}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setUtilitiesOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside id="admin-utilities" className={cn("fixed inset-x-3 top-14 z-40 flex max-h-[calc(100dvh-4rem)] flex-col overflow-y-auto rounded-xl bg-white p-3 shadow-xl lg:sticky lg:inset-y-0 lg:left-auto lg:right-auto lg:top-0 lg:h-screen lg:max-h-none lg:w-64 lg:shrink-0 lg:overflow-visible lg:rounded-none lg:bg-navy lg:p-0 lg:shadow-none", utilitiesOpen ? "flex" : "hidden lg:flex")}>
        <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
          <img src="/assets/logo.jpeg" alt="" className="h-7 w-7 rounded-lg object-cover" />
          <span className="text-sm font-bold text-navy lg:text-white">Nalik Admin</span>
        </div>
        <nav className="hidden flex-1 overflow-y-auto px-3 py-4 lg:block">
          {NAV_SECTIONS.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn("mb-1 flex min-h-11 items-center gap-3 px-3 text-sm transition-colors", isActive ? "font-semibold text-gold" : "text-white/65 hover:text-white")}
              >
                <Icon size={16} className="shrink-0" />
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-gray-100 px-3 py-3 lg:mt-auto lg:border-white/10 lg:py-4">
          <a ref={firstUtilityRef} href="/" onClick={() => setUtilitiesOpen(false)} className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm text-gray-600 transition-colors hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold lg:text-xs lg:text-white/50 lg:hover:text-white/80">
            <ExternalLink size={14} /> View Website
          </a>
          <button onClick={handleLogout} className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-600 transition-colors hover:text-navy lg:text-xs lg:text-white/50 lg:hover:text-white/80">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 flex h-14 items-center justify-between bg-white/95 px-3 sm:px-4 lg:hidden">
          <span className="text-sm font-bold text-navy">{NAV_SECTIONS.find((item) => item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href))?.label ?? "Nalik Admin"}</span>
          <button ref={utilitiesTriggerRef} onClick={() => setUtilitiesOpen((open) => !open)} className="flex h-11 w-11 items-center justify-center rounded-lg text-navy hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold" aria-label={utilitiesOpen ? "Close utilities menu" : "Open utilities menu"} aria-expanded={utilitiesOpen} aria-controls="admin-utilities">{utilitiesOpen ? <X size={20} /> : <Menu size={22} />}</button>
        </div>
        <main className="min-w-0 flex-1 px-3 py-5 pb-24 sm:px-5 sm:py-6 sm:pb-24 lg:px-8 lg:py-8">{children}</main>
      </div>

      <nav aria-label="Admin navigation" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV_SECTIONS.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          const mobileLabel = item.href === "/admin/registrations" ? "Students" : item.label;
          return (
            <a key={item.href} href={item.href} aria-label={item.label} aria-current={isActive ? "page" : undefined} className={cn("flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium", isActive ? "text-navy" : "text-gray-500")}>
              <Icon size={19} className={isActive ? "text-gold" : ""} />
              <span className="max-w-full truncate">{mobileLabel}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
