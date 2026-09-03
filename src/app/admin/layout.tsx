"use client";

import { useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { LogOut, ExternalLink, Menu, LayoutDashboard, GraduationCap, Calendar, Users, DollarSign, Settings } from "lucide-react";

const NAV_SECTIONS = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Courses", href: "/admin/courses", icon: GraduationCap },
  { label: "Schedules", href: "/admin/schedules", icon: Calendar },
  { label: "Registrations", href: "/admin/registrations", icon: Users },
  { label: "Payments", href: "/admin/payments", icon: DollarSign },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      <div
        className={cn("fixed inset-0 z-30 bg-black/40 transition-opacity lg:hidden", sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy transition-transform duration-200 lg:static lg:translate-x-0", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-5">
          <img src="/assets/logo.jpeg" alt="" className="h-7 w-7 rounded-lg object-cover" />
          <span className="text-sm font-bold text-white">Nalik Admin</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn("mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors", isActive ? "bg-gold/10 font-medium text-gold" : "text-white/60 hover:bg-white/5 hover:text-white")}
              >
                <Icon size={16} className="shrink-0" />
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-3 py-3 space-y-1">
          <a href="/" className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-white/40 transition-colors hover:bg-white/5 hover:text-white/70">
            <ExternalLink size={14} /> View Website
          </a>
          <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-white/40 transition-colors hover:bg-white/5 hover:text-red-400">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        <div className="flex h-14 items-center border-b border-gray-200 bg-white px-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-navy" aria-label="Open menu"><Menu size={22} /></button>
          <span className="ml-3 text-sm font-bold text-navy">Nalik Admin</span>
        </div>
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
