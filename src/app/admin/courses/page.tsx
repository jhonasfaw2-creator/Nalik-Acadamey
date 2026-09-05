"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Loader2, Save, X } from "lucide-react";

interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  discountPrice: number | null;
  discountLabel: string | null;
  active: boolean;
  sortOrder: number;
  _count?: { schedules: number };
}

const emptyCourse = (): Course => ({
  id: "", title: "", description: "", price: 0, discountPrice: null, discountLabel: null, active: true, sortOrder: 0,
});

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/courses")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setCourses(d); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);

    const method = editing.id ? "PUT" : "POST";
    const body = editing.id ? editing : { ...editing, id: undefined };

    try {
      const res = await fetch("/api/admin/courses", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEditing(null);
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this course? This cannot be undone.")) return;
    await fetch(`/api/admin/courses?id=${id}`, { method: "DELETE" });
    load();
  };

  const toggleActive = async (course: Course) => {
    await fetch("/api/admin/courses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: course.id, active: !course.active }),
    });
    load();
  };

  const formatBirr = (n: number) => n.toLocaleString("en-ET") + " Birr";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Courses</h1>
          <p className="mt-1 text-sm text-gray-500">Manage course name, pricing, and availability.</p>
        </div>
        <button onClick={() => setEditing(emptyCourse())} className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-gold-hover">
          <Plus size={15} /> Add Course
        </button>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-navy">{editing.id ? "Edit Course" : "New Course"}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Course Name</label>
                <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" placeholder="e.g. Adobe Premiere" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 resize-none" placeholder="What students will learn..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Price (Birr)</label>
                  <input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Discount Price (Birr)</label>
                  <input type="number" value={editing.discountPrice ?? ""} onChange={(e) => setEditing({ ...editing, discountPrice: e.target.value ? Number(e.target.value) : null })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" placeholder="Optional" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Discount Label</label>
                <input value={editing.discountLabel ?? ""} onChange={(e) => setEditing({ ...editing, discountLabel: e.target.value || null })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" placeholder="e.g. Opening Offer — 19% off" />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Active</label>
                <button onClick={() => setEditing({ ...editing, active: !editing.active })} className={`relative h-6 w-11 rounded-full transition-colors ${editing.active ? "bg-gold" : "bg-gray-300"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${editing.active ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setEditing(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving || !editing.title || !editing.price} className="inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-navy transition-colors hover:bg-gold-hover disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Courses list */}
      <div className="mt-6 space-y-3">
        {courses.map((course) => (
          <div key={course.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-navy">{course.title}</h3>
                {!course.active && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">INACTIVE</span>}
                {course._count && course._count.schedules > 0 && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">{course._count.schedules} schedules</span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-gray-500 truncate">{course.description}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-lg font-bold text-gold">{formatBirr(course.discountPrice ?? course.price)}</span>
                {course.discountPrice && <span className="text-sm text-gray-400 line-through">{formatBirr(course.price)}</span>}
                {course.discountLabel && <span className="text-xs font-medium text-green-600">{course.discountLabel}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleActive(course)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${course.active ? "bg-green-50 text-green-600 hover:bg-green-100" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                {course.active ? "Active" : "Inactive"}
              </button>
              <button onClick={() => setEditing(course)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-navy transition-colors hover:bg-gray-50">Edit</button>
              <button onClick={() => handleDelete(course.id)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {courses.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">
            No courses yet. Click &quot;Add Course&quot; to create one.
          </div>
        )}
      </div>
    </div>
  );
}
