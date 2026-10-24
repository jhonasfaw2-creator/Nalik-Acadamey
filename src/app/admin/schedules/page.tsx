"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Loader2, Save, X, Users } from "lucide-react";

interface ScheduleSession {
  id: string;
  group: string;
  session: string;
  days: string;
  startTime: string;
  endTime: string;
  startDate: string | null;
  maxSeats: number;
  enrolled: number;
  seatsAvailable: number;
  isFull: boolean;
  availabilityOverride: boolean | null;
  active: boolean;
}

// Admin-facing label for the availability state.
function availabilityLabel(s: Pick<ScheduleSession, "availabilityOverride" | "isFull">): string {
  if (s.availabilityOverride === false) return "Full";
  if (s.availabilityOverride === true) return "Available";
  return s.isFull ? "Full (auto)" : "Available (auto)";
}

const SESSION_OPTIONS = ["Morning Session", "Afternoon Session", "Evening Session"];
const DAYS_BY_GROUP: Record<string, string> = {
  A: "Monday, Wednesday, Friday",
  B: "Tuesday, Thursday, Saturday",
};

const emptySchedule = (group?: string): Partial<ScheduleSession> => ({
  group: group || "A",
  session: "Morning Session",
  startTime: "08:00",
  endTime: "10:00",
  startDate: null,
  maxSeats: 15,
  active: true,
});

