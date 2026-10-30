"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Search, UserPlus, Loader2, Copy, Check, Trash2 } from "lucide-react";

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
  paymentProofStatus: string;
  paymentProofSubmittedAt: string | null;
  paymentProofReviewedAt: string | null;
  paymentProofNote: string | null;
  paymentProofPath: string | null;
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
  PENDING: "text-amber-700",
  PAID: "text-green-700",
  CONFIRMED: "text-green-700",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: "text-amber-700",
  SUCCESS: "text-green-700",
  FAILED: "text-red-700",
  CANCELLED: "text-red-700",
  INCOMPLETE: "text-gray-600",
  BLOCKED: "text-gray-600",
  AUTH_NEEDED: "text-gray-600",
  INVALID: "text-red-700",
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
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);
  const [error, setError] = useState("");
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [schedules, setSchedules] = useState<ScheduleOption[]>([]);
  // Which row is currently being saved, and which row has the move panel open.
  // These are separate: the panel is open for the same row while its save runs.
  const [reassigning, setReassigning] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [reassignError, setReassignError] = useState("");
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [viewingProof, setViewingProof] = useState<{ id: string; name: string; path: string } | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  // ── Add Student (manual enrollment) state ──
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    age: "",
    courseId: "",
    scheduleId: "",
    paymentStatus: "" as "" | "PAID" | "UNPAID",
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [created, setCreated] = useState<{ referenceId: string; fullName: string; status: string; paymentStatus: "PAID" | "UNPAID" } | null>(null);
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
            ? d.map((s: { id: string; group: string; session: string; startTime: string; endTime: string; isFull: boolean; active: boolean; availabilityOverride: boolean | null }) => ({
                id: s.id,
                group: s.group,
                session: s.session,
                startTime: s.startTime,
                endTime: s.endTime,
                // An admin-marked Full session counts as full even with free seats.
                isFull: s.isFull || s.availabilityOverride === false,
                active: s.active,
              }))
            : []
        )
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    const requestedStatus = new URLSearchParams(window.location.search).get("status") || "";
    if (STATUS_OPTIONS.some((option) => option.value === requestedStatus)) {
      setStatusFilter(requestedStatus);
    }
    setFiltersInitialized(true);
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

  useEffect(() => { if (filtersInitialized) load(); }, [filtersInitialized, load]);
  useEffect(() => {
    if (!filtersInitialized) return;
    const interval = window.setInterval(load, 5_000);
    return () => window.clearInterval(interval);
  }, [filtersInitialized, load]);

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
        closeMove();
        load();
      }
    } catch {
      setReassignError("Could not reach the server to move this student.");
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

  const deleteRegistration = async (id: string) => {
    setDeleteConfirm(null);
    setDeleting(id);
    setError("");
    try {
      const response = await fetch(`/api/admin/registrations/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Failed to delete registration.");
      } else {
        load();
      }
    } catch {
      setError("Could not reach the server to delete this registration.");
    } finally {
      setDeleting(null);
    }
  };

  const reviewRegistration = async (id: string, decision: "APPROVED" | "REJECTED") => {
    setReviewing(id);
    setError("");
    try {
      const response = await fetch(`/api/admin/registrations/${id}/payment-proof`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: decision, note: decision === "REJECTED" ? rejectNote : "" }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || `Failed to ${decision.toLowerCase()} registration.`);
      } else {
        setRejectingId(null);
        setRejectNote("");
        load();
      }
    } catch {
      setError(`Could not reach the server to ${decision.toLowerCase()} this registration.`);
    } finally {
      setReviewing(null);
    }
  };

  const viewScreenshot = (id: string, name: string, path: string) => {
    setViewingProof({ id, name, path });
  };

  // ── Manual enrollment submit ──
  const selectedSchedule = schedules.find((s) => s.id === form.scheduleId);
  const scheduleDisabled = (s: ScheduleOption) => !s.active || s.isFull;

  // ── Move student state ──
  const [moveForm, setMoveForm] = useState({ courseId: "", scheduleId: "" });

  const openMove = (reg: Registration) => {
    if (movingId === reg.id) {
      setMovingId(null);
      return;
    }
    setReassignError("");
    setMovingId(reg.id);
    setMoveForm({ courseId: reg.course?.id || "", scheduleId: reg.schedule?.id || "" });
  };

  const closeMove = () => {
    setMovingId(null);
    setMoveForm({ courseId: "", scheduleId: "" });
    setReassignError("");
  };

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    if (!form.fullName.trim() || !form.phone.trim() || !form.age || !form.courseId || !form.scheduleId) {
      setAddError("Please fill in all required fields.");
      return;
    }
    if (!form.paymentStatus) {
      setAddError("Choose the payment status: Paid or Unpaid.");
      return;
    }
    setAddSaving(true);
    try {
      const res = await fetch("/api/admin/registrations/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          age: Number(form.age),
          courseId: form.courseId,
          scheduleId: form.scheduleId,
          paymentStatus: form.paymentStatus,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setCreated(data.application);
        setForm({ fullName: "", phone: "", age: "", courseId: "", scheduleId: "", paymentStatus: "" });
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
      <h1 className="sr-only">Registrations</h1>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2.5 sm:ml-auto sm:flex-row sm:items-center">
          <button
            onClick={() => { setAddOpen(true); setCreated(null); setAddError(""); }}
            className="action-primary inline-flex items-center justify-center gap-2"
          >
            <UserPlus size={15} /> Add Student
          </button>
        </div>
      </div>

      {/* Filters */}
      {error && (
        <div className="mt-4 flex flex-col gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 sm:flex-row sm:items-center sm:justify-between">
          <span className="break-words">{error}</span>
          <button onClick={load} className="min-h-11 rounded-md bg-red-100 px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-200">Retry</button>
        </div>
      )}

      <div className="mt-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email, ID, or phone"
            className="min-h-11 w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-4 text-sm text-navy placeholder-gray-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
          />
        </div>
      </div>

      {/* Status summary bar */}
      <div role="group" aria-label="Filter registrations by status" className="-mx-3 mt-3 flex snap-x gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(statusFilter === s.value ? "" : s.value)}
            aria-pressed={statusFilter === s.value || (!statusFilter && !s.value)}
            className={`min-h-11 shrink-0 snap-start whitespace-nowrap px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${statusFilter === s.value || (!statusFilter && !s.value) ? "font-semibold text-navy" : "text-gray-600 hover:text-navy"}`}
          >
            {s.label}{s.value ? ` (${statusCounts[s.value] || 0})` : ""}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      ) : (
        <>
        <div className="mt-4 space-y-3 xl:hidden">
          {registrations.map((reg) => (
            <article key={reg.id} className="min-w-0 py-3">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-sm font-semibold leading-5 text-navy">{reg.fullName}</h2>
                  <p className="mt-1 break-all font-mono text-[11px] text-gray-500">{reg.referenceId}</p>
                </div>
                <span className={`shrink-0 text-xs font-semibold ${STATUS_COLORS[reg.status] || "text-gray-600"}`}>
                  {reg.status === "PAID" ? "ENROLLED" : reg.status}
                </span>
              </div>
              <div className="mt-3 space-y-1.5 text-xs">
                <p className="break-words font-medium text-navy">{reg.course?.title || "No course"}</p>
                <p className="break-words text-navy">
                  {reg.schedule ? (
                    <>
                      {reg.schedule.session} <span className="text-gray-500">({reg.schedule.days})</span>
                    </>
                  ) : "No schedule"}
                </p>
                <p className="break-all text-gray-500">{reg.phone}</p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className={`font-medium ${reg.paymentProofStatus === "PENDING_REVIEW" ? "text-amber-700" : reg.paymentProofStatus === "APPROVED" ? "text-green-700" : reg.paymentProofStatus === "REJECTED" ? "text-red-700" : "text-gray-500"}`}>
                    {reg.paymentProofStatus === "NOT_SUBMITTED" ? "No proof" : reg.paymentProofStatus.replace(/_/g, " ")}
                  </span>
                  {reg.payments[0] && <span className={`font-medium ${PAYMENT_STATUS_COLORS[reg.payments[0].status] || "text-gray-600"}`}>{reg.payments[0].status}</span>}
                  <span className="ml-auto text-[11px] text-gray-400">{new Date(reg.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                {reg.paymentProofNote && <p className="break-words text-xs text-gray-500">Note: {reg.paymentProofNote}</p>}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                {reg.paymentProofPath && <button onClick={() => viewScreenshot(reg.id, reg.fullName, reg.paymentProofPath!)} className="action-quiet text-sm text-blue-700">View proof</button>}
                {reg.paymentProofStatus === "PENDING_REVIEW" && <button onClick={() => reviewRegistration(reg.id, "APPROVED")} disabled={reviewing === reg.id} className="action-quiet text-sm text-green-700 disabled:opacity-50">{reviewing === reg.id ? "Approving…" : "Approve"}</button>}
                {reg.paymentProofStatus === "PENDING_REVIEW" && <button onClick={() => { setRejectingId(reg.id); setRejectNote(""); }} className="action-quiet text-sm text-red-700">Reject</button>}
                {(reg.paymentProofStatus === "NOT_SUBMITTED" || reg.paymentProofStatus === "REJECTED") && reg.status === "PENDING" && reg.payments.some((payment) => payment.status === "SUCCESS") && <button onClick={() => void confirmRegistration(reg.id)} disabled={confirming === reg.id} className="action-quiet text-sm text-green-700 disabled:opacity-50">{confirming === reg.id ? "Confirming…" : "Confirm"}</button>}
                <button onClick={() => openMove(reg)} className="action-quiet text-sm text-navy">Move</button>
                <button onClick={() => setDeleteConfirm(reg.id)} className="action-quiet text-sm text-red-700">Delete</button>
              </div>
               {movingId === reg.id && (
                <div className="mt-3 space-y-3 rounded-lg bg-warm-white p-3">
                  <label className="block text-xs font-medium text-gray-600">Course</label>
                  <select 
                    value={moveForm.courseId} 
                    onChange={(e) => setMoveForm({ courseId: e.target.value, scheduleId: "" })}
                    className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-navy"
                  >
                    {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                  </select>
                  <label className="block text-xs font-medium text-gray-600">Schedule</label>
                  <select 
                    value={moveForm.scheduleId} 
                    onChange={(e) => setMoveForm({ ...moveForm, scheduleId: e.target.value })}
                    className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-navy"
                  >
                    {schedules.map((schedule) => <option key={schedule.id} value={schedule.id} disabled={scheduleDisabled(schedule) && schedule.id !== reg.schedule?.id}>Schedule {schedule.group}: {schedule.session} ({schedule.startTime}–{schedule.endTime})</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => reassign(reg.id, moveForm.courseId, moveForm.scheduleId)} disabled={reassigning === reg.id || !moveForm.courseId || !moveForm.scheduleId} className="action-primary disabled:opacity-50">{reassigning === reg.id ? "Saving…" : "Save move"}</button>
                    <button onClick={closeMove} className="action-secondary">Cancel</button>
                  </div>
                  {reassignError && <p className="break-words text-xs text-red-600">{reassignError}</p>}
                </div>
              )}
            </article>
          ))}
          {registrations.length === 0 && <div className="py-10 text-center text-sm text-gray-500">No registrations found.</div>}
          {totalCount > 100 && <div className="flex items-center justify-between gap-2 py-3"><p className="text-xs text-gray-500">{skip + 1}–{Math.min(skip + registrations.length, totalCount)} of {totalCount}</p><div className="flex gap-4"><button onClick={() => setSkip((value) => Math.max(0, value - 100))} disabled={skip === 0} className="min-h-11 px-1 text-xs font-medium text-navy underline underline-offset-4 disabled:opacity-40">Previous</button><button onClick={() => setSkip((value) => value + 100)} disabled={skip + registrations.length >= totalCount} className="min-h-11 px-1 text-xs font-medium text-navy underline underline-offset-4 disabled:opacity-40">Next</button></div></div>}
        </div>
        <div className="mt-4 hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500">Student name</th>
                <th className="px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Phone</th>
                <th className="px-4 py-3 font-medium text-gray-500">Course</th>
                <th className="px-4 py-3 font-medium text-gray-500">Schedule</th>
                <th className="px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Registration date</th>
                <th className="px-4 py-3 font-medium text-gray-500">Payment Proof</th>
                <th className="px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Payment</th>
                <th className="px-4 py-3 font-medium text-gray-500">Registration status</th>
                <th className="px-4 py-3 font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((reg) => (
                <tr key={reg.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{reg.fullName}</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-gray-500">{reg.referenceId}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{reg.phone}</td>
                  <td className="px-4 py-3 text-sm text-navy">{reg.course?.title || "No course"}</td>
                  <td className="px-4 py-3 text-sm text-navy">
                    {reg.schedule ? (
                      <>
                        {reg.schedule.session} <span className="text-gray-500 text-xs">({reg.schedule.days})</span>
                      </>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">
                    {new Date(reg.createdAt).toLocaleString("en-GB", {
                      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${reg.paymentProofStatus === "PENDING_REVIEW" ? "text-amber-700" : reg.paymentProofStatus === "APPROVED" ? "text-green-700" : reg.paymentProofStatus === "REJECTED" ? "text-red-700" : "text-gray-500"}`}>
                      {reg.paymentProofStatus === "NOT_SUBMITTED" ? "—" : reg.paymentProofStatus.replace(/_/g, " ")}
                    </span>
                    {reg.paymentProofNote && (
                      <p className="mt-1 text-xs text-gray-500">{reg.paymentProofNote}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {reg.payments[0] ? (
                      <div>
                        <span className={`text-xs font-medium ${PAYMENT_STATUS_COLORS[reg.payments[0].status] || "text-gray-600"}`}>
                          {reg.payments[0].status}
                        </span>
                        <p className="mt-1 text-xs text-gray-500">
                          {(reg.payments[0].amount / 100).toFixed(2)} {reg.payments[0].currency}
                        </p>
                      </div>
                    ) : <span className="text-xs text-gray-400">No payment</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${STATUS_COLORS[reg.status] || "text-gray-600"}`}>
                      {reg.status === "PAID" ? "ENROLLED" : reg.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5 sm:flex-nowrap sm:gap-2">
                      {reg.paymentProofPath && (
                        <button
                          onClick={() => viewScreenshot(reg.id, reg.fullName, reg.paymentProofPath!)}
                          className="min-h-10 px-1 text-xs font-medium text-blue-700 transition-colors hover:text-blue-900 sm:mr-2 sm:text-sm"
                        >
                          View Screenshot
                        </button>
                      )}
                      {reg.paymentProofStatus === "PENDING_REVIEW" && (
                        <>
                          <button
                            onClick={() => reviewRegistration(reg.id, "APPROVED")}
                            disabled={reviewing === reg.id}
                            className="min-h-10 px-1 text-xs font-medium text-green-700 transition-colors hover:text-green-900 disabled:opacity-50 sm:mr-2 sm:text-sm"
                          >
                            {reviewing === reg.id ? "Approving..." : "Approve"}
                          </button>
                          <button
                            onClick={() => { setRejectingId(reg.id); setRejectNote(""); }}
                            className="min-h-10 px-1 text-xs font-medium text-red-700 transition-colors hover:text-red-900 sm:text-sm"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {(reg.paymentProofStatus === "NOT_SUBMITTED" || reg.paymentProofStatus === "REJECTED") && reg.status === "PENDING" && reg.payments.some((payment) => payment.status === "SUCCESS") && (
                        <button
                          onClick={() => void confirmRegistration(reg.id)}
                          disabled={confirming === reg.id}
                          className="min-h-10 px-1 text-xs font-medium text-green-700 transition-colors hover:text-green-900 sm:mr-2 sm:text-sm"
                        >
                          {confirming === reg.id ? "Confirming..." : "Confirm"}
                        </button>
                      )}
                      <button
                        onClick={() => openMove(reg)}
                        className="min-h-10 px-1 text-xs font-medium text-navy transition-colors hover:text-gold sm:mr-2 sm:text-sm"
                      >
                        Move
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(reg.id)}
                        className="min-h-10 px-1 text-xs font-medium text-red-700 transition-colors hover:text-red-900 sm:text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {movingId && (() => {
                const reg = registrations.find((r) => r.id === movingId);
                if (!reg) return null;
                return (
                  <tr className="bg-gold/5">
                    <td colSpan={9} className="px-4 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex-1">
                          <label className="mb-1 block text-xs font-medium text-gray-500">
                            Move {reg.fullName} ({reg.referenceId}) to
                          </label>
                          <select
                            value={moveForm.courseId}
                            onChange={(e) => setMoveForm({ courseId: e.target.value, scheduleId: "" })}
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
                            value={moveForm.scheduleId}
                            onChange={(e) => setMoveForm({ ...moveForm, scheduleId: e.target.value })}
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
                            onClick={() => reassign(reg.id, moveForm.courseId, moveForm.scheduleId)}
                            disabled={reassigning === reg.id || !moveForm.courseId || !moveForm.scheduleId}
                            className="action-primary disabled:opacity-50"
                          >
                            {reassigning === reg.id ? "Saving…" : "Save"}
                          </button>
                          <button
                            onClick={closeMove}
                            className="action-secondary"
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
            <div className="flex items-center justify-between px-1 py-3">
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
        </>
      )}

      {/* Add Student modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4">
          <div className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:max-h-[92dvh] sm:rounded-xl sm:p-6">
            {created ? (
              /* Success view */
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                  <Check size={24} className="text-green-600" />
                </div>
                <h2 className="text-lg font-bold text-navy">Student added</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {created.fullName} was added as{" "}
                  {created.paymentStatus === "PAID" ? "paid and enrolled" : "unpaid, awaiting payment"}.
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
                  className="action-primary mt-5 w-full"
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
                  <button onClick={closeAddModal} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Close">✕</button>
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
                  <fieldset>
                    <legend className="mb-1 block text-sm font-medium text-gray-700">Payment status *</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { value: "PAID", label: "Paid" },
                        { value: "UNPAID", label: "Unpaid" },
                      ] as const).map((option) => (
                        <label
                          key={option.value}
                          className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${form.paymentStatus === option.value ? "border-gold bg-gold/5 font-medium text-navy" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                        >
                          <input
                            type="radio"
                            name="paymentStatus"
                            value={option.value}
                            checked={form.paymentStatus === option.value}
                            onChange={() => setForm({ ...form, paymentStatus: option.value })}
                            className="h-4 w-4 accent-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {form.paymentStatus === "PAID"
                        ? "Paid students are enrolled immediately."
                        : "Unpaid students stay pending until payment is recorded."}
                    </p>
                  </fieldset>
                  <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                    Confirmed registrations are enrolled and count toward the selected schedule capacity.
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:justify-end sm:gap-3">
                    <button type="button" onClick={closeAddModal} className="action-secondary">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addSaving}
                      className="action-primary inline-flex items-center justify-center gap-2 disabled:opacity-50"
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

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4">
          <div className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:rounded-xl sm:p-6">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold text-navy">Delete student?</h2>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete{" "}
              <span className="font-medium text-navy">
                {registrations.find((r) => r.id === deleteConfirm)?.fullName || "this student"}
              </span>
              ? This will remove their registration, payment proof, and all related records. This action cannot be undone.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="action-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => void deleteRegistration(deleteConfirm!)}
                disabled={deleting === deleteConfirm}
                className="action-destructive disabled:opacity-50"
              >
                {deleting === deleteConfirm ? <Loader2 size={14} className="animate-spin mr-2" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Screenshot dialog */}
      {viewingProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-6">
          <div className="relative flex max-h-[96dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:max-h-[90dvh] sm:rounded-xl sm:p-6">
            <div className="flex items-start justify-between gap-2 mb-4 sm:mb-6">
              <h2 className="text-lg font-bold text-navy">Payment Screenshot</h2>
              <button
                onClick={() => setViewingProof(null)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3 sm:mb-4">
              Student: <span className="font-medium text-navy">{viewingProof.name}</span>
            </p>
            <div className="relative flex h-[48dvh] min-h-48 max-h-[68dvh] items-center justify-center overflow-hidden rounded-lg bg-gray-100">
              <img
                src={`/api/admin/registrations/${viewingProof.id}/payment-proof`}
                alt={`Payment screenshot for ${viewingProof.name}`}
                className="block max-h-full max-w-full object-contain"
                loading="lazy"
              />
            </div>
            <div className="mt-4 flex justify-end sm:mt-6">
              <button
                onClick={() => setViewingProof(null)}
                className="action-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject confirmation dialog */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4">
          <div className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:rounded-xl sm:p-6">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold text-navy">Reject Payment Screenshot</h2>
              <button
                onClick={() => setRejectingId(null)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Reject the payment screenshot for{" "}
              <span className="font-medium text-navy">
                {registrations.find((r) => r.id === rejectingId)?.fullName || "this student"}
              </span>
              ? The student will be able to upload a replacement screenshot.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-[0.14em] mb-2">
                Admin note (optional)
              </label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                placeholder="Reason for rejection..."
              />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:gap-3">
              <button
                onClick={() => setRejectingId(null)}
                className="action-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => void reviewRegistration(rejectingId!, "REJECTED")}
                disabled={reviewing === rejectingId}
                className="action-destructive disabled:opacity-50"
              >
                {reviewing === rejectingId ? <Loader2 size={14} className="animate-spin mr-2" /> : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
