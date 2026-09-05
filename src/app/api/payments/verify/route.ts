import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isChapaConfigured, verifyChapaPayment, PaymentNotFoundError } from "@/lib/payments/chapa";
import { applyChapaPaymentResult, mapChapaStatus } from "@/lib/payments/apply";

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
        referenceId: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        course: { select: { title: true, price: true, discountPrice: true, discountLabel: true } },
        schedule: { select: { batchName: true, days: true, startTime: true, endTime: true, startDate: true } },
      },
    });
    if (!application) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    const payment = await prisma.payment.findUnique({
      where: { applicationId: application.id },
    });
    if (!payment) {
      return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
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
        // Chapa doesn't know this reference yet — payment may still be in
        // progress. Keep pending; the webhook will resolve it.
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
      merchantReference: verification.merchantReference || payment.merchantReference || undefined,
      amount: verification.amount,
      currency: verification.currency,
      method: verification.method,
      serviceFee: verification.serviceFee,
      raw: verification,
    });

    // Re-read to return fresh state.
    const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
    return NextResponse.json(buildSummary(application, updated ?? payment));
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
    schedule: { batchName: string; days: string; startTime: string; endTime: string; startDate: Date } | null;
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
        ? `${application.schedule.batchName} — ${application.schedule.days}, ${application.schedule.startTime}–${application.schedule.endTime} (starts ${application.schedule.startDate.toISOString().slice(0, 10)})`
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