export default function AdminSchedules() {
  const [sessions, setSessions] = useState<ScheduleSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Partial<ScheduleSession> | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterGroup, setFilterGroup] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const url = filterGroup ? `/api/admin/schedules?group=${filterGroup}` : "/api/admin/schedules";
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error("Failed to load schedules"); return r.json(); })
      .then((data) => {
        if (Array.isArray(data)) setSessions(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [filterGroup]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing || !editing.group || !editing.session) return;
    setSaving(true);
    setActionError("");
    const method = editing.id ? "PUT" : "POST";
    const body = editing.id ? editing : { ...editing, id: undefined };
    try {
      const res = await fetch("/api/admin/schedules", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setEditing(null); load(); }
      else setActionError(data.error || "Failed to save schedule.");
    } catch {
      setActionError("Connection error. The schedule was not saved.");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this session?")) return;
    setActionError("");
    try {
      const res = await fetch(`/api/admin/schedules?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || "Failed to delete session.");
        return;
      }
      load();
    } catch {
      setActionError("Connection error. The session was not deleted.");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" /></div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={load} className="mt-3 rounded-md bg-red-100 px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-200">Retry</button>
      </div>
    );
  }

  const groups = ["A", "B"].filter((g) => !filterGroup || filterGroup === g);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[clamp(1.5rem,4vw,2rem)] font-bold leading-tight text-navy">Schedules</h1>
          <p className="mt-1 text-sm text-gray-500">Two schedule groups, three sessions each, 15 seats per session.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:gap-3">
          <label className="sr-only" htmlFor="schedule-group-filter">Filter by schedule group</label>
          <select id="schedule-group-filter" value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} className="min-h-11 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none sm:w-auto">
            <option value="">All groups</option>
            <option value="A">SCHEDULE A</option>
            <option value="B">SCHEDULE B</option>
          </select>
          <button onClick={() => setEditing(emptySchedule(filterGroup || undefined))} className="action-primary inline-flex items-center justify-center gap-2">
            <Plus size={15} /> Add Session
          </button>
        </div>
      </div>

      {actionError && !editing && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{actionError}</div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="schedule-editor-title" className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-xl sm:max-h-[90dvh] sm:rounded-xl sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 id="schedule-editor-title" className="text-lg font-bold text-navy">{editing.id ? "Edit Session" : "New Session"}</h2>
              <button onClick={() => setEditing(null)} className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close"><X size={18} /></button>
            </div>
            {actionError && <p className="mb-4 text-sm text-red-700" role="alert">{actionError}</p>}
            <div className="space-y-4">
              <div>
                <p className="mb-1 block text-sm font-medium text-gray-700">Schedule group</p>
                <div className="flex gap-2">
                  {["A", "B"].map((g) => (
                    <button key={g} type="button" aria-pressed={editing.group === g} onClick={() => setEditing({ ...editing, group: g })} className={`min-h-11 px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${editing.group === g ? "text-gold" : "text-gray-600 hover:text-navy"}`}>
                      SCHEDULE {g}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-400">{DAYS_BY_GROUP[editing.group || "A"]}</p>
              </div>
              <div>
                <label htmlFor="schedule-session" className="mb-1 block text-sm font-medium text-gray-700">Session</label>
                <select id="schedule-session" value={editing.session || ""} onChange={(e) => setEditing({ ...editing, session: e.target.value })} className="min-h-11 w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20">
                  {SESSION_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="schedule-start-time" className="mb-1 block text-sm font-medium text-gray-700">Start Time</label>
                  <input id="schedule-start-time" type="time" value={editing.startTime || ""} onChange={(e) => setEditing({ ...editing, startTime: e.target.value })} className="min-h-11 w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" />
                </div>
                <div>
                  <label htmlFor="schedule-end-time" className="mb-1 block text-sm font-medium text-gray-700">End Time</label>
                  <input id="schedule-end-time" type="time" value={editing.endTime || ""} onChange={(e) => setEditing({ ...editing, endTime: e.target.value })} className="min-h-11 w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" />
                </div>
              </div>
              <div>
                <label htmlFor="schedule-start-date" className="mb-1 block text-sm font-medium text-gray-700">Start Date</label>
                <input
                  id="schedule-start-date"
                  type="date"
                  value={editing.startDate ? editing.startDate.slice(0, 10) : ""}
                  onChange={(e) => setEditing({ ...editing, startDate: e.target.value || null })}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                />
                <p className="mt-1 text-xs text-gray-400">First day of class — shown to students on their registration confirmation and lookup.</p>
              </div>
              <div>
                <label htmlFor="schedule-max-seats" className="mb-1 block text-sm font-medium text-gray-700">Max Seats</label>
                <input id="schedule-max-seats" type="number" min={1} value={editing.maxSeats ?? 15} onChange={(e) => setEditing({ ...editing, maxSeats: Number(e.target.value) })} className="min-h-11 w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" />
                <p className="mt-1 text-xs text-gray-400">Each session holds a maximum of 15 students.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Availability</label>
                <div className="flex gap-2">
                  {([
                    { value: "AVAILABLE", label: "Available" },
                    { value: "FULL", label: "Full" },
                    { value: "AUTO", label: "Auto" },
                  ] as const).map((opt) => {
                    const current =
                      editing.availabilityOverride === true
                        ? "AVAILABLE"
                        : editing.availabilityOverride === false
                          ? "FULL"
                          : "AUTO";
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={current === opt.value}
                        onClick={() =>
                          setEditing({
                            ...editing,
                            availabilityOverride:
                              opt.value === "AVAILABLE" ? true : opt.value === "FULL" ? false : null,
                          })
                        }
                        className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                          current === opt.value
                            ? opt.value === "FULL"
                              ? "bg-red-500 text-white"
                              : "bg-gold text-navy"
                            : "border border-gray-200 text-gray-600 hover:border-gold/50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Full: students cannot select this session. Auto: availability follows the seat count.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label id="schedule-active-label" className="text-sm font-medium text-gray-700">Active</label>
                <button type="button" role="switch" aria-labelledby="schedule-active-label" aria-checked={editing.active} onClick={() => setEditing({ ...editing, active: !editing.active })} className={`relative h-7 w-12 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${editing.active ? "bg-gold" : "bg-gray-300"}`}>
                  <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${editing.active ? "left-5.5" : "left-0.5"}`} />
                </button>
              </div>
            </div>
            {actionError && <p className="mt-4 text-sm text-red-700" role="alert">{actionError}</p>}
            <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:gap-3">
              <button onClick={() => setEditing(null)} className="action-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving || !editing.group || !editing.session} className="action-primary inline-flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sessions grouped by schedule group */}
      <div className="mt-6 space-y-6">
        {groups.map((g) => {
          const groupSessions = sessions.filter((s) => s.group === g);
          return (
            <section key={g}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-navy">Group {g}</h2>
                  <p className="text-xs text-gray-500">{DAYS_BY_GROUP[g]}</p>
                </div>
                  <span className="text-sm text-gray-500">{groupSessions.length} sessions</span>
              </div>
              <div className="mt-3 space-y-2">
                {groupSessions.map((s) => (
                  <div key={s.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="text-base font-semibold text-navy">{s.session}</h3>
                        {s.isFull && <span className="text-xs font-medium text-red-700">Full</span>}
                        {!s.active && <span className="text-xs text-gray-500">Inactive</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span>{s.startTime} – {s.endTime}</span>
                        {s.startDate && <span>Starts {new Date(s.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
                        <span
                          className={`text-xs font-medium ${
                            s.availabilityOverride === false || s.isFull
                              ? "text-red-700"
                              : "text-green-700"
                          }`}
                        >
                          {availabilityLabel(s)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-start">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Users size={12} className={s.isFull ? "text-red-400" : "text-gray-400"} />
                        <span className={s.isFull ? "font-medium text-red-500" : "text-gray-500"}>{s.enrolled}/{s.maxSeats}</span>
                      </div>
                      <button onClick={() => setEditing(s)} className="min-h-11 px-2 text-sm font-medium text-navy transition-colors hover:text-gold">Edit</button>
                      <button onClick={() => handleDelete(s.id)} aria-label={`Delete ${s.session}`} className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
                {groupSessions.length === 0 && (
                  <p className="py-4 text-center text-xs text-gray-400">No sessions in this group yet.</p>
                )}
              </div>
            </section>
          );
        })}
        {sessions.length === 0 && <div className="py-12 text-center text-sm text-gray-400">No sessions yet. Add the Morning, Afternoon, and Evening sessions for each group.</div>}
      </div>
    </div>
  );
}
