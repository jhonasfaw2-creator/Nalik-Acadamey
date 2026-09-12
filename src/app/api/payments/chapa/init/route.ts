import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isChapaConfigured,
  chapaPublicKey,
  generateTxRef,
  normalizePhoneForChapa,
} from "@/lib/payments/chapa";
import { ensurePaymentForApplication } from "@/lib/payments/record";

export const dynamic = "force-dynamic";

// POST /api/payments/chapa/init — prepare an Inline.js checkout for a
// registration.
//
// Inline.js charges through Chapa in the browser, so this endpoint does not
// initialize anything with Chapa. It returns the PUBLIC key and the
// authoritative, server-computed amount/tx_ref for the client to hand to
// `new ChapaCheckout(...)`. The amount is read from the DB payment record
// (never from the browser), and every attempt gets a fresh unique tx_ref.
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
    // Retries (and any resume of an existing registration) mint a fresh
    // tx_ref; Chapa rejects a tx_ref that has already been charged.
    const rotate = body.rotate === true;
    if (!referenceId) {
      return NextResponse.json({ error: "Missing referenceId" }, { status: 400 });
    }

    const application = await prisma.application.findUnique({
      where: { referenceId },
      select: { id: true, referenceId: true, fullName: true, email: true, phone: true },
    });
    if (!application) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    // Legacy registrations (pre-online-payments) have no Payment row — create
    // the missing PENDING payment on the spot so they become payable.
    const payment = await ensurePaymentForApplication(application.id);
    if (!payment) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }
    if (payment.status === "SUCCESS") {
      return NextResponse.json({ success: true, alreadyPaid: true, status: "SUCCESS" });
    }

    // Re-check right before writing so a webhook that settled the payment in
    // the meantime can never be downgraded back to PENDING.
    const current = await prisma.payment.findUnique({ where: { id: payment.id } });
    if (!current || current.status === "SUCCESS") {
      return NextResponse.json({ success: true, alreadyPaid: true, status: "SUCCESS" });
    }

    // The registration already minted a tx_ref before payment. Reuse it for
    // the first attempt; on a retry mint a fresh one (Chapa rejects a reused
    // tx_ref), so every attempt stays uniquely identifiable.
    const reuseExisting =
      !rotate && current.status === "PENDING" && !current.chapaReference && Boolean(current.txRef);
    const txRef = reuseExisting ? (current.txRef as string) : generateTxRef(application.referenceId);

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "PENDING", txRef, chapaReference: null, notes: null },
    });

    return NextResponse.json({
      success: true,
      alreadyPaid: false,
      publicKey: chapaPublicKey(),
      amount: payment.amount,
      currency: payment.currency,
      txRef,
      referenceId: application.referenceId,
      mobile: normalizePhoneForChapa(application.phone),
    });
  } catch (error) {
    console.error("Chapa init error:", error);
    // Never surface internal error details to the browser.
    return NextResponse.json({ error: "Unable to start payment. Please try again." }, { status: 500 });
  }
}
