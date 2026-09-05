import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isChapaConfigured,
  generateTxRef,
  initializeChapaPayment,
  normalizePhoneForChapa,
} from "@/lib/payments/chapa";

export const dynamic = "force-dynamic";

// POST /api/payments/chapa/init — initialize a Chapa hosted checkout for a
// registration and return the checkout_url the student is redirected to.
//
// The amount is read from the DB payment record (never from the browser).
// A fresh merchant_reference (tx_ref) is generated per attempt so every
// attempt is uniquely identifiable and retryable.
export async function POST(request: NextRequest) {
  try {
    if (!isChapaConfigured()) {
      return NextResponse.json(
        { error: "Online payments are temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const referenceId = typeof body.referenceId === "string" ? body.referenceId.trim() : "";
    if (!referenceId) {
      return NextResponse.json({ error: "Missing referenceId" }, { status: 400 });
    }

    const application = await prisma.application.findUnique({
      where: { referenceId },
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
    if (payment.status === "SUCCESS") {
      return NextResponse.json({ success: true, alreadyPaid: true, status: "SUCCESS" });
    }

    // Split the student's full name for Chapa.
    const [first_name = application.fullName, ...rest] = application.fullName.trim().split(/\s+/);
    const last_name = rest.join(" ") || first_name;

    const merchantReference = generateTxRef(application.referenceId);
    const result = await initializeChapaPayment({
      amount: payment.amount,
      currency: payment.currency,
      merchantReference,
      customer: {
        first_name,
        last_name,
        email: application.email,
        phone_number: normalizePhoneForChapa(application.phone),
      },
      meta: { referenceId: application.referenceId },
    });

    // Record the attempt. Re-initializing resets a failed/cancelled attempt
    // back to PENDING with the new references.
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "PENDING",
        merchantReference,
        chapaReference: result.chapaReference || null,
        notes: null,
      },
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: result.checkoutUrl,
      merchantReference,
      chapaReference: result.chapaReference,
    });
  } catch (error) {
    console.error("Chapa init error:", error);
    const message = error instanceof Error ? error.message : "Failed to start payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}