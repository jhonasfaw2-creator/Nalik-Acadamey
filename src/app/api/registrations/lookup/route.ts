import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAndIncrement } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// GET /api/registrations/lookup?id=NA-2026-XXXXXX — public registration lookup.
//
// Security model:
//   - The reference ID itself is the capability: it is long, random, and
//     unguessable (32-char alphabet, 6 chars ≈ 1B combinations), so knowing it
//     is treated as proof of ownership — same trust model as a package
//     tracking number.
//   - Strict per-IP rate limiting (20/min) blunts brute-force guessing.
//   - The response exposes ONLY schedule/enrollment data. No email, no phone,
//     no age, no tx_ref, no chapaReference, no amount-audit fields — a leaked
//     ID reveals nothing further.
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkAndIncrement(`lookup:${ip}`, 20, 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  const id = (request.nextUrl.searchParams.get("id") || "").trim().toUpperCase();
  if (!id) {
    return NextResponse.json({ error: "Registration ID is required" }, { status: 400 });
  }

  // Cheap shape guard: our IDs are NA-YYYY-XXXXXX. Anything else can be
  // rejected without touching the database.
  if (!/^NA-\d{4}-[A-Z2-9]{6}$/.test(id)) {
    return NextResponse.json({ found: false, error: "That registration ID doesn't look right. Check it and try again (format: NA-YYYY-XXXXXX)." }, { status: 404 });
  }

  try {
    const application = await prisma.application.findUnique({
      where: { referenceId: id },
      select: {
        referenceId: true,
        fullName: true,
        status: true,
        course: { select: { title: true } },
        schedule: {
          select: { group: true, session: true, days: true, startTime: true, endTime: true, startDate: true },
        },
        payment: {
          select: {
            status: true,
            amount: true,
            currency: true,
            paidAt: true,
            // txRef / chapaReference deliberately NOT selected.
          },
        },
      },
    });

    if (!application) {
      return NextResponse.json(
        { found: false, error: "We couldn't find a registration with that ID. Double-check it, or contact us if you think this is a mistake." },
        { status: 404 }
      );
    }

    const payment = application.payment;

    return NextResponse.json({
      found: true,
      registration: {
        referenceId: application.referenceId,
        fullName: application.fullName,
        course: application.course?.title || null,
        schedule: application.schedule
          ? {
              days: application.schedule.days,
              session: application.schedule.session,
              group: application.schedule.group,
              startTime: application.schedule.startTime,
              endTime: application.schedule.endTime,
              startDate: application.schedule.startDate
                ? application.schedule.startDate.toISOString()
                : null,
            }
          : null,
        amount: payment?.amount ?? null,
        currency: payment?.currency ?? null,
        paymentStatus: payment?.status ?? "PENDING",
        registrationStatus: application.status,
        paidAt: payment?.paidAt ? payment.paidAt.toISOString() : null,
      },
    });
  } catch (error) {
    console.error("Registration lookup error:", error);
    return NextResponse.json({ error: "Failed to look up registration" }, { status: 500 });
  }
}
