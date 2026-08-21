"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Search,
  ChevronDown,
  Eye,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  X,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  User,
  Calendar,
  GraduationCap,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { cn } from "@/lib/utils";

interface Application {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  age: number;
  location: string;
  program: string;
  skillLevel: string;
  experience: string;
  preferredSchedule: string;
  motivation: string;
  whatsapp: string | null;
  portfolioUrl: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
        styles[status] || styles.pending
      )}
    >
      {status}
    </span>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-navy/40">
        {label}
      </p>
      {href ? (
        <a
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:text-gold"
        >
          {Icon && <Icon className="h-3.5 w-3.5 text-navy/30" />}
          {value}
          {href.startsWith("http") && (
            <ExternalLink className="h-3 w-3 text-navy/20" />
          )}
        </a>
      ) : (
        <div className="mt-0.5 flex items-center gap-1.5 text-sm text-navy/70">
          {Icon && <Icon className="h-3.5 w-3.5 text-navy/30" />}
          {value}
        </div>
      )}
    </div>
  );
}

export default function AdminApplicationsPage() {
  const { user, loading: authLoading } = useAdminAuth();
  const router = useRouter();

  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const limit = 15;

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) router.replace("/admin/login");
  }, [user, authLoading, router]);

  // Fetch applications
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (programFilter) params.set("program", programFilter);
        if (statusFilter) params.set("status", statusFilter);
        params.set("page", String(page));
        params.set("limit", String(limit));

        const res = await fetch(`/api/admin/applications?${params}`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();

        if (!cancelled) {
          setApplications(data.applications);
          setTotal(data.total);
          setStats(data.stats);
        }
      } catch {
        if (!cancelled) setError("Failed to load applications.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user, search, programFilter, statusFilter, page, refreshKey]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const updateStatus = async (id: string, status: string) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");

      // Update local state
      setApplications((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status: status as Application["status"] } : a
        )
      );
      if (selectedApp?.id === id) {
        setSelectedApp((prev) =>
          prev
            ? { ...prev, status: status as Application["status"] }
            : prev
        );
      }
      setRefreshKey((k) => k + 1);
    } catch {
      setError("Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const deleteApplication = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      setSelectedApp(null);
      setConfirmDelete(false);
      setRefreshKey((k) => k + 1);
    } catch {
      setError("Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      {/* Header */}
      <h1 className="text-2xl font-bold text-navy">Applications</h1>
      <p className="mt-1 text-sm text-navy/50">
        View and manage student applications.
      </p>

      {/* Error banner */}
      {error && (
        <div className="mt-4 mb-4 flex items-center gap-2 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: stats.total, color: "text-navy" },
          { label: "Pending", value: stats.pending, color: "text-amber-600" },
          {
            label: "Approved",
            value: stats.approved,
            color: "text-emerald-600",
          },
          { label: "Rejected", value: stats.rejected, color: "text-red-600" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded border border-navy/10 bg-white px-4 py-3"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-navy/40">
              {s.label}
            </p>
            <p className={cn("mt-1 text-2xl font-bold", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/30" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded border border-navy/15 bg-white py-3 pl-10 pr-3.5 text-sm text-navy placeholder:text-navy/30 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
          />
        </div>
        <div className="relative">
          <select
            value={programFilter}
            onChange={(e) => {
              setProgramFilter(e.target.value);
              setPage(1);
            }}
            className="appearance-none rounded border border-navy/15 bg-white py-3 pl-3.5 pr-8 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
          >
            <option value="">All Programs</option>
            <option value="davinci-resolve">DaVinci Resolve</option>
            <option value="adobe-premiere-pro">Adobe Premiere Pro</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/30" />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="appearance-none rounded border border-navy/15 bg-white py-3 pl-3.5 pr-8 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/30" />
        </div>
      </div>

      {/* Table / List */}
      <div className="overflow-hidden rounded border border-navy/10 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
          </div>
        ) : applications.length === 0 ? (
          <div className="py-16 text-center">
            <GraduationCap className="mx-auto h-10 w-10 text-navy/20" />
            <p className="mt-3 text-sm font-medium text-navy/40">
              No applications found
            </p>
            {(search || programFilter || statusFilter) && (
              <button
                onClick={() => {
                  setSearch("");
                  setProgramFilter("");
                  setStatusFilter("");
                  setPage(1);
                }}
                className="mt-3 text-xs font-medium text-gold hover:text-navy"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-navy/10 bg-warm-white">
                    <th className="px-4 py-3 font-semibold text-navy/60">
                      Name
                    </th>
                    <th className="px-4 py-3 font-semibold text-navy/60">
                      Email
                    </th>
                    <th className="px-4 py-3 font-semibold text-navy/60">
                      Program
                    </th>
                    <th className="px-4 py-3 font-semibold text-navy/60">
                      Status
                    </th>
                    <th className="px-4 py-3 font-semibold text-navy/60">
                      Date
                    </th>
                    <th className="px-4 py-3 font-semibold text-navy/60">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/5">
                  {applications.map((app) => (
                    <tr
                      key={app.id}
                      className="transition-colors hover:bg-warm-white/50"
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedApp(app)}
                          className="font-medium text-navy hover:text-gold"
                        >
                          {app.fullName}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-navy/60">{app.email}</td>
                      <td className="px-4 py-3 text-navy/60">
                        {PROGRAM_LABELS[app.program] || app.program}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-navy/40">
                        {formatDate(app.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedApp(app)}
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-navy/40 hover:bg-navy/5 hover:text-navy"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {app.status !== "approved" && (
                            <button
                              onClick={() => updateStatus(app.id, "approved")}
                              disabled={updatingStatus}
                              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-navy/40 hover:bg-emerald-50 hover:text-emerald-600"
                              title="Approve"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                          {app.status !== "rejected" && (
                            <button
                              onClick={() => updateStatus(app.id, "rejected")}
                              disabled={updatingStatus}
                              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-navy/40 hover:bg-red-50 hover:text-red-600"
                              title="Reject"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-navy/5 md:hidden">
              {applications.map((app) => (
                <div key={app.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <button
                      onClick={() => setSelectedApp(app)}
                      className="text-left"
                    >
                      <p className="font-medium text-navy">{app.fullName}</p>
                      <p className="mt-0.5 text-xs text-navy/50">
                        {app.email}
                      </p>
                    </button>
                    <StatusBadge status={app.status} />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-navy/40">
                      {PROGRAM_LABELS[app.program] || app.program} ·{" "}
                      {formatDate(app.createdAt)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedApp(app)}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-navy/40 hover:bg-navy/5 hover:text-navy"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {app.status !== "approved" && (
                        <button
                          onClick={() => updateStatus(app.id, "approved")}
                          disabled={updatingStatus}
                          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-navy/40 hover:bg-emerald-50 hover:text-emerald-600"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      {app.status !== "rejected" && (
                        <button
                          onClick={() => updateStatus(app.id, "rejected")}
                          disabled={updatingStatus}
                          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-navy/40 hover:bg-red-50 hover:text-red-600"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-navy/10 px-4 py-3">
                <p className="text-xs text-navy/40">
                  Page {page} of {totalPages} ({total} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded border border-navy/15 px-3 py-2.5 text-xs font-medium text-navy hover:bg-navy/5 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded border border-navy/15 px-3 py-2.5 text-xs font-medium text-navy hover:bg-navy/5 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Drawer */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-navy/50 backdrop-blur-sm"
            onClick={() => {
              setSelectedApp(null);
              setConfirmDelete(false);
            }}
          />
          <div className="relative z-10 flex h-full w-full max-w-lg flex-col bg-white shadow-elevated sm:rounded-l-lg">
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-navy/10 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedApp(null);
                      setConfirmDelete(false);
                    }}
                    className="rounded p-1 text-navy/40 hover:bg-navy/5 hover:text-navy lg:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <h2 className="truncate text-lg font-bold text-navy">
                    {selectedApp.fullName}
                  </h2>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-navy/50">
                  <span>Applied {formatDate(selectedApp.createdAt)}</span>
                  <span className="text-navy/20">·</span>
                  <span className="font-mono text-navy/40">
                    {selectedApp.id.slice(0, 8)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedApp(null);
                  setConfirmDelete(false);
                }}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-navy/40 hover:bg-navy/5 hover:text-navy"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* Status + actions */}
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <StatusBadge status={selectedApp.status} />
                <div className="flex flex-wrap gap-2">
                  {selectedApp.status !== "approved" && (
                    <button
                      onClick={() => updateStatus(selectedApp.id, "approved")}
                      disabled={updatingStatus}
                      className="flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                    >
                      {updatingStatus ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5" />
                      )}
                      Approve
                    </button>
                  )}
                  {selectedApp.status !== "rejected" && (
                    <button
                      onClick={() => updateStatus(selectedApp.id, "rejected")}
                      disabled={updatingStatus}
                      className="flex items-center gap-1 rounded border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      {updatingStatus ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      Reject
                    </button>
                  )}
                  {selectedApp.status !== "pending" && (
                    <button
                      onClick={() => updateStatus(selectedApp.id, "pending")}
                      disabled={updatingStatus}
                      className="flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                    >
                      {updatingStatus ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Clock className="h-3.5 w-3.5" />
                      )}
                      Revert to Pending
                    </button>
                  )}
                </div>
              </div>

              {/* Application details */}
              <div className="space-y-4">
                <DetailRow
                  icon={User}
                  label="Full Name"
                  value={selectedApp.fullName}
                />
                <DetailRow
                  icon={Mail}
                  label="Email"
                  value={selectedApp.email}
                  href={`mailto:${selectedApp.email}`}
                />
                <DetailRow
                  icon={Phone}
                  label="Phone"
                  value={selectedApp.phone}
                  href={`tel:${selectedApp.phone.replace(/\s/g, "")}`}
                />
                <DetailRow
                  icon={Calendar}
                  label="Age"
                  value={`${selectedApp.age} years old`}
                />
                <DetailRow
                  icon={MapPin}
                  label="Location"
                  value={selectedApp.location}
                />
                <DetailRow
                  icon={GraduationCap}
                  label="Program"
                  value={
                    PROGRAM_LABELS[selectedApp.program] || selectedApp.program
                  }
                />
                <DetailRow label="Skill Level" value={selectedApp.skillLevel} />
                <DetailRow
                  label="Experience"
                  value={selectedApp.experience}
                />
                <DetailRow
                  label="Schedule"
                  value={selectedApp.preferredSchedule}
                />
                {selectedApp.whatsapp && (
                  <DetailRow
                    icon={Phone}
                    label="WhatsApp"
                    value={selectedApp.whatsapp}
                    href={`https://wa.me/${selectedApp.whatsapp.replace(/[+\s]/g, "")}`}
                  />
                )}
                {selectedApp.portfolioUrl && (
                  <DetailRow
                    icon={ExternalLink}
                    label="Portfolio"
                    value={selectedApp.portfolioUrl}
                    href={selectedApp.portfolioUrl}
                  />
                )}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-navy/40">
                    Motivation
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-navy/70">
                    {selectedApp.motivation}
                  </p>
                </div>
              </div>

              {/* Delete */}
              <div className="mt-8 border-t border-navy/10 pt-6">
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete application
                  </button>
                ) : (
                  <div className="rounded border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-700">
                      Are you sure? This cannot be undone.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => deleteApplication(selectedApp.id)}
                        disabled={deleting}
                        className="flex items-center gap-1 rounded bg-red-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        {deleting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="rounded border border-navy/15 px-3 py-2.5 text-xs font-medium text-navy hover:bg-navy/5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
