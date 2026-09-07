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
  maxSeats: number;
  enrolled: number;
  seatsAvailable: number;
  isFull: boolean;
  active: boolean;
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
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this session?")) return;
    setActionError("");
    const res = await fetch(`/api/admin/schedules?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error || "Failed to delete session.");
    }
    load();
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
          <h1 className="text-2xl font-bold text-navy">Schedules</h1>
          <p className="mt-1 text-sm text-gray-500">Two schedule groups, three sessions each, 15 seats per session.</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none">
            <option value="">All groups</option>
            <option value="A">SCHEDULE A</option>
            <option value="B">SCHEDULE B</option>
          </select>
          <button onClick={() => setEditing(emptySchedule(filterGroup || undefined))} className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-gold-hover">
            <Plus size={15} /> Add Session
          </button>
        </div>
      </div>

      {actionError && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{actionError}</div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-navy">{editing.id ? "Edit Session" : "New Session"}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Schedule Group</label>
                <div className="flex gap-2">
                  {["A", "B"].map((g) => (
                    <button key={g} type="button" onClick={() => setEditing({ ...editing, group: g })} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${editing.group === g ? "bg-gold text-navy" : "border border-gray-200 text-gray-600 hover:border-gold/50"}`}>
                      SCHEDULE {g}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-400">{DAYS_BY_GROUP[editing.group || "A"]}</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Session</label>
                <select value={editing.session || ""} onChange={(e) => setEditing({ ...editing, session: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20">
                  {SESSION_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Start Time</label>
                  <input type="time" value={editing.startTime || ""} onChange={(e) => setEditing({ ...editing, startTime: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">End Time</label>
                  <input type="time" value={editing.endTime || ""} onChange={(e) => setEditing({ ...editing, endTime: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Max Seats</label>
                <input type="number" value={editing.maxSeats ?? 15} onChange={(e) => setEditing({ ...editing, maxSeats: Number(e.target.value) })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" />
                <p className="mt-1 text-xs text-gray-400">Each session holds a maximum of 15 students.</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Active</label>
                <button type="button" role="switch" aria-checked={editing.active} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditing({ ...editing, active: !editing.active }); } }} onClick={() => setEditing({ ...editing, active: !editing.active })} className={`relative h-6 w-11 rounded-full transition-colors ${editing.active ? "bg-gold" : "bg-gray-300"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${editing.active ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setEditing(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving || !editing.group || !editing.session} className="inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-navy transition-colors hover:bg-gold-hover disabled:opacity-50">
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
            <div key={g} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-navy">SCHEDULE {g}</h2>
                  <p className="text-xs text-gray-500">{DAYS_BY_GROUP[g]}</p>
                </div>
                <span className="text-xs text-gray-400">{groupSessions.length} sessions</span>
              </div>
              <div className="mt-3 space-y-2">
                {groupSessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-4 rounded-lg border border-gray-100 bg-warm-white p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-navy">{s.session}</h3>
                        {s.isFull && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">FULL</span>}
                        {!s.active && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">INACTIVE</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span>{s.startTime} – {s.endTime}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Users size={12} className={s.isFull ? "text-red-400" : "text-gray-400"} />
                        <span className={s.isFull ? "font-medium text-red-500" : "text-gray-500"}>{s.enrolled}/{s.maxSeats}</span>
                      </div>
                      <button onClick={() => setEditing(s)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-navy transition-colors hover:bg-gray-50">Edit</button>
                      <button onClick={() => handleDelete(s.id)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
                {groupSessions.length === 0 && (
                  <p className="py-4 text-center text-xs text-gray-400">No sessions in this group yet.</p>
                )}
              </div>
            </div>
          );
        })}
        {sessions.length === 0 && <div className="py-12 text-center text-sm text-gray-400">No sessions yet. Add the Morning, Afternoon, and Evening sessions for each group.</div>}
      </div>
    </div>
  );
}
