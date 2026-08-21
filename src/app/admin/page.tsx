"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Inbox,
  Film,
  Loader2,
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Image,
  FileText,
} from "lucide-react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { cn } from "@/lib/utils";

interface DashboardData {
  stats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  recentApplications: {
    id: string;
    name: string;
    email: string;
    program: string;
    status: string;
    created_at: string;
  }[];
  recentContentUpdates: {
    key: string;
    label: string;
    updated_at: string;
  }[];
}

const PROGRAM_LABELS: Record<string, string> = {
  "davinci-resolve": "DaVinci Resolve",
  "adobe-premiere-pro": "Adobe Premiere Pro",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeTime(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
        styles[status] || styles.pending
      )}
    >
      {status}
    </span>
  );
}

export default function AdminOverview() {
  const { user, loading: authLoading } = useAdminAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/admin/dashboard");
        if (!res.ok) throw new Error("Failed to load");
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Failed to load dashboard data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }


  const stats = data?.stats;
  const recentApps = data?.recentApplications || [];
  const contentUpdates = data?.recentContentUpdates || [];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
          <p className="mt-1 text-sm text-navy/50">
            Welcome back. Here&apos;s your academy at a glance.
          </p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded border border-navy/15 px-4 py-2.5 text-sm font-medium text-navy transition-colors hover:bg-navy/5"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Preview Website
        </a>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Application Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total",
            value: stats?.total,
            icon: Inbox,
            href: "/admin/applications",
            color: "text-navy",
            bg: "bg-navy/5",
          },
          {
            label: "Pending",
            value: stats?.pending,
            icon: Clock,
            href: "/admin/applications?status=pending",
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
          {
            label: "Approved",
            value: stats?.approved,
            icon: CheckCircle,
            href: "/admin/applications?status=approved",
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            label: "Rejected",
            value: stats?.rejected,
            icon: XCircle,
            href: "/admin/applications?status=rejected",
            color: "text-red-600",
            bg: "bg-red-50",
          },
        ].map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group rounded border border-navy/10 bg-white p-4 transition-colors hover:border-gold/30"
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded transition-colors group-hover:bg-gold/10",
                  card.bg
                )}
              >
                <card.icon className={cn("h-4 w-4", card.color)} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-navy/40">
                  {card.label}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-2xl font-bold text-navy",
                    loading && "opacity-40"
                  )}
                >
                  {loading || !stats ? "—" : card.value}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mt-6 rounded border border-navy/10 bg-white p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-navy/40">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            { label: "Manage Applications", href: "/admin/applications", icon: Inbox },
            { label: "Edit Website Content", href: "/admin/content", icon: FileText },
            { label: "Manage Our Work", href: "/admin/our-work", icon: Film },
            { label: "Media Library", href: "/admin/media", icon: Image },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-2 rounded border border-navy/10 px-3 py-3 text-sm font-medium text-navy transition-colors hover:border-gold/30 hover:text-gold"
            >
              <action.icon className="h-3.5 w-3.5 text-navy/30" />
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity row */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Recent Applications */}
        <div className="rounded border border-navy/10 bg-white">
          <div className="flex items-center justify-between border-b border-navy/10 px-5 py-3">
            <h2 className="text-sm font-semibold text-navy">
              Recent Applications
            </h2>
            <Link
              href="/admin/applications"
              className="text-xs font-medium text-gold transition-colors hover:text-navy"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-navy/5">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gold" />
              </div>
            ) : recentApps.length === 0 ? (
              <div className="py-8 text-center">
                <Inbox className="mx-auto h-8 w-8 text-navy/15" />
                <p className="mt-2 text-sm text-navy/40">
                  No applications yet
                </p>
              </div>
            ) : (
              recentApps.map((app) => (
                <Link
                  key={app.id}
                  href="/admin/applications"
                  className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-warm-white/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy">
                      {app.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-navy/40">
                      {PROGRAM_LABELS[app.program] || app.program}
                    </p>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    <StatusBadge status={app.status} />
                    <span className="hidden text-[10px] text-navy/30 sm:inline">
                      {formatRelativeTime(app.created_at)}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Content Updates */}
        <div className="rounded border border-navy/10 bg-white">
          <div className="flex items-center justify-between border-b border-navy/10 px-5 py-3">
            <h2 className="text-sm font-semibold text-navy">
              Recent Content Updates
            </h2>
            <Link
              href="/admin/content"
              className="text-xs font-medium text-gold transition-colors hover:text-navy"
            >
              Edit content
            </Link>
          </div>
          <div className="divide-y divide-navy/5">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gold" />
              </div>
            ) : contentUpdates.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="mx-auto h-8 w-8 text-navy/15" />
                <p className="mt-2 text-sm text-navy/40">
                  No content updates yet
                </p>
              </div>
            ) : (
              contentUpdates.map((item) => {
                const editPages: Record<string, string> = {
                  hero: "/admin/content/hero",
                  about: "/admin/content/about",
                  what_we_teach: "/admin/content/what-we-teach",
                  featured_courses: "/admin/content/featured-courses",
                  founder: "/admin/content/why-nalik",
                  our_work: "/admin/content/our-work",
                  career_path: "/admin/content/career-path",
                  learning_process: "/admin/content/learning-process",
                  contact: "/admin/content/contact",
                  final_cta: "/admin/content/final-cta",
                };
                const href = editPages[item.key] || "/admin/content";

                return (
                  <Link
                    key={item.key}
                    href={href}
                    className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-warm-white/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-navy">
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-xs text-navy/40">
                        Key: {item.key}
                      </p>
                    </div>
                    <span className="ml-3 text-[10px] text-navy/30">
                      {item.updated_at
                        ? formatRelativeTime(item.updated_at)
                        : "Never"}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
