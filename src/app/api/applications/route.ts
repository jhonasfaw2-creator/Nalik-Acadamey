import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// ── Server-side Zod schema (mirrors the client schema) ──
const applicationSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  email: z.string().email("Please enter a valid email address"),
  age: z
    .string()
    .min(1, "Please enter your age")
    .refine((val) => !isNaN(Number(val)) && Number.isInteger(Number(val)), {
      message: "Please enter a valid age",
    })
    .refine((val) => Number(val) >= 14 && Number(val) <= 80, {
      message: "Age must be between 14 and 80",
    }),
  location: z.string().min(2, "Please enter your location"),
  program: z.string().min(1, "Please select a program"),
  skillLevel: z.string().min(1, "Please select your skill level"),
  previousExperience: z.string().min(1, "Please select your experience level"),
  schedule: z.string().min(1, "Please select a preferred schedule"),
  motivation: z
    .string()
    .min(20, "Please tell us a bit more (at least 20 characters)")
    .max(500, "Please keep your response under 500 characters"),

});

// ── Rate-limit: simple in-memory guard ─────────
const recentSubmissions = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const last = recentSubmissions.get(ip);
  if (last && now - last < RATE_LIMIT_MS) return true;
  recentSubmissions.set(ip, now);
  // Cleanup old entries periodically
  if (recentSubmissions.size > 100) {
    for (const [key, timestamp] of recentSubmissions) {
      if (now - timestamp > RATE_LIMIT_MS) recentSubmissions.delete(key);
    }
  }
  return false;
}

export async function POST(request: Request) {
  try {
    // ── Rate limit check ─────────────────────────
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many submissions. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    // ── Parse and validate body ───────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body. Please submit the form again." },
        { status: 400 }
      );
    }

    const parsed = applicationSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid form data" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // ── Duplicate check ───────────────────────────
    const existing = await prisma.application.findFirst({
      where: {
        email: data.email.toLowerCase().trim(),
        program: data.program,
      },
      select: { id: true, fullName: true },
    });

    if (existing) {
      return NextResponse.json(
        {
          error:
            "You have already applied for this program. Please contact us if you need to update your application.",
        },
        { status: 409 }
      );
    }

    // ── Insert application ────────────────────────
    const inserted = await prisma.application.create({
      data: {
        fullName: data.fullName.trim(),
        phone: data.phone.trim(),
        email: data.email.toLowerCase().trim(),
        age: Number(data.age),
        location: data.location.trim(),
        program: data.program,
        skillLevel: data.skillLevel,
        experience: data.previousExperience,
        preferredSchedule: data.schedule,
        motivation: data.motivation.trim(),
        status: "pending",
      },
    });

    // ── Success response ──────────────────────────
    return NextResponse.json(
      {
        success: true,
        applicationId: inserted.id,
        message: "Application submitted successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Application submission error:", error);

    // Distinguish between known error types
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid form data. Please check your inputs." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while processing your application. Please try again later.",
      },
      { status: 500 }
    );
  }
}
