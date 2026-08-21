import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api/auth-guard";
import { createRateLimiter, getClientIp } from "@/lib/api/rate-limit";

const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 40 });

const VALID_STATUSES = ["pending", "approved", "rejected"] as const;

const patchSchema = z.object({
  status: z.enum(VALID_STATUSES),
});

const paramsSchema = z.object({
  id: z.string().min(1, "Application ID is required"),
});

// ── PATCH: Update application status ──────────
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const ip = getClientIp(request);
  if (rateLimiter.isRateLimited(`apps:${ip}`)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait." },
      { status: 429 }
    );
  }

  try {
    const { id } = paramsSchema.parse(await params);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid status value" },
        { status: 400 }
      );
    }

    const data = await prisma.application.update({
      where: { id },
      data: { status: parsed.data.status },
      select: {
        id: true,
        fullName: true,
        program: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ application: data });
  } catch (error) {
    console.error("PATCH error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// ── DELETE: Remove an application ─────────────
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const ip = getClientIp(request);
  if (rateLimiter.isRateLimited(`apps:${ip}`)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait." },
      { status: 429 }
    );
  }

  try {
    const { id } = paramsSchema.parse(await params);

    await prisma.application.delete({ where: { id } });

    return NextResponse.json({ message: "Application deleted" });
  } catch (error) {
    console.error("DELETE error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
