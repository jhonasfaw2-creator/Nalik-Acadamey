"use client";

import { useState, useEffect, useCallback } from "react";

interface ContentEditorProps {
  section: string;
  title: string;
  fields: { key: string; label: string; type?: "text" | "textarea" }[];
}

export default function ContentEditor({
  section,
  title,
  fields,
}: ContentEditorProps) {
  const [data, setData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/content?section=${section}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [section]);

  const handleChange = useCallback((key: string, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, data }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
    } catch {
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        <p className="mt-3 text-sm text-gray-400">Loading content...</p>
      </div>
    );
  }

  if (error && Object.keys(data).length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-light"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">{title}</h1>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm font-medium text-green-600">Saved</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-gold px-5 py-2 text-sm font-semibold text-navy transition-colors hover:bg-gold-hover disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="space-y-5">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {field.label}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  value={data[field.key] || ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={data[field.key] || ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
