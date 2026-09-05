"use client";

import { useEffect, useState, useCallback } from "react";
import { DollarSign, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  merchantReference: string | null;
  chapaReference: string | null;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  application: {
    id: string;
    referenceId: string;
    fullName: string;
    email: string;
    phone: string;
    courseId: string;
    course: { title: string } | null;
    schedule: { batchName: string; days: string } | null;
    status: string;
  };
}

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "SUCCESS", label: "Success" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "INCOMPLETE", label: "Incomplete" },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  SUCCESS: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-200 text-gray-600",
  INCOMPLETE: "bg-orange-100 text-orange-700",
  BLOCKED: "bg-red-100 text-red-700",
  AUTH_NEEDED: "bg-blue-100 text-blue-700",
};

const STATUS_ICONS: Record<string, typeof Clock> = {
  PENDING: Clock,
  SUCCESS: CheckCircle,
  FAILED: XCircle,
  CANCELLED: XCircle,
  INCOMPLETE: Clock,
};

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const params = statusFilter ? `?status=${statusFilter}` : "";
    fetch(`/api/admin/payments${params}`)
      .then((r) => { if (!r.ok) throw new Error("Failed to load payments"); return r.json(); })
      .then((d) => { if (Array.isArray(d)) setPayments(d); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const updatePayment = async (id: string, status: string) => {
    setSaving(true);
    await fetch("/api/admin/payments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, notes: notes || undefined }),
    });
    setEditingPayment(null);
    setSaving(false);
    load();
  };

  const formatBirr = (n: number) => n.toLocaleString("en-ET") + " Birr";

  const totalPaid = payments.filter((p) => p.status === "SUCCESS").reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter((p) => p.status === "PENDING").reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-navy">Payments</h1>
        <p className="mt-1 text-sm text-gray-500">Track Chapa payment status, amounts, and transaction references.</p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="mt-6 flex items-center justify-center py-12">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Paid</p>
                <CheckCircle size={16} className="text-green-500" />
              </div>
              <p className="mt-1 text-xl font-bold text-green-600">{formatBirr(totalPaid)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Pending</p>
                <Clock size={16} className="text-amber-500" />
              </div>
              <p className="mt-1 text-xl font-bold text-amber-600">{formatBirr(totalPending)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Payments</p>
                <DollarSign size={16} className="text-navy/40" />
              </div>
              <p className="mt-1 text-xl font-bold text-navy">{payments.length}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-6 flex gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${statusFilter === s.value ? "bg-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Edit modal */}
          {editingPayment && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                <h2 className="text-lg font-bold text-navy mb-4">Update Payment</h2>
                <p className="text-sm text-gray-500 mb-4">
                  {editingPayment.application.fullName} — {editingPayment.application.referenceId}
                  <span className="block text-xs text-gray-400">Ref: {editingPayment.merchantReference}</span>
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none resize-none" placeholder="Optional notes..." />
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={() => setEditingPayment(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button onClick={() => updatePayment(editingPayment.id, "FAILED")} disabled={saving} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50">
                    <XCircle size={14} /> Mark Failed
                  </button>
                  <button onClick={() => updatePayment(editingPayment.id, "SUCCESS")} disabled={saving} className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-100 disabled:opacity-50">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    Mark as Paid
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Payments list */}
          <div className="mt-4 space-y-3">
            {payments.map((p) => {
              const Icon = STATUS_ICONS[p.status] || Clock;
              return (
                <div key={p.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-500"}`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-navy">{p.application.fullName}</p>
                      <span className="text-xs text-gray-400">{p.application.referenceId}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                      <span>{p.application.course?.title || "—"} · {p.application.schedule?.batchName || "No schedule"}</span>
                      {p.merchantReference && <span>Ref: {p.merchantReference}</span>}
                      {p.chapaReference && <span>Chapa: {p.chapaReference}</span>}
                      {p.method && <span>Method: {p.method}</span>}
                      <span>{new Date(p.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-navy">{formatBirr(p.amount)}</p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[p.status] || ""}`}>
                      {p.status}
                    </span>
                  </div>
                  <button onClick={() => { setEditingPayment(p); setNotes(p.notes || ""); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-navy transition-colors hover:bg-gray-50">
                    Manage
                  </button>
                </div>
              );
            })}
            {payments.length === 0 && <div className="py-12 text-center text-sm text-gray-400">No payments found.</div>}
          </div>
        </>
      )}
    </div>
  );
}
