"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Filter, ChevronDown } from "lucide-react";

interface Registration {
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
  course: { id: string; title: string } | null;
  payment: { amount: number; status: string } | null;
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

const PAYMENT_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function AdminRegistrations() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);

    fetch(`/api/admin/registrations?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setRegistrations(d.applications || []);
        setStatusCounts(d.statusCounts || {});
        setLoading(false);
      });
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    await fetch(`/api/admin/registrations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
    setUpdating(null);
  };

  const formatBirr = (n: number) => n.toLocaleString("en-ET") + " Birr";

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-navy">Registrations</h1>
        <p className="mt-1 text-sm text-gray-500">View, search, filter, and manage all student registrations.</p>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, email, reference ID, or phone..."
            className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-4 text-sm text-navy placeholder-gray-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none rounded-lg border border-gray-200 py-2.5 pl-9 pr-8 text-sm text-navy focus:border-gold focus:outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} {s.value && statusCounts[s.value] ? `(${statusCounts[s.value]})` : ""}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Status summary bar */}
      <div className="mt-4 flex gap-2">
        {STATUS_OPTIONS.filter((s) => s.value).map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(statusFilter === s.value ? "" : s.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${statusFilter === s.value ? "bg-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {s.label} ({statusCounts[s.value] || 0})
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500">Student</th>
                <th className="px-4 py-3 font-medium text-gray-500">Course</th>
                <th className="px-4 py-3 font-medium text-gray-500">Payment</th>
                <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {registrations.map((reg) => (
                <tr key={reg.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{reg.fullName}</p>
                    <p className="text-xs text-gray-400">{reg.email}</p>
                    <p className="text-xs text-gray-400">{reg.referenceId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-navy">{reg.course?.title || reg.courseSelection}</p>
                  </td>
                  <td className="px-4 py-3">
                    {reg.payment ? (
                      <div>
                        <p className="text-sm font-medium text-navy">{formatBirr(reg.payment.amount)}</p>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${PAYMENT_COLORS[reg.payment.status] || ""}`}>
                          {reg.payment.status}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[reg.status] || ""}`}>
                      {reg.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(reg.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={reg.status}
                      onChange={(e) => updateStatus(reg.id, e.target.value)}
                      disabled={updating === reg.id}
                      className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-navy focus:border-gold focus:outline-none disabled:opacity-50"
                    >
                      {STATUS_OPTIONS.filter((s) => s.value).map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {registrations.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">No registrations found.</div>
          )}
        </div>
      )}
    </div>
  );
}
