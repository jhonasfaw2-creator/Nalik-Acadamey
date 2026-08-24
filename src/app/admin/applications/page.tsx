"use client";

import { useEffect, useState, useCallback } from "react";

interface Application {
  id: string;
  referenceId: string;
  fullName: string;
  email: string;
  phone: string;
  age: number;
  courseSelection: string;
  previousExperience: string;
  motivation: string;
  status: string;
  createdAt: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "reviewed", label: "Reviewed" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  reviewed: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function AdminApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Application | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/admin/applications?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setApplications(d.applications || []);
        setStatusCounts(d.statusCounts || {});
        setLoading(false);
      });
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    await fetch(`/api/admin/applications/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    load();
    if (viewing?.id === id) {
      setViewing((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Applications</h1>
      <p className="mt-1 text-sm text-gray-500">
        Manage student applications.
      </p>

      {/* Status counts */}
      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              setStatusFilter(opt.value);
              setLoading(true);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === opt.value
                ? "bg-navy text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {opt.label}
            {opt.value && statusCounts[opt.value] !== undefined && (
              <span className="ml-1">({statusCounts[opt.value]})</span>
            )}
            {!opt.value && (
              <span className="ml-1">
                ({Object.values(statusCounts).reduce((a, b) => a + b, 0)})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mt-4">
        <input
          type="text"
          placeholder="Search by name, email, reference ID..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setLoading(true);
          }}
          className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2.5 text-sm text-navy placeholder-gray-400 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
        />
      </div>

      {/* Detail modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-navy">{viewing.fullName}</h2>
              <button
                onClick={() => setViewing(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Reference ID</span>
                <span className="font-mono font-bold text-gold">{viewing.referenceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email</span>
                <span className="text-navy">{viewing.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Phone</span>
                <span className="text-navy">{viewing.phone}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">Age</span>
                <span className="text-navy">{viewing.age}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Course</span>
                <span className="text-navy">{viewing.courseSelection}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Experience</span>
                <span className="text-navy">{viewing.previousExperience}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Applied</span>
                <span className="text-navy">
                  {new Date(viewing.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-md bg-warm-white p-3">
              <p className="text-xs font-medium text-gray-500">Motivation</p>
              <p className="mt-1 text-sm text-navy">{viewing.motivation}</p>
            </div>

            {/* Status change */}
            <div className="mt-5">
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <div className="flex flex-wrap gap-2">
                {["pending", "reviewed", "accepted", "rejected"].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(viewing.id, s)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      viewing.status === s
                        ? STATUS_COLORS[s] + " ring-2 ring-offset-1 ring-navy"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Applications list */}
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Loading...</div>
      ) : applications.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">No applications found.</div>
      ) : (
        <div className="mt-4 space-y-2">
          {applications.map((app) => (
            <div
              key={app.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <p className="font-semibold text-navy truncate">{app.fullName}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_COLORS[app.status] || "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {app.status}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500 truncate">
                  {app.email} · {app.courseSelection} · {app.referenceId}
                </p>
              </div>
              <button
                onClick={() => setViewing(app)}
                className="ml-4 shrink-0 rounded px-3 py-1.5 text-xs font-medium text-navy hover:bg-gray-100"
              >
                View
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
