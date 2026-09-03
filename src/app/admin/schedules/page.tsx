"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Loader2, Save, X, Users } from "lucide-react";

interface Course { id: string; title: string; }
interface Schedule {
  id: string; courseId: string; batchName: string; days: string;
  startTime: string; endTime: string; startDate: string;
  maxSeats: number; enrolled: number; active: boolean;
  course: { id: string; title: string };
}

const emptySchedule = (courseId?: string): Partial<Schedule> => ({
  courseId: courseId || "", batchName: "", days: "Mon, Wed, Fri",
  startTime: "09:00", endTime: "12:00",
  startDate: new Date().toISOString().split("T")[0],
  maxSeats: 20, enrolled: 0, active: true,
});

const DAY_OPTIONS = ["Mon, Wed, Fri", "Tue, Thu", "Sat, Sun", "Sat", "Sun", "Mon–Fri", "Custom"];

export default function AdminSchedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Schedule> | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterCourse, setFilterCourse] = useState("");

  const load = useCallback(() => {
    const url = filterCourse ? `/api/admin/schedules?courseId=${filterCourse}` : "/api/admin/schedules";
    Promise.all([
      fetch(url).then((r) => r.json()),
      fetch("/api/admin/courses").then((r) => r.json()),
    ]).then(([schedData, courseData]) => {
      setSchedules(schedData);
      setCourses(courseData);
      setLoading(false);
    });
  }, [filterCourse]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing || !editing.courseId || !editing.batchName) return;
    setSaving(true);
    const method = editing.id ? "PUT" : "POST";
    const body = editing.id ? editing : { ...editing, id: undefined };
    try {
      const res = await fetch("/api/admin/schedules", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (res.ok) { setEditing(null); load(); }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this schedule?")) return;
    await fetch(`/api/admin/schedules?id=${id}`, { method: "DELETE" });
    load();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" /></div>;
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Schedules</h1>
          <p className="mt-1 text-sm text-gray-500">Manage class batches, days, times, and availability.</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none">
            <option value="">All courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <button onClick={() => setEditing(emptySchedule(filterCourse || undefined))} className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-gold-hover">
            <Plus size={15} /> Add Schedule
          </button>
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-navy">{editing.id ? "Edit Schedule" : "New Schedule"}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Course</label>
                <select value={editing.courseId || ""} onChange={(e) => setEditing({ ...editing, courseId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20">
                  <option value="">Select course</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Batch Name</label>
                <input value={editing.batchName || ""} onChange={(e) => setEditing({ ...editing, batchName: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" placeholder="e.g. Morning Batch A" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Days</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_OPTIONS.map((d) => (
                    <button key={d} type="button" onClick={() => setEditing({ ...editing, days: d })} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${editing.days === d ? "bg-gold text-navy" : "border border-gray-200 text-gray-600 hover:border-gold/50"}`}>
                      {d}
                    </button>
                  ))}
                </div>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Start Date</label>
                  <input type="date" value={editing.startDate || ""} onChange={(e) => setEditing({ ...editing, startDate: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Max Seats</label>
                  <input type="number" value={editing.maxSeats || 20} onChange={(e) => setEditing({ ...editing, maxSeats: Number(e.target.value) })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Active</label>
                <button type="button" onClick={() => setEditing({ ...editing, active: !editing.active })} className={`relative h-6 w-11 rounded-full transition-colors ${editing.active ? "bg-gold" : "bg-gray-300"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${editing.active ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setEditing(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving || !editing.courseId || !editing.batchName} className="inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-navy transition-colors hover:bg-gold-hover disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedules list */}
      <div className="mt-6 space-y-3">
        {schedules.map((s) => {
          const spotsLeft = s.maxSeats - s.enrolled;
          const isFull = spotsLeft <= 0;
          return (
            <div key={s.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-navy">{s.batchName}</h3>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">{s.course.title}</span>
                  {!s.active && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">INACTIVE</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span>{s.days}</span>
                  <span>{s.startTime} – {s.endTime}</span>
                  <span>Starts {new Date(s.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <Users size={12} className={isFull ? "text-red-400" : "text-gray-400"} />
                  <span className={isFull ? "font-medium text-red-500" : "text-gray-500"}>{s.enrolled}/{s.maxSeats}</span>
                </div>
                <button onClick={() => setEditing(s)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-navy transition-colors hover:bg-gray-50">Edit</button>
                <button onClick={() => handleDelete(s.id)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
        {schedules.length === 0 && <div className="py-12 text-center text-sm text-gray-400">No schedules yet.</div>}
      </div>
    </div>
  );
}
