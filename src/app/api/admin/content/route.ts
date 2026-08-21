import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api/auth-guard";
import { createRateLimiter, getClientIp } from "@/lib/api/rate-limit";

const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30 });

// ── Valid content keys (must match SECTION_CONFIGS) ──
const VALID_KEYS = [
  "hero",
  "about",
  "what_we_teach",
  "featured_courses",
  "founder",
  "our_work",
  "career_path",
  "learning_process",
  "contact",
  "final_cta",
  "footer",
  "programs",
] as const;

const MAX_VALUE_SIZE = 50_000; // 50KB per section

// ── Zod schema ────────────────────────────────
const updateContentSchema = z.object({
  key: z.enum(VALID_KEYS),
  value: z.record(z.string(), z.string()),
});

// ── GET: Fetch all site content ───────────────
export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const rows = await prisma.websiteContent.findMany({
      orderBy: { key: "asc" },
    });

    const content: Record<string, Record<string, string>> = {};
    for (const row of rows) {
      try {
        content[row.key] = JSON.parse(row.value);
      } catch {
        content[row.key] = {};
      }
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Content fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    );
  }
}

// ── PUT: Update site content ──────────────────
export async function PUT(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const ip = getClientIp(request);
  if (rateLimiter.isRateLimited(`content:${ip}`)) {
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

  const parsed = updateContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { key, value } = parsed.data;

  // Validate serialized size to prevent oversized payloads
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_VALUE_SIZE) {
    return NextResponse.json(
      { error: `Content too large (max ${MAX_VALUE_SIZE / 1000}KB)` },
      { status: 400 }
    );
  }

  try {
    await prisma.websiteContent.upsert({
      where: { key },
      update: { value: serialized },
      create: { key, value: serialized },
    });

    return NextResponse.json({ message: "Content updated", key });
  } catch (error) {
    console.error("Content update error:", error);
    return NextResponse.json(
      { error: "Failed to update content" },
      { status: 500 }
    );
  }
}
