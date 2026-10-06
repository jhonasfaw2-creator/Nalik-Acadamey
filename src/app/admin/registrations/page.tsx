"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Search, Filter, ChevronDown, UserPlus, Loader2, Copy, Check } from "lucide-react";

interface Registration {
  id: string;
  referenceId: string;
  fullName: string;
  email: string | null;
  phone: string;
  age: number;
  previousExperience: string;
  motivation: string;
  status: string;
  createdAt: string;
  course: { id: string; title: string } | null;
  schedule: { id: string; group: string; session: string; days: string; startTime: string; endTime: string } | null;
  payments: { status: string; amount: number; currency: string }[];
}

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "PAID", label: "Enrolled (legacy)" },
  { value: "CONFIRMED", label: "Confirmed" },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
  CONFIRMED: "bg-green-100 text-green-700",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  SUCCESS: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-red-100 text-red-700",
  INCOMPLETE: "bg-gray-100 text-gray-600",
  BLOCKED: "bg-gray-100 text-gray-600",
  AUTH_NEEDED: "bg-gray-100 text-gray-600",
  INVALID: "bg-red-100 text-red-700",
};

interface CourseOption {
  id: string;
  title: string;
}

interface ScheduleOption {
  id: string;
  group: string;
  session: string;
  startTime: string;
  endTime: string;
  isFull: boolean;
  active: boolean;
}

