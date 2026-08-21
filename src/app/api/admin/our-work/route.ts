import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api/auth-guard";
import { createRateLimiter, getClientIp } from "@/lib/api/rate-limit";

const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30 });

// ── Zod schemas ────────────────────────────────
const createItemSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).default(""),
  videoSrc: z.string().max(500).default(""),
  video_src: z.string().max(500).default(""),
  posterImage: z.string().max(500).default(""),
  poster_image: z.string().max(500).default(""),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  sort_order: z.number().int().min(0).max(9999).default(0),
});

const updateItemSchema = z.object({
  id: z.string().min(1, "Item ID is required"),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  videoSrc: z.string().max(500).optional(),
  video_src: z.string().max(500).optional(),
  posterImage: z.string().max(500).optional(),
  poster_image: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
});

const deleteItemSchema = z.object({
  id: z.string().min(1, "Item ID is required"),
});

// ── GET: List all portfolio items ─────────────
export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const items = await prisma.ourWork.findMany({
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Portfolio fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load portfolio items" },
      { status: 500 }
    );
  }
}

// ── POST: Create a portfolio item ─────────────
export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const ip = getClientIp(request);
  if (rateLimiter.isRateLimited(`our-work:${ip}`)) {
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

  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const title = data.title.trim();
  const description = data.description.trim();
  const videoSrc = (data.videoSrc || data.video_src).trim();
  const posterImage = (data.posterImage || data.poster_image).trim();
  const sortOrder = data.sortOrder || data.sort_order;

  try {
    const item = await prisma.ourWork.create({
      data: { title, description, videoSrc, posterImage, sortOrder },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Portfolio create error:", error);
    return NextResponse.json(
      { error: "Failed to create portfolio item" },
      { status: 500 }
    );
  }
}

// ── PUT: Update a portfolio item ──────────────
export async function PUT(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const ip = getClientIp(request);
  if (rateLimiter.isRateLimited(`our-work:${ip}`)) {
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

  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { id, ...fields } = parsed.data;

  try {
    // Verify item exists
    const existing = await prisma.ourWork.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await prisma.ourWork.update({
      where: { id },
      data: {
        ...(fields.title !== undefined && { title: fields.title.trim() }),
        ...(fields.description !== undefined && { description: fields.description.trim() }),
        ...((fields.videoSrc !== undefined || fields.video_src !== undefined) && {
          videoSrc: (fields.videoSrc || fields.video_src || existing.videoSrc).trim(),
        }),
        ...((fields.posterImage !== undefined || fields.poster_image !== undefined) && {
          posterImage: (fields.posterImage || fields.poster_image || existing.posterImage).trim(),
        }),
        ...((fields.sortOrder !== undefined || fields.sort_order !== undefined) && {
          sortOrder: fields.sortOrder ?? fields.sort_order ?? existing.sortOrder,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Portfolio update error:", error);
    return NextResponse.json(
      { error: "Failed to update portfolio item" },
      { status: 500 }
    );
  }
}

// ── DELETE: Remove a portfolio item ───────────
export async function DELETE(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const ip = getClientIp(request);
  if (rateLimiter.isRateLimited(`our-work:${ip}`)) {
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

  const parsed = deleteItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { id } = parsed.data;

  try {
    const existing = await prisma.ourWork.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await prisma.ourWork.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Portfolio delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete portfolio item" },
      { status: 500 }
    );
  }
}
