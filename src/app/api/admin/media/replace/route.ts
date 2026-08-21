import { NextResponse } from "next/server";
import { replaceFile } from "@/lib/media/storage";
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

// ── Path validation (same rules as delete) ────
const ALLOWED_PATH_PREFIXES = ["media/"];

function isPathSafe(filePath: string): boolean {
  if (!filePath) return false;
  if (!ALLOWED_PATH_PREFIXES.some((p) => filePath.startsWith(p))) return false;
  if (filePath.includes("..") || filePath.includes("~")) return false;
  if (filePath === "media" || filePath === "media/") return false;
  return true;
}

// ── POST: Replace an existing file ────────────
export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const ip = getClientIp(request);
  if (rateLimiter.isRateLimited(`media:${ip}`)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait." },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const filePath = formData.get("path") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!filePath) {
      return NextResponse.json({ error: "File path is required" }, { status: 400 });
    }

    if (!isPathSafe(filePath)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_SIZE / (1024 * 1024)}MB)` },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }

    const result = await replaceFile(file, filePath);

    return NextResponse.json({
      success: true,
      url: result.url,
      path: result.path,
      size: result.size,
      type: result.type,
      message: "File replaced successfully",
    });
  } catch (error) {
    console.error("Media replace error:", error);
    return NextResponse.json({ error: "Failed to replace file" }, { status: 500 });
  }
}