export default function AdminRegistrations() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [skip, setSkip] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);
  const [error, setError] = useState("");
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [schedules, setSchedules] = useState<ScheduleOption[]>([]);
  const [reassigning, setReassigning] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [reassignError, setReassignError] = useState("");

  // ── Add Student (manual enrollment) state ──
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    age: "",
    courseId: "",
    scheduleId: "",
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [created, setCreated] = useState<{ referenceId: string; fullName: string; status: string } | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  // Courses and schedules for the manual enrollment and reassignment controls.
  useEffect(() => {
    fetch("/api/admin/courses")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCourses(Array.isArray(d) ? d.map((c: { id: string; title: string }) => ({ id: c.id, title: c.title })) : []))
      .catch(() => {});
    fetch("/api/admin/schedules")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) =>
        setSchedules(
          Array.isArray(d)
            ? d.map((s: { id: string; group: string; session: string; startTime: string; endTime: string; isFull: boolean; active: boolean }) => ({
                id: s.id,
                group: s.group,
                session: s.session,
                startTime: s.startTime,
                endTime: s.endTime,
                isFull: s.isFull,
                active: s.active,
              }))
            : []
        )
      )
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(!hasLoaded.current);
    setError("");
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    params.set("skip", String(skip));
    params.set("take", "100");

    fetch(`/api/admin/registrations?${params}`)
      .then((r) => { if (!r.ok) throw new Error("Failed to load registrations"); return r.json(); })
      .then((d) => {
        setRegistrations(d.applications || []);
        setStatusCounts(d.statusCounts || {});
        setTotalCount(d.totalCount || 0);
        hasLoaded.current = true;
        setLoading(false);
      })
      .catch((err) => { setError(err.message); hasLoaded.current = true; setLoading(false); });
  }, [search, statusFilter, skip]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const interval = window.setInterval(load, 5_000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    setSkip(0);
  }, [search, statusFilter]);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const reassign = async (id: string, courseId: string, scheduleId: string) => {
    setReassigning(id);
    setReassignError("");
    try {
      const res = await fetch(`/api/admin/registrations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, scheduleId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setReassignError(data.error || "Failed to update registration.");
      } else {
        load();
      }
    } finally {
      setReassigning(null);
    }
  };

  const confirmRegistration = async (id: string) => {
    setConfirming(id);
    setError("");
    try {
      const response = await fetch(`/api/admin/registrations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CONFIRMED" }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Failed to confirm registration.");
      } else {
        load();
      }
    } catch {
      setError("Could not reach the server to confirm this registration.");
    } finally {
      setConfirming(null);
    }
  };

  // ── Manual enrollment submit ──
  const selectedSchedule = schedules.find((s) => s.id === form.scheduleId);
  const scheduleDisabled = (s: ScheduleOption) => !s.active || s.isFull;

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim() || !form.age || !form.courseId || !form.scheduleId) {
      setAddError("Please fill in all fields.");
      return;
    }
    setAddSaving(true);
    try {
      const res = await fetch("/api/admin/registrations/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          age: Number(form.age),
          courseId: form.courseId,
          scheduleId: form.scheduleId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setCreated(data.application);
        setForm({ fullName: "", email: "", phone: "", age: "", courseId: "", scheduleId: "" });
        load();
      } else {
        setAddError(data.error || "Failed to add student.");
      }
    } catch {
      setAddError("Connection error. Please try again.");
    } finally {
      setAddSaving(false);
    }
  };

  const copyReference = async (ref: string) => {
    try {
      await navigator.clipboard.writeText(ref);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  const closeAddModal = () => {
    setAddOpen(false);
    setCreated(null);
    setAddError("");
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Registrations</h1>
          <p className="mt-1 text-sm text-gray-500">View, search, filter, and manage all student registrations.</p>
        </div>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <button
            onClick={() => { setAddOpen(true); setCreated(null); setAddError(""); }}
            className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-gold-hover"
          >
            <UserPlus size={15} /> Add Student
          </button>
        </div>
      </div>

      {/* Filters */}
      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200">Retry</button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, email, reference ID, phone, or tx ref..."
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
                <th className="px-4 py-3 font-medium text-gray-500">Student name</th>
                <th className="px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 font-medium text-gray-500">Phone</th>
                <th className="px-4 py-3 font-medium text-gray-500">Course</th>
                <th className="px-4 py-3 font-medium text-gray-500">Registration date</th>
                <th className="px-4 py-3 font-medium text-gray-500">Payment</th>
                <th className="px-4 py-3 font-medium text-gray-500">Registration status</th>
                <th className="px-4 py-3 font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {registrations.map((reg) => (
                <tr key={reg.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{reg.fullName}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{reg.email || "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{reg.phone}</td>
                  <td className="px-4 py-3 text-sm text-navy">{reg.course?.title || "No course"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(reg.createdAt).toLocaleString("en-GB", {
                      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {reg.payments[0] ? (
                      <div>
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${PAYMENT_STATUS_COLORS[reg.payments[0].status] || "bg-gray-100 text-gray-600"}`}>
                          {reg.payments[0].status}
                        </span>
                        <p className="mt-1 text-xs text-gray-500">
                          {(reg.payments[0].amount / 100).toFixed(2)} {reg.payments[0].currency}
                        </p>
                      </div>
                    ) : <span className="text-xs text-gray-400">No payment</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[reg.status] || "bg-gray-100 text-gray-600"}`}>
                      {reg.status === "PAID" ? "ENROLLED" : reg.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {reg.status === "PENDING" && (!reg.payments.length || reg.payments.some((payment) => payment.status === "SUCCESS")) && (
                      <button
                        onClick={() => void confirmRegistration(reg.id)}
                        disabled={confirming === reg.id}
                        className="mr-2 rounded-lg border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-50"
                      >
                        {confirming === reg.id ? "Confirming..." : "Confirm"}
                      </button>
                    )}
                    <button
                      onClick={() => setReassigning(reassigning === reg.id ? null : reg.id)}
                      className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-navy transition-colors hover:bg-gray-50"
                    >
                      Move
                    </button>
                  </td>
                </tr>
              ))}
              {reassigning && (() => {
                const reg = registrations.find((r) => r.id === reassigning);
                if (!reg) return null;
                return (
                  <tr className="bg-gold/5">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex-1">
                          <label className="mb-1 block text-xs font-medium text-gray-500">
                            Move {reg.fullName} ({reg.referenceId}) to
                          </label>
                          <select
                            id={`course-${reg.id}`}
                            defaultValue={reg.course?.id || ""}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none"
                          >
                            {courses.map((c) => (
                              <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="mb-1 block text-xs font-medium text-transparent">.</label>
                          <select
                            id={`schedule-${reg.id}`}
                            defaultValue={reg.schedule?.id || ""}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none"
                          >
                            {schedules.map((s) => (
                              <option key={s.id} value={s.id} disabled={scheduleDisabled(s) && s.id !== reg.schedule?.id}>
                                SCHEDULE {s.group}: {s.session} ({s.startTime}–{s.endTime}){s.isFull ? " — FULL" : ""}{!s.active ? " — inactive" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const courseEl = document.getElementById(`course-${reg.id}`) as HTMLSelectElement | null;
                              const scheduleEl = document.getElementById(`schedule-${reg.id}`) as HTMLSelectElement | null;
                              if (courseEl && scheduleEl) reassign(reg.id, courseEl.value, scheduleEl.value);
                            }}
                            disabled={reassigning === reg.id}
                            className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-gold-hover disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setReassigning(null)}
                            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                      {reassignError && <p className="mt-2 text-xs text-red-600">{reassignError}</p>}
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
          {registrations.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">No registrations found.</div>
          )}
          {totalCount > 100 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500">
                Showing {skip + 1}–{Math.min(skip + registrations.length, totalCount)} of {totalCount}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSkip((value) => Math.max(0, value - 100))}
                  disabled={skip === 0}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-navy disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setSkip((value) => value + 100)}
                  disabled={skip + registrations.length >= totalCount}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-navy disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Student modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            {created ? (
              /* Success view */
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                  <Check size={24} className="text-green-600" />
                </div>
                <h2 className="text-lg font-bold text-navy">Student added</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {created.fullName} was added with registration status pending.
                </p>
                <div className="mx-auto mt-5 max-w-xs rounded-lg bg-warm-white px-4 py-3 text-left">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Registration ID</p>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="font-mono text-sm font-bold text-gold">{created.referenceId}</p>
                    <button
                      onClick={() => copyReference(created.referenceId)}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-200/60 hover:text-navy"
                    >
                      {copiedRef ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                      {copiedRef ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-gray-400">
                    Share this ID with the student — they can check their enrollment anytime at /registration.
                  </p>
                </div>
                <button
                  onClick={closeAddModal}
                  className="mt-5 w-full rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy transition-colors hover:bg-gold-hover"
                >
                  Done
                </button>
              </div>
            ) : (
              /* Form view */
              <>
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-navy">Add Student</h2>
                    <p className="text-xs text-gray-400">Manually enroll a student who registered outside the website.</p>
                  </div>
                  <button onClick={closeAddModal} className="text-gray-400 hover:text-gray-600" aria-label="Close">✕</button>
                </div>
                {addError && (
                  <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{addError}</div>
                )}
                <form onSubmit={submitManual} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Full name *</label>
                    <input
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      placeholder="e.g. Sara Tesfaye"
                      className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy placeholder-gray-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="student@example.com"
                        className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy placeholder-gray-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Phone *</label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+251 9XX XXX XXX"
                        className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy placeholder-gray-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Age *</label>
                    <input
                      type="number"
                      min={10}
                      max={99}
                      value={form.age}
                      onChange={(e) => setForm({ ...form, age: e.target.value })}
                      placeholder="e.g. 22"
                      className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy placeholder-gray-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Course *</label>
                    <select
                      value={form.courseId}
                      onChange={(e) => setForm({ ...form, courseId: e.target.value, scheduleId: "" })}
                      className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none"
                    >
                      <option value="">Select a course…</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Schedule session *</label>
                    <select
                      value={form.scheduleId}
                      onChange={(e) => setForm({ ...form, scheduleId: e.target.value })}
                      disabled={!form.courseId}
                      className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="">{form.courseId ? "Select a session…" : "Pick a course first"}</option>
                      {schedules.map((s) => (
                        <option key={s.id} value={s.id} disabled={scheduleDisabled(s)}>
                          SCHEDULE {s.group}: {s.session} ({s.startTime}–{s.endTime}){s.isFull ? " — FULL" : ""}{!s.active ? " — inactive" : ""}
                        </option>
                      ))}
                    </select>
                    {selectedSchedule?.isFull && (
                      <p className="mt-1 text-xs text-red-500">This session is full — pick another one.</p>
                    )}
                  </div>
                  <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                    Confirmed registrations are enrolled and count toward the selected schedule capacity.
                  </p>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={closeAddModal} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addSaving}
                      className="inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-navy transition-colors hover:bg-gold-hover disabled:opacity-50"
                    >
                      {addSaving && <Loader2 size={14} className="animate-spin" />}
                      {addSaving ? "Adding..." : "Add Student"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}