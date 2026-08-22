"use client";

import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { Loader2, Plus, Pencil, Trash2, Upload, GripVertical } from "lucide-react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import {
  Field,
  Input,
  Textarea,
  SubmitButton,
  StatusMessage,
  ConfirmDialog,
} from "@/components/admin/AdminFormFields";

interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  videoSrc: string;
  posterImage: string;
  sortOrder: number;
}

export default function AdminOurWorkPage() {
  const {
    user,
    loading: authLoading,
  } = useAdminAuth();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PortfolioItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    videoSrc: "",
    posterImage: "",
    sortOrder: 0,
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/our-work");
        const data = await res.json();
        if (!cancelled) setItems(data.items || []);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, saving]);

  const startEdit = (item: PortfolioItem) => {
    setEditing(item);
    setIsCreating(false);
    setForm({
      title: item.title,
      description: item.description,
      videoSrc: item.videoSrc,
      posterImage: item.posterImage,
      sortOrder: item.sortOrder,
    });
  };

  const startCreate = () => {
    setEditing(null);
    setIsCreating(true);
    setForm({
      title: "",
      description: "",
      videoSrc: "",
      posterImage: "",
      sortOrder: items.length,
    });
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "portfolio");
      const res = await fetch("/api/admin/media/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm((prev) => ({ ...prev, posterImage: data.url }));
      setStatus({ type: "success", message: "Image uploaded" });
    } catch {
      setStatus({ type: "error", message: "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const method = editing ? "PUT" : "POST";
      const body = editing ? { id: editing.id, ...form } : form;
      const res = await fetch("/api/admin/our-work", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus({
        type: "success",
        message: editing ? "Item updated" : "Item created",
      });
      setEditing(null);
      setIsCreating(false);
    } catch {
      setStatus({ type: "error", message: "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    try {
      await fetch("/api/admin/our-work", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setDeleting(null);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setStatus({ type: "success", message: "Item deleted" });
    } catch {
      setStatus({ type: "error", message: "Failed to delete" });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user)
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  const showForm = editing || isCreating;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Our Work</h1>
          <p className="mt-1 text-sm text-navy/50">
            Manage portfolio items shown in the Our Work section.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={startCreate}
            className="flex items-center gap-1.5 rounded bg-gold px-4 py-2.5 text-sm font-semibold text-navy hover:bg-gold/90"
          >
            <Plus className="h-4 w-4" /> Add Item
          </button>
        )}
      </div>

      <StatusMessage
        {...(status || { type: "success", message: "" })}
      />

      {showForm && (
        <form
          onSubmit={handleSave}
          className="mt-6 rounded border border-navy/10 bg-white p-5"
        >
          <h2 className="mb-4 text-sm font-semibold text-navy">
            {editing ? "Edit Item" : "New Item"}
          </h2>
          <div className="flex flex-col gap-4">
            <Field label="Title" required>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm({ ...form, title: e.target.value })
                }
                placeholder="e.g. Cinematic Brand"
                required
              />
            </Field>
            <Field label="Description">
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Brief description of this work"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Video URL">
                <Input
                  value={form.videoSrc}
                  onChange={(e) =>
                    setForm({ ...form, videoSrc: e.target.value })
                  }
                  placeholder="/videos/example.mp4 or https://..."
                />
              </Field>
              <Field label="Sort Order">
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sortOrder: Number(e.target.value),
                    })
                  }
                />
              </Field>
            </div>
            <Field label="Poster Image">
              <div className="flex items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 rounded border border-navy/15 px-3 py-2.5 text-xs font-medium text-navy hover:bg-navy/5 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {uploading ? "Uploading..." : "Upload Poster"}
                </button>
                {form.posterImage && (
                  <div className="relative h-10 w-16 overflow-hidden rounded">
                    <Image
                      src={form.posterImage}
                      alt="Preview"
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                )}
              </div>
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <SubmitButton loading={saving}>
              {editing ? "Update" : "Create"}
            </SubmitButton>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setIsCreating(false);
              }}
              className="rounded border border-navy/15 px-4 py-2.5 text-sm text-navy hover:bg-navy/5"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm text-navy/40">
            No portfolio items yet. Click &ldquo;Add Item&rdquo; to create
            one.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 rounded border border-navy/10 bg-white px-5 py-4"
            >
              <GripVertical className="h-4 w-4 text-navy/20" />
              {item.posterImage ? (
                <div className="relative h-12 w-16 overflow-hidden rounded">
                  <Image
                    src={item.posterImage}
                    alt={item.title}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="h-12 w-16 rounded bg-navy/5" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-navy">{item.title}</p>
                <p className="truncate text-xs text-navy/50">
                  {item.description || "No description"}
                </p>
                {item.videoSrc && (
                  <p className="mt-1 truncate text-[10px] text-navy/30">
                    {item.videoSrc}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => startEdit(item)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-navy/40 hover:bg-navy/5 hover:text-navy"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleting(item.id)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-navy/40 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {deleting && (
        <ConfirmDialog
          message="Delete this portfolio item? This cannot be undone."
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
          loading={saving}
        />
      )}
    </div>
  );
}
