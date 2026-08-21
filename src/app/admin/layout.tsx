"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  AdminAuthProvider,
  useAdminAuth,
} from "@/components/admin/AdminAuthProvider";
import {
  LogOut,
  LayoutDashboard,
  Inbox,
  Film,
  Image,
  Loader2,
  Menu,
  X,
  ExternalLink,
  FileText,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Inbox,
  FileText,
  Film,
  Image,
  Phone,
};

const NAV_ITEMS = [
  { label: "Overview", href: "/admin", icon: "LayoutDashboard" },
  { label: "Applications", href: "/admin/applications", icon: "Inbox" },
  { label: "Website Content", href: "/admin/content", icon: "FileText" },
  { label: "Our Work", href: "/admin/our-work", icon: "Film" },
  { label: "Media", href: "/admin/media", icon: "Image" },
  { label: "Contact Settings", href: "/admin/contact", icon: "Phone" },
];

function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAdminAuth();
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (isLoginPage || !user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-warm-white">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-navy/10 bg-navy px-4 lg:hidden">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-white/70 hover:bg-white/10"
        >
          {sidebarOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
        <span className="text-sm font-semibold text-white">
          Nalik <span className="text-gold">Admin</span>
        </span>
        <button
          onClick={signOut}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <div className="flex">
        {/* Sidebar overlay on mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-navy/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-navy/10 bg-navy transition-transform lg:sticky lg:translate-x-0 lg:z-10",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Logo */}
          <div className="flex h-14 items-center border-b border-white/10 px-5">
            <Link href="/admin" className="text-sm font-semibold text-white">
              Nalik <span className="text-gold">Admin</span>
            </Link>
          </div>

          {/* Nav links */}
          <nav className="flex-1 overflow-y-auto py-3">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              const Icon = ICONS[item.icon] || LayoutDashboard;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors",
                    active
                      ? "border-r-2 border-gold bg-white/10 text-gold"
                      : "text-white/50 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Preview + User / Sign out */}
          <div className="border-t border-white/10 p-4 space-y-3">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded border border-gold/30 px-3 py-2.5 text-xs font-semibold text-gold transition-colors hover:bg-gold/10"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Preview Website
            </a>
            <div>
              <p className="truncate text-xs text-white/30">{user.email}</p>
              <button
                onClick={signOut}
                className="mt-2 flex w-full items-center gap-2 rounded px-3 py-2.5 text-xs font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-x-hidden px-5 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthProvider>
      <AdminShell>{children}</AdminShell>
    </AdminAuthProvider>
  );
}
