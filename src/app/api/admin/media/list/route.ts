import { NextResponse } from "next/server";
import { listFiles } from "@/lib/media/storage";
import { requireAdmin } from "@/lib/api/auth-guard";

// ── GET: List media files ─────────────────────
export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const folder = (url.searchParams.get("folder") || "").toLowerCase();

    const files = await listFiles(folder);

    return NextResponse.json({ files, folder });
  } catch (error) {
    console.error("Media list error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
