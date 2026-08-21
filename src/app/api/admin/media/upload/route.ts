import { NextResponse } from "next/server";
import { uploadFile } from "@/lib/media/storage";
import { requireAdmin } from "@/lib/api/auth-guard";
import { createRateLimiter, getClientIp } from "@/lib/api/rate-limit";

const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 15 });

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

const ALLOWED_FOLDERS = ["hero", "about", "our-work", "portfolio", "uploads"];

// ── POST: Upload a media file ─────────────────
export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const ip = getClientIp(request);
  if (rateLimiter.isRateLimited(`media-upload:${ip}`)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait." },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const rawFolder = (formData.get("folder") as string) || "uploads";
    const folder = rawFolder.toLowerCase().trim();

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_SIZE / (1024 * 1024)}MB)` },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed. Use JPG, PNG, WebP, GIF, SVG, MP4, WebM, or MOV." },
        { status: 400 }
      );
    }

    // Validate folder against whitelist
    if (!ALLOWED_FOLDERS.includes(folder)) {
      return NextResponse.json(
        { error: `Invalid folder. Allowed: ${ALLOWED_FOLDERS.join(", ")}` },
        { status: 400 }
      );
    }

    const result = await uploadFile(file, folder);

    return NextResponse.json(
      {
        url: result.url,
        path: result.path,
        size: result.size,
        type: result.type,
        filename: result.filename,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Media upload error:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
