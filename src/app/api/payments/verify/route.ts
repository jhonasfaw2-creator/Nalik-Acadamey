import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isChapaConfigured,
  verifyChapaTransaction,
  PaymentNotFoundError,
} from "@/lib/payments/chapa";
import { applyChapaPaymentResult, mapChapaStatus } from "@/lib/payments/apply";
import { ensurePaymentForApplication } from "@/lib/payments/record";

export const dynamic = "force-dynamic";

// GET/POST /api/payments/verify — authoritative server-side verification.
//
// Finds the payment for a registration (by referenceId), verifies its stored
// tx_ref against Chapa's verify endpoint and, when Chapa confirms success (and
// the amount + currency match the stored payment), marks the payment SUCCESS
// and the registration PAID. The browser (Inline.js success callback) is a
// signal only and is never trusted on its own.
async function handle(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const referenceId =
      (typeof body.referenceId === "string" ? body.referenceId.trim() : "") ||
      searchParams.get("referenceId")?.trim() ||
      "";

    if (!referenceId) {
      return NextResponse.json({ error: "Missing referenceId" }, { status: 400 });
    }

    const application = await prisma.application.findUnique({
      where: { referenceId },
      // Deliberately minimal: this endpoint is public, so it never returns
      // student PII (name / email / phone).
      select: {
        id: true,
        referenceId: true,
        status: true,
        course: { select: { title: true, price: true, discountPrice: true, discountLabel: true } },
        schedule: { select: { group: true, session: true, days: true, startTime: true, endTime: true } },
      },
    });
    if (!application) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    // Legacy registrations (pre-online-payments) have no Payment row.
    const payment = await ensurePaymentForApplication(application.id);
    if (!payment) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    // Already confirmed — short-circuit with the summary.
    if (payment.status === "SUCCESS") {
      return NextResponse.json(buildSummary(application, payment));
    }

    if (!isChapaConfigured() || !payment.txRef) {
      // No attempt initialized yet (or not configured): stay pending.
      return NextResponse.json(buildSummary(application, payment));
    }

    let verification;
    try {
      verification = await verifyChapaTransaction(payment.txRef);
    } catch (error) {
      if (error instanceof PaymentNotFoundError) {
        // Chapa does not know this tx_ref (yet). Stay pending.
        return NextResponse.json(buildSummary(application, payment));
      }
      console.error("Chapa verify error:", error);
      return NextResponse.json(
        { ...buildSummary(application, payment), error: "Verification temporarily unavailable. Please try again." },
        { status: 502 }
      );
    }

    await applyChapaPaymentResult(payment.id, {
      status: mapChapaStatus(verification.status),
      chapaReference: verification.chapaReference,
      txRef: verification.txRef || payment.txRef || undefined,
      amount: verification.amount,
      currency: verification.currency,
      method: verification.method,
      charge: verification.charge,
      raw: verification,
    });

    // Re-read to return fresh state (payment AND application status — the
    // application may have just flipped PENDING → PAID above).
    const [updated, updatedApplication] = await Promise.all([
      prisma.payment.findUnique({ where: { id: payment.id } }),
      prisma.application.findUnique({ where: { id: application.id }, select: { status: true } }),
    ]);
    return NextResponse.json(
      buildSummary({ ...application, status: updatedApplication?.status ?? application.status }, updated ?? payment)
    );
  } catch (error) {
    console.error("Payment verify error:", error);
    return NextResponse.json({ error: "Failed to verify payment" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

function buildSummary(
  application: {
    referenceId: string;
    status: string;
    course: { title: string; price: number; discountPrice: number | null; discountLabel: string | null } | null;
    schedule: { group: string; session: string; days: string; startTime: string; endTime: string } | null;
  },
  payment: {
    amount: number;
    currency: string;
    status: string;
    txRef: string | null;
    chapaReference: string | null;
    method: string | null;
    paidAt: Date | null;
  }
): Record<string, unknown> {
  return {
    status: payment.status,
    registration: {
      referenceId: application.referenceId,
      registrationStatus: application.status,
      course: application.course?.title || null,
      schedule: application.schedule
        ? `SCHEDULE ${application.schedule.group}: ${application.schedule.session} (${application.schedule.days}, ${application.schedule.startTime}–${application.schedule.endTime})`
        : null,
      amount: payment.amount,
      currency: payment.currency,
      paymentStatus: payment.status,
      paymentMethod: payment.method,
      txRef: payment.txRef,
      chapaReference: payment.chapaReference,
      paidAt: payment.paidAt,
    },
  };
}
