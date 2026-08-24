"use client";

import { useEffect, useState } from "react";

interface Project {
  id: string;
  title: string;
  description: string;
  videoUrl: string | null;
  posterUrl: string | null;
  category: string | null;
  sortOrder: number;
  published: boolean;
}

export default function AdminOurWork() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/admin/projects")
      .then((r) => r.json())
      .then((d) => {
        setProjects(d);
        setLoading(false);
      });
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const method = editing.id ? "PUT" : "POST";
    await fetch("/api/admin/projects", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setSaving(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project?")) return;
    await fetch(`/api/admin/projects?id=${id}`, { method: "DELETE" });
    load();
  };

  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">Our Work</h1>
        <button
          onClick={() =>
            setEditing({
              id: "",
              title: "",
              description: "",
              videoUrl: null,
              posterUrl: null,
              category: null,
              sortOrder: projects.length,
              published: true,
            })
          }
          className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-navy hover:bg-gold-hover"
        >
          Add Project
        </button>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-navy">
              {editing.id ? "Edit Project" : "New Project"}
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
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
                <input
                  value={editing.category || ""}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Video URL</label>
                <input
                  value={editing.videoUrl || ""}
                  onChange={(e) => setEditing({ ...editing, videoUrl: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Poster URL</label>
                <input
                  value={editing.posterUrl || ""}
                  onChange={(e) => setEditing({ ...editing, posterUrl: e.target.value })}
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

      {/* Projects list */}
      <div className="space-y-3">
        {projects.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-5 py-4"
          >
            <div>
              <p className="font-semibold text-navy">{p.title}</p>
              <p className="text-xs text-gray-500">{p.category || "Uncategorized"}</p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.published
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {p.published ? "Live" : "Draft"}
              </span>
              <button
                onClick={() => setEditing(p)}
                className="rounded px-3 py-1.5 text-xs font-medium text-navy hover:bg-gray-100"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(p.id)}
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
