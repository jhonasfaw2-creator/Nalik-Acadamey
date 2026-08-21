"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Loader2,
  Upload,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Replace,
} from "lucide-react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { StatusMessage, ConfirmDialog } from "@/components/admin/AdminFormFields";
import { cn } from "@/lib/utils";

interface MediaFile {
  id: string;
  name: string;
  path: string;
  url: string;
  size: number;
  type: string;
  created_at: string;
}

interface MediaUpload {
  file: File;
  progress: number;
  status: "uploading" | "success" | "error";
  error: string | null;
  url: string | null;
  path: string | null;
}

const FOLDERS = [
  { value: "hero", label: "Hero" },
  { value: "about", label: "About" },
  { value: "our-work", label: "Our Work" },
  { value: "uploads", label: "General" },
];

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminMediaPage() {
  const { user, loading: authLoading } = useAdminAuth();
  const [activeFolder, setActiveFolder] = useState("uploads");
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<MediaUpload[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<MediaFile | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);
  const [replacing, setReplacing] = useState<MediaFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch files for active folder ────────────
  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setLoadingError(null);
    try {
      const res = await fetch(`/api/admin/media/list?folder=${activeFolder}`);
      if (!res.ok) throw new Error("Failed to load media");
      const data = await res.json();
      setFiles(data.files || []);
    } catch {
      setLoadingError("Failed to load media files.");
    } finally {
      setLoading(false);
    }
  }, [activeFolder]);

  useEffect(() => {
    if (!user) return;
    fetchFiles();
  }, [user, activeFolder, fetchFiles]);

  // ── Upload files ──────────────────────────────
  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return;

    const newUploads: MediaUpload[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_SIZE) {
        newUploads.push({
          file,
          progress: 0,
          status: "error",
          error: `File too large (max ${MAX_FILE_SIZE / (1024 * 1024)}MB)`,
          url: null,
          path: null,
        });
        continue;
      }

      const upload: MediaUpload = {
        file,
        progress: 0,
        status: "uploading",
        error: null,
        url: null,
        path: null,
      };
      newUploads.push(upload);
      setUploads((prev) => [...prev, upload]);

      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", activeFolder);

        const res = await fetch("/api/admin/media/upload", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Upload failed");

        setUploads((prev) =>
          prev.map((u) =>
            u.file === file
              ? { ...u, progress: 100, status: "success", url: data.url, path: data.path }
              : u
          )
        );

        // Add to files list
        const newFile: MediaFile = {
          id: data.path,
          name: file.name,
          path: data.path,
          url: data.url,
          size: data.size,
          type: data.type,
          created_at: new Date().toISOString(),
        };
        setFiles((prev) => [newFile, ...prev]);
      } catch (err) {
        setUploads((prev) =>
          prev.map((u) =>
            u.file === file
              ? { ...u, status: "error", error: (err as Error).message }
              : u
          )
        );
      }
    }

    // Clear uploads after delay
    setTimeout(() => setUploads([]), 3000);
  };

  // ── Delete ────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingLoading(true);
    try {
      const res = await fetch("/api/admin/media/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: deleting.path }),
      });
      if (!res.ok) throw new Error("Delete failed");
      setFiles((prev) => prev.filter((f) => f.path !== deleting.path));
      setDeleting(null);
    } catch {
      setLoadingError("Failed to delete file.");
    } finally {
      setDeletingLoading(false);
    }
  };

  // ── Replace ────────────────────────────────────
  const handleReplace = async (file: File) => {
    if (!replacing) return;

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("path", replacing.path);

      const res = await fetch("/api/admin/media/replace", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Replace failed");

      setFiles((prev) =>
        prev.map((f) =>
          f.path === replacing.path
            ? { ...f, url: data.url, size: data.size, name: file.name }
            : f
        )
      );
      setReplacing(null);
    } catch (err) {
      setLoadingError((err as Error).message);
    }
  };

  // ── Copy URL ────────────────────────────────────
  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Media Library</h1>
          <p className="mt-1 text-sm text-navy/50">
            Upload, preview, replace, and delete media files organized by folder.
          </p>
        </div>
        <button
          onClick={fetchFiles}
          className="flex items-center gap-1.5 rounded border border-navy/15 px-3 py-2 text-xs font-medium text-navy transition-colors hover:bg-navy/5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Status messages */}
      <StatusMessage {...(loadingError ? { type: "error", message: loadingError } : { type: "success", message: "" })} />

      {/* Folder tabs */}
      <div className="mt-2 mb-6 flex flex-wrap gap-1.5">
        {FOLDERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setActiveFolder(f.value);
              setFiles([]);
              setLoading(true);
              setCopied(null);
              setDeleting(null);
              setReplacing(null);
            }}
            className={cn(
              "rounded border border-navy/15 px-4 py-2 text-sm font-medium transition-all",
              activeFolder === f.value
                ? "border-gold bg-gold/5 text-gold"
                : "text-navy/50 hover:bg-navy/5"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Upload area */}
      <div className="rounded border-2 border-dashed border-navy/15 bg-white p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={IMAGE_TYPES.concat(VIDEO_TYPES).map((t) => t).join(", ")}
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded bg-gold px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-gold/90"
            >
              <Upload className="h-4 w-4" />
              Select Files
            </button>
            <span className="text-xs text-navy/40">
              Images and videos up to {MAX_FILE_SIZE / (1024 * 1024)}MB
            </span>
          </div>
        </div>

        {/* Active uploads with progress */}
        {uploads.length > 0 && (
          <div className="mt-4 space-y-3">
            {uploads.map((u) => (
              <div key={`${u.file.name}-${u.progress}`} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-navy truncate">
                      {u.file.name}
                    </span>
                    <span
                      className={cn(
                        "font-medium",
                        u.status === "success" && "text-emerald-600",
                        u.status === "error" && "text-red-600",
                        u.status === "uploading" && "text-navy/40"
                      )}
                    >
                      {u.status === "success" && "Done"}
                      {u.status === "error" && "Failed"}
                      {u.status === "uploading" && `${u.progress}%`}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-navy/10 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        u.status === "success" && "w-full bg-emerald-500",
                        u.status === "error" && "w-full bg-red-500",
                        u.status === "uploading" && "w-[var(--progress)] bg-gold"
                      )}
                      style={{
                        width: u.status === "uploading" ? `${u.progress}%` : undefined,
                      }}
                    />
                  </div>
                  {u.error && (
                    <p className="mt-0.5 text-xs text-red-600">{u.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Files grid */}
      <div className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
          </div>
        ) : files.length === 0 ? (
          <div className="py-16 text-center">
            <Upload className="mx-auto h-10 w-10 text-navy/15" />
            <p className="mt-3 text-sm font-medium text-navy/40">
              No media files in this folder.
            </p>
            <p className="mt-1 text-xs text-navy/30">
              Upload files above to get started. They will appear here once uploaded.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {files.map((file) => (
              <MediaCard
                key={file.path}
                file={file}
                copied={copied}
                copyUrl={copyUrl}
                onDelete={() => setDeleting(file)}
                onReplace={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = IMAGE_TYPES.concat(VIDEO_TYPES).join(", ");
                  input.onchange = (e) => {
                    const target = e.target as HTMLInputElement;
                    if (target.files?.[0]) handleReplace(target.files[0]);
                  };
                  input.click();
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {deleting && (
        <ConfirmDialog
          message={`Delete "${deleting.name}" from storage? This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          loading={deletingLoading}
        />
      )}
    </div>
  );
}

// ── Media Card component ────────────────────────────
function MediaCard({
  file,
  copied,
  copyUrl,
  onDelete,
  onReplace,
}: {
  file: MediaFile;
  copied: string | null;
  copyUrl: (url: string) => void;
  onDelete: () => void;
  onReplace: (file: MediaFile) => void;
}) {
  const isImage = IMAGE_TYPES.includes(file.type);
  const isVideo = VIDEO_TYPES.includes(file.type);
  const isCopied = copied === file.url;

  return (
    <div className="group relative overflow-hidden rounded border border-navy/10 bg-white">
      {/* Preview */}
      <div className="aspect-video bg-navy/5">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.url}
            alt={file.name}
            className="h-full w-full object-cover"
          />
        ) : isVideo ? (
          <video
            src={file.url}
            className="h-full w-full object-cover"
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={file.name}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-navy/30">
            {file.type || "Unknown file"}
          </div>
        )}
      </div>

      {/* Overlay actions */}
      <div className="absolute inset-0 bg-navy/80 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center gap-1">
        <button
          onClick={() => copyUrl(file.url)}
          className="rounded bg-navy/20 p-1.5 text-white hover:bg-navy/30"
          title={isCopied ? "Copied!" : "Copy URL"}
          aria-label={isCopied ? "Copied" : "Copy URL"}
        >
          {isCopied ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={() => onReplace(file)}
          className="rounded bg-navy/20 p-1.5 text-white hover:bg-navy/30"
          title="Replace file"
          aria-label="Replace"
        >
          <Replace className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          className="rounded bg-red-500/30 p-1.5 text-white hover:bg-red-500/40"
          title="Delete file"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Info */}
      <div className="border-t border-navy/10 p-3">
        <p className="truncate text-xs font-medium text-navy">{file.name}</p>
        <div className="mt-1 flex items-center justify-between text-[10px] text-navy/40">
          <span>{formatSize(file.size)}</span>
          <span>{formatDate(file.created_at)}</span>
        </div>
        <div className="mt-2 flex gap-1">
          <span className="rounded bg-navy/10 px-1.5 py-0.5 text-[10px] uppercase">
            {file.type.split("/")[0]}
          </span>
        </div>
      </div>
    </div>
  );
}
