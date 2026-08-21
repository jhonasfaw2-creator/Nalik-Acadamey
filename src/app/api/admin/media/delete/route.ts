import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteFile } from "@/lib/media/storage";
import { requireAdmin } from "@/lib/api/auth-guard";
import { createRateLimiter, getClientIp } from "@/lib/api/rate-limit";

const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20 });

// ── Path validation ────────────────────────────
const ALLOWED_PATH_PREFIXES = ["media/"];

function isPathSafe(filePath: string): boolean {
  // Must not be empty
  if (!filePath) return false;
  // Must start with an allowed prefix
  if (!ALLOWED_PATH_PREFIXES.some((p) => filePath.startsWith(p))) return false;
  // Must not contain path traversal sequences
  if (filePath.includes("..") || filePath.includes("~")) return false;
  // Must not be the root media directory itself
  if (filePath === "media" || filePath === "media/") return false;
  return true;
}

// ── Zod schema ────────────────────────────────
const deleteSchema = z.object({
  path: z.string().min(1, "File path is required").max(500),
});

// ── POST: Delete a media file ─────────────────
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { path: filePath } = parsed.data;

  if (!isPathSafe(filePath)) {
    return NextResponse.json(
      { error: "Invalid file path" },
      { status: 400 }
    );
  }

  try {
    await deleteFile(filePath);
    return NextResponse.json({ message: "File deleted" });
  } catch (error) {
    console.error("Media delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
