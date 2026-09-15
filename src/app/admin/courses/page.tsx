"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2, X, Pencil, CalendarRange, Tag } from "lucide-react";

interface CourseItem {
  id: string;
  title: string;
  description: string;
  price: number;
  discountPrice: number | null;
  discountLabel: string | null;
  discountStartAt: string | null;
  discountEndAt: string | null;
  active: boolean;
  sortOrder: number;
}

interface CourseFormState {
  id?: string;
  title: string;
  description: string;
  price: number;
  discountPrice: number | null;
  discountLabel: string | null;
  discountStartAt: string;
  discountEndAt: string;
  active: boolean;
  sortOrder: number;
}

const emptyCourse = (): CourseFormState => ({
  title: "",
  description: "",
  price: 0,
  discountPrice: null,
  discountLabel: "",
  discountStartAt: "",
  discountEndAt: "",
  active: true,
  sortOrder: 0,
});

function formatDateTimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

function isDiscountActive(course: CourseItem): boolean {
  if (course.discountPrice === null || course.discountPrice === undefined) return false;
  const now = new Date();
  const start = course.discountStartAt ? new Date(course.discountStartAt) : null;
  const end = course.discountEndAt ? new Date(course.discountEndAt) : null;
  if (start && start > now) return false;
  if (end && end < now) return false;
  return true;
}

export default function AdminCourses() {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<CourseFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  const loadCourses = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/admin/courses")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load courses");
        return res.json();
      })
      .then((data) => {
        setCourses(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load courses");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const saveCourse = async () => {
    if (!editing) return;

    if (!editing.title.trim() || !editing.description.trim()) {
      setActionError("Title and description are required.");
      return;
    }
    if (Number(editing.price) < 0) {
      setActionError("Course price cannot be negative.");
      return;
    }
    if (editing.discountPrice !== null && Number(editing.discountPrice) > Number(editing.price)) {
      setActionError("Discount price cannot be higher than the course price.");
      return;
    }

    setSaving(true);
    setActionError("");

    const payload = {
      ...editing,
      title: editing.title.trim(),
      description: editing.description.trim(),
      price: Number(editing.price),
      discountPrice: editing.discountPrice === null || editing.discountPrice === undefined ? null : Number(editing.discountPrice),
      discountLabel: editing.discountLabel?.trim() ? editing.discountLabel.trim() : null,
      discountStartAt: editing.discountStartAt ? new Date(editing.discountStartAt).toISOString() : null,
      discountEndAt: editing.discountEndAt ? new Date(editing.discountEndAt).toISOString() : null,
      sortOrder: Number(editing.sortOrder) || 0,
      active: Boolean(editing.active),
    };

    const method = editing.id ? "PUT" : "POST";
    const url = "/api/admin/courses";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save course");
      }
      setEditing(null);
      loadCourses();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to save course.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCourse = async (id: string) => {
    if (!window.confirm("Delete this course?")) return;
    const res = await fetch(`/api/admin/courses?id=${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionError(data.error || "Failed to delete course.");
      return;
    }
    loadCourses();
  };

  const coursesBySort = useMemo(() => [...courses].sort((a, b) => a.sortOrder - b.sortOrder), [courses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Courses</h1>
          <p className="mt-1 text-sm text-gray-500">Edit pricing, discounts, and availability.</p>
        </div>
        <button
          onClick={() => setEditing(emptyCourse())}
          className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-gold-hover"
        >
          <Plus size={15} /> Add Course
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}
      {actionError && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{actionError}</div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-navy">{editing.id ? "Edit Course" : "New Course"}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
                <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={4} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Base Price (ETB)</label>
                  <input type="number" min={0} value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value || 0) })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Sort Order</label>
                  <input type="number" min={0} value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value || 0) })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Discount Price (ETB)</label>
                  <input
                    type="number"
                    min={0}
                    value={editing.discountPrice ?? ""}
                    onChange={(e) => setEditing({ ...editing, discountPrice: e.target.value === "" ? null : Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Discount Label</label>
                  <input value={editing.discountLabel || ""} onChange={(e) => setEditing({ ...editing, discountLabel: e.target.value || null })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none" placeholder="Opening Offer" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700"><CalendarRange size={14} /> Start Date</label>
                  <input type="datetime-local" value={formatDateTimeLocal(editing.discountStartAt || null)} onChange={(e) => setEditing({ ...editing, discountStartAt: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700"><CalendarRange size={14} /> End Date</label>
                  <input type="datetime-local" value={formatDateTimeLocal(editing.discountEndAt || null)} onChange={(e) => setEditing({ ...editing, discountEndAt: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy focus:border-gold focus:outline-none" />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-700">Availability</p>
                  <p className="text-xs text-gray-500">Show this course in the registration form</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing({ ...editing, active: !editing.active })}
                  className={`relative h-7 w-12 rounded-full transition-colors ${editing.active ? "bg-gold" : "bg-gray-300"}`}
                  aria-label="Toggle course active status"
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${editing.active ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setEditing(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={saveCourse} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-navy hover:bg-gold-hover disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Saving..." : "Save Course"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {coursesBySort.map((course) => {
          const discountActive = isDiscountActive(course);
          return (
            <div key={course.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-navy">{course.title}</h3>
                    {!course.active && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">Inactive</span>}
                    {discountActive && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Discount active</span>}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{course.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                    <span className="font-semibold text-navy">{course.price.toLocaleString("en-ET")} ETB</span>
                    {course.discountPrice !== null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                        <Tag size={12} /> {course.discountPrice.toLocaleString("en-ET")} ETB
                      </span>
                    )}
                    {course.discountLabel && <span className="text-xs text-gold">{course.discountLabel}</span>}
                  </div>
                  {(course.discountStartAt || course.discountEndAt) && (
                    <p className="mt-2 text-xs text-gray-500">
                      Discount window: {course.discountStartAt ? new Date(course.discountStartAt).toLocaleString("en-ET", { dateStyle: "medium", timeStyle: "short" }) : "Open"} → {course.discountEndAt ? new Date(course.discountEndAt).toLocaleString("en-ET", { dateStyle: "medium", timeStyle: "short" }) : "Open ended"}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => setEditing({
                    id: course.id,
                    title: course.title,
                    description: course.description,
                    price: course.price,
                    discountPrice: course.discountPrice,
                    discountLabel: course.discountLabel,
                    discountStartAt: course.discountStartAt ? formatDateTimeLocal(course.discountStartAt) : "",
                    discountEndAt: course.discountEndAt ? formatDateTimeLocal(course.discountEndAt) : "",
                    active: course.active,
                    sortOrder: course.sortOrder,
                  })} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-navy hover:bg-gray-50">
                    <Pencil size={14} /> Edit
                  </button>
                  <button onClick={() => deleteCourse(course.id)} className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {courses.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
            No courses yet. Add your first offering.
          </div>
        )}
      </div>
    </div>
  );
}
