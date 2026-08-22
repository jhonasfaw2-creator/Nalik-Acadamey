"use client";

import Image from "next/image";
import { useEffect, useState, useRef, useCallback } from "react";
import { Loader2, Upload, ExternalLink } from "lucide-react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { Field, Input, Textarea, SubmitButton, StatusMessage } from "@/components/admin/AdminFormFields";


export interface SectionField {
  name: string;
  label: string;
  type: "text" | "textarea" | "media";
  /** For media fields: the folder to upload to */
  uploadFolder?: string;
  /** Show a preview of the current media value */
  preview?: boolean;
}

export interface SectionConfig {
  /** Database key in site_content table */
  key: string;
  /** Display title */
  title: string;
  /** Description shown under the title */
  description: string;
  /** Fields to render */
  fields: SectionField[];
  /** Where to link "View on site" */
  publicPath?: string;
}

type ContentData = Record<string, Record<string, string>>;

export function SectionEditor({ config }: { config: SectionConfig }) {
  const { user, loading: authLoading } = useAdminAuth();
  const [content, setContent] = useState<ContentData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/admin/content");
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (!cancelled) {
        setContent(data.content || {});
        originalContentRef.current = data.content || {};
      }
      } catch {
        if (!cancelled) setStatus({ type: "error", message: "Failed to load content" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user]);

  const sectionData = content[config.key] || {};

  const handleChange = useCallback((fieldName: string, value: string) => {
    setContent((prev) => ({
      ...prev,
      [config.key]: {
        ...(prev[config.key] || {}),
        [fieldName]: value,
      },
    }));
  }, [config.key]);

  const handleUpload = useCallback(async (fieldName: string, file: File) => {
    setUploading(fieldName);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "uploads");
      const res = await fetch("/api/admin/media/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      handleChange(fieldName, data.url);
      setStatus({ type: "success", message: "File uploaded" });
    } catch {
      setStatus({ type: "error", message: "Upload failed" });
    } finally {
      setUploading(null);
    }
  }, [handleChange]);

  const sectionDataRef = useRef(sectionData);
  useEffect(() => { sectionDataRef.current = sectionData; });

  const handleSave = useCallback(async () => {
    setSaving(true);
    setStatus(null);

    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: config.key, value: sectionDataRef.current }),
      });

      if (!res.ok) throw new Error("Failed to save");
      setStatus({ type: "success", message: "Saved successfully" });
    } catch {
      setStatus({ type: "error", message: "Failed to save. Please try again." });
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(null), 3000);
    }
  }, [config.key]);

  const originalContentRef = useRef<ContentData>({});

  const handleReset = useCallback(() => {
    setContent((prev) => ({
      ...prev,
      [config.key]: { ...(originalContentRef.current[config.key] || {}) },
    }));
    setStatus(null);
  }, [config.key]);

  const handleDefaults = useCallback(() => {
    setContent((prev) => {
      const next = { ...prev };
      delete next[config.key];
      return next;
    });
    setStatus(null);
  }, [config.key]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">{config.title}</h1>
          <p className="mt-1 text-sm text-navy/50">{config.description}</p>
        </div>
        {config.publicPath && (
          <a
            href={config.publicPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded border border-navy/15 px-4 py-2.5 text-sm font-medium text-navy transition-colors hover:bg-navy/5"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View on Site
          </a>
        )}
      </div>

      {/* Status */}
      <StatusMessage {...(status || { type: "success", message: "" })} />

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : (
        <div className="mt-6 rounded border border-navy/10 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-5">
            {config.fields.map((field) => (
              <Field key={field.name} label={field.label}>
                {field.type === "textarea" ? (
                  <Textarea
                    rows={3}
                    value={sectionData[field.name] || ""}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                  />
                ) : field.type === "media" ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <input
                        ref={(el) => { fileRefs.current[field.name] = el; }}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUpload(field.name, f);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => fileRefs.current[field.name]?.click()}
                        disabled={uploading === field.name}
                        className="flex items-center gap-1.5 rounded border border-navy/15 px-3 py-2.5 text-xs font-medium text-navy hover:bg-navy/5 disabled:opacity-50"
                      >
                        {uploading === field.name ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        {uploading === field.name ? "Uploading..." : "Upload"}
                      </button>
                      <Input
                        value={sectionData[field.name] || ""}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        placeholder="/path/to/file.mp4 or https://..."
                        className="flex-1"
                      />
                    </div>
                    {field.preview && sectionData[field.name] && (
                      <div className="mt-1">
                        {sectionData[field.name].endsWith(".mp4") ||
                         sectionData[field.name].endsWith(".webm") ? (
                          <video
                            src={sectionData[field.name]}
                            className="h-24 rounded object-cover"
                            muted
                            playsInline
                          />
                        ) : (
                          <div className="relative h-20 w-full overflow-hidden rounded">
                            <Image
                              src={sectionData[field.name]}
                              alt={field.label}
                              fill
                              sizes="(max-width: 768px) 100vw, 320px"
                              className="object-cover"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <Input
                    value={sectionData[field.name] || ""}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                  />
                )}
              </Field>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between border-t border-navy/10 pt-5">
            <button
              type="button"
              onClick={handleDefaults}
              className="min-h-[44px] text-xs font-medium text-navy/40 transition-colors hover:text-navy/60"
            >
              Reset to defaults
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="rounded border border-navy/15 px-4 py-2.5 text-sm font-medium text-navy transition-colors hover:bg-navy/5"
              >
                Cancel
              </button>
              <SubmitButton loading={saving} onClick={handleSave}>
                {saving ? "Saving..." : "Save Changes"}
              </SubmitButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
