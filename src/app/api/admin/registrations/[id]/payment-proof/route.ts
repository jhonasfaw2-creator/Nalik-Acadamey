import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

// Only authenticated admins should reach this endpoint (middleware protected).
export async function GET(
  _request: NextRequest,
  { params }: Context,
) {
  try {
    const { id } = await params;
    const registration = await prisma.registration.findUnique({
      where: { id },
      select: { paymentProofPath: true },
    });

    if (!registration?.paymentProofPath) {
      return NextResponse.json({ error: "Payment screenshot not found." }, { status: 404 });
    }

    const result = await get(registration.paymentProofPath, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (!result) {
      return NextResponse.json({ error: "Payment screenshot not found." }, { status: 404 });
    }

    return new Response(result.stream, {
      headers: {
        "Content-Type": result.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Payment screenshot retrieval failed:", error);
    return NextResponse.json({ error: "Unable to retrieve payment screenshot." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: Context,
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!body || !["APPROVED", "REJECTED"].includes(body.status)) {
      return NextResponse.json(
        { error: "Status must be APPROVED or REJECTED." },
        { status: 400 },
      );
    }

    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const registration = await tx.registration.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          scheduleId: true,
          paymentProofPath: true,
          paymentProofStatus: true,
        },
      });

      if (!registration) throw new Error("NOT_FOUND");
      if (!registration.paymentProofPath) throw new Error("NO_PROOF");
      if (registration.paymentProofStatus !== "PENDING_REVIEW") throw new Error("NOT_PENDING");

      if (body.status === "REJECTED") {
        return tx.registration.update({
          where: { id },
          data: {
            paymentProofStatus: "REJECTED",
            paymentProofReviewedAt: new Date(),
            paymentProofNote: note,
          },
        });
      }

      const alreadyHoldsSeat =
        registration.status === "PAID" || registration.status === "CONFIRMED";

      if (!alreadyHoldsSeat) {
        if (!registration.scheduleId) throw new Error("SCHEDULE_REQUIRED");

        const schedule = await tx.schedule.findUnique({
          where: { id: registration.scheduleId },
          select: {
            id: true,
            active: true,
            enrolled: true,
            maxSeats: true,
            availabilityOverride: true,
          },
        });

        if (!schedule) throw new Error("SCHEDULE_NOT_FOUND");
        if (!schedule.active || schedule.availabilityOverride === false) {
          throw new Error("SCHEDULE_UNAVAILABLE");
        }

        // Count actual confirmed/PAID registrations for this schedule instead of
        // trusting the manual enrolled counter, which can drift out of sync.
        const actualEnrolled = await tx.registration.count({
          where: {
            scheduleId: schedule.id,
            status: { in: ["PAID", "CONFIRMED"] },
          },
        });

        if (actualEnrolled >= schedule.maxSeats) throw new Error("SCHEDULE_FULL");

        const seat = await tx.schedule.updateMany({
          where: {
            id: schedule.id,
            enrolled: { lt: schedule.maxSeats },
            active: true,
            OR: [ { availabilityOverride: null }, { availabilityOverride: true } ],
          },
          data: { enrolled: { increment: 1 } },
        });
        if (seat.count !== 1) throw new Error("SCHEDULE_FULL");
      }

      return tx.registration.update({
        where: { id },
        data: {
          status: "CONFIRMED",
          paidAt: new Date(),
          paymentProofStatus: "APPROVED",
          paymentProofReviewedAt: new Date(),
          paymentProofNote: note,
        },
      });
    });

    return NextResponse.json({ success: true, registration: updated });
  } catch (error) {
    const messages: Record<string, { error: string; status: number }> = {
      NOT_FOUND: { error: "Registration not found.", status: 404 },
      NO_PROOF: { error: "No payment screenshot was submitted.", status: 409 },
      NOT_PENDING: { error: "This screenshot has already been reviewed or is not pending.", status: 409 },
      SCHEDULE_REQUIRED: { error: "A schedule is required before confirming enrollment.", status: 409 },
      SCHEDULE_NOT_FOUND: { error: "Schedule not found.", status: 404 },
      SCHEDULE_UNAVAILABLE: { error: "The schedule is inactive or unavailable.", status: 409 },
      SCHEDULE_FULL: { error: "The schedule is full.", status: 409 },
    };

    if (error instanceof Error && messages[error.message]) {
      const response = messages[error.message];
      return NextResponse.json({ error: response.error }, { status: response.status });
    }

    console.error("Payment proof review failed:", error);
    return NextResponse.json({ error: "Unable to review payment screenshot." }, { status: 500 });
  }
}
