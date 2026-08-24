"use client";

import { useEffect, useState } from "react";

interface Course {
  id: string;
  title: string;
  description: string;
  price: string;
  discountPrice: string | null;
  discountLabel: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  sortOrder: number;
  published: boolean;
}

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/admin/courses")
      .then((r) => r.json())
      .then((d) => {
        setCourses(d);
        setLoading(false);
      });
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const method = editing.id ? "PUT" : "POST";
    await fetch("/api/admin/courses", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setSaving(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this course?")) return;
    await fetch(`/api/admin/courses?id=${id}`, { method: "DELETE" });
    load();
  };

  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">Courses</h1>
        <button
          onClick={() =>
            setEditing({
              id: "",
              title: "",
              description: "",
              price: "",
              discountPrice: null,
              discountLabel: null,
              videoUrl: null,
              posterUrl: null,
              sortOrder: courses.length,
              published: true,
            })
          }
          className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-navy hover:bg-gold-hover"
        >
          Add Course
        </button>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-navy">
              {editing.id ? "Edit Course" : "New Course"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
                <input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Price</label>
                  <input
                    value={editing.price}
                    onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                    placeholder="8,000 Birr"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Discount Price</label>
                  <input
                    value={editing.discountPrice || ""}
                    onChange={(e) => setEditing({ ...editing, discountPrice: e.target.value || null })}
                    placeholder="6,500 Birr"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Discount Badge Label</label>
                <input
                  value={editing.discountLabel || ""}
                  onChange={(e) => setEditing({ ...editing, discountLabel: e.target.value || null })}
                  placeholder="Opening Offer — 19% off"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Video URL</label>
                <input
                  value={editing.videoUrl || ""}
                  onChange={(e) => setEditing({ ...editing, videoUrl: e.target.value || null })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Poster URL</label>
                <input
                  value={editing.posterUrl || ""}
                  onChange={(e) => setEditing({ ...editing, posterUrl: e.target.value || null })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.published}
                  onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 accent-gold"
                />
                <label className="text-sm text-gray-700">Published</label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-navy hover:bg-gold-hover disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Courses list */}
      <div className="space-y-3">
        {courses.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-5 py-4"
          >
            <div>
              <p className="font-semibold text-navy">{c.title}</p>
              <p className="text-xs text-gray-500">
                {c.price}
                {c.discountPrice && (
                  <span className="ml-2 text-gold">→ {c.discountPrice}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  c.published
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {c.published ? "Live" : "Draft"}
              </span>
              <button
                onClick={() => setEditing(c)}
                className="rounded px-3 py-1.5 text-xs font-medium text-navy hover:bg-gray-100"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(c.id)}
                className="rounded px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
