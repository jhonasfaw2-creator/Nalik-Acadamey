import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isChapaConfigured, verifyChapaPayment, PaymentNotFoundError } from "@/lib/payments/chapa";
import { applyChapaPaymentResult, mapChapaStatus } from "@/lib/payments/apply";
import { ensurePaymentForApplication } from "@/lib/payments/record";

export const dynamic = "force-dynamic";

// GET/POST /api/payments/verify — server-side verification of a payment.
//
// Finds the payment for a registration (by referenceId), verifies it against
// Chapa's /verify endpoint and, when Chapa confirms SUCCESS (and the amount
// and currency match the stored payment), marks the payment SUCCESS and the
// registration PAID. A frontend success page is never trusted on its own.
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
      select: {
        id: true,
        referenceId: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        course: { select: { title: true, price: true, discountPrice: true, discountLabel: true } },
        schedule: { select: { group: true, session: true, days: true, startTime: true, endTime: true } },
      },
    });
    if (!application) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    // Legacy registrations (pre-online-payments) have no Payment row — create
    // the missing PENDING payment on the spot so status checks work for them.
    const payment = await ensurePaymentForApplication(application.id);
    if (!payment) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    // Already confirmed — short-circuit with the summary.
    if (payment.status === "SUCCESS") {
      return NextResponse.json(buildSummary(application, payment));
    }

    if (!isChapaConfigured() || !payment.chapaReference) {
      // No attempt initialized yet (or not configured): stay pending.
      return NextResponse.json(buildSummary(application, payment));
    }

    let verification;
    try {
      verification = await verifyChapaPayment(payment.chapaReference);
    } catch (error) {
      if (error instanceof PaymentNotFoundError) {
        // Chapa doesn't know this reference. Right after init it may simply not
        // have propagated yet — keep pending for a grace period. But if the
        // checkout was minted a while ago and Chapa has forgotten it (expired /
        // invalidated session), the student would otherwise spin on PENDING
        // forever. Surface that so the client mints a fresh checkout.
        const ageMs = payment.updatedAt ? Date.now() - new Date(payment.updatedAt).getTime() : 0;
        const summary = buildSummary(application, payment);
        if (payment.chapaReference && ageMs > 60_000) {
          return NextResponse.json({ ...summary, sessionExpired: true });
        }
        return NextResponse.json(summary);
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
      merchantReference: verification.merchantReference || payment.merchantReference || undefined,
      amount: verification.amount,
      currency: verification.currency,
      method: verification.method,
      serviceFee: verification.serviceFee,
      raw: verification,
    });

    // Re-read to return fresh state (payment AND application status — the
    // application may have just flipped PENDING_PAYMENT → PAID above).
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
    fullName: string;
    email: string;
    phone: string;
    status: string;
    course: { title: string; price: number; discountPrice: number | null; discountLabel: string | null } | null;
    schedule: { group: string; session: string; days: string; startTime: string; endTime: string } | null;
  },
  payment: { amount: number; currency: string; status: string; merchantReference: string | null; chapaReference: string | null; method: string | null; paidAt: Date | null }
): Record<string, unknown> {
  return {
    status: payment.status,
    registration: {
      referenceId: application.referenceId,
      fullName: application.fullName,
      email: application.email,
      phone: application.phone,
      registrationStatus: application.status,
      course: application.course?.title || null,
      schedule: application.schedule
        ? `SCHEDULE ${application.schedule.group}: ${application.schedule.session} (${application.schedule.days}, ${application.schedule.startTime}–${application.schedule.endTime})`
        : null,
      amount: payment.amount,
      currency: payment.currency,
      paymentStatus: payment.status,
      paymentMethod: payment.method,
      merchantReference: payment.merchantReference,
      chapaReference: payment.chapaReference,
      paidAt: payment.paidAt,
    },
  };
}