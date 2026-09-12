import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isValidChapaWebhook,
  verifyChapaTransaction,
  PaymentNotFoundError,
  chapaSecretKey,
  type ChapaVerification,
} from "@/lib/payments/chapa";
import { applyChapaPaymentResult, mapChapaStatus } from "@/lib/payments/apply";

export const dynamic = "force-dynamic";

// POST /api/webhooks/chapa — Chapa's official webhook endpoint.
// Docs: https://developer.chapa.co/integrations/webhooks
//
// Security model (the webhook payload is a signal, not proof):
//   1. Verify the signature over the RAW body before parsing anything.
//   2. Locate the registration/payment by tx_ref.
//   3. Re-query Chapa's verify endpoint and drive the state change from the
//      VERIFIED data — never from the payload alone.
//   4. Cross-check tx_ref, amount, currency and status; only a fully matching
//      success can mark the registration PAID.
//   5. Apply idempotently, so duplicate/out-of-order deliveries cannot double
//      count a seat or corrupt the registration.
//   6. Return HTTP 200 once the event is correctly processed or acknowledged.
//      (Non-2xx is reserved for transient failures so Chapa retries, and for
//      unauthenticated requests, which are discarded.)
export async function POST(request: NextRequest) {
  // 1. Raw body is required for HMAC verification.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  // 2. Verify the signature BEFORE doing anything else.
  const secretConfigured = Boolean(process.env.CHAPA_WEBHOOK_SECRET?.trim());
  if (secretConfigured) {
    const valid = isValidChapaWebhook(
      rawBody,
      request.headers.get("x-chapa-signature"),
      request.headers.get("chapa-signature")
    );
    if (!valid) {
      console.warn("[chapa-webhook] invalid signature — rejecting");
      return NextResponse.json({ success: false }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Without the secret we cannot verify the sender, and accepting unsigned
    // deliveries in production would let an attacker forge payment events.
    // Fail closed and let Chapa retry until the operator configures it.
    console.error("[chapa-webhook] CHAPA_WEBHOOK_SECRET is not set — rejecting all webhooks in production");
    return NextResponse.json({ success: false }, { status: 503 });
  }

  // Re-verification needs the secret key; without it we cannot confirm anything.
  if (!chapaSecretKey()) {
    console.error("[chapa-webhook] CHAPA_SECRET_KEY is not set — cannot re-verify, asking Chapa to retry");
    return NextResponse.json({ success: false }, { status: 503 });
  }

  // 3. Parse.
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const event = typeof payload.event === "string" ? payload.event : "";
  const txRef = typeof payload.tx_ref === "string" ? payload.tx_ref.trim() : "";

  // Event types we deliberately don't act on — acknowledge so Chapa stops retrying.
  if (payload.type === "Payout" || event.startsWith("payout.")) {
    console.log(`[chapa-webhook] acknowledged payout event: ${event || "(none)"}`);
    return NextResponse.json({ success: true, applied: false });
  }
  if (event.startsWith("charge.refunded") || event.startsWith("charge.reversed")) {
    console.log(`[chapa-webhook] acknowledged refund/reversal event: ${event}`);
    return NextResponse.json({ success: true, applied: false });
  }

  if (!txRef) {
    console.warn(`[chapa-webhook] event without tx_ref: ${event || "(none)"} — acknowledged`);
    return NextResponse.json({ success: true, applied: false });
  }

  // 4. Find the registration/payment using tx_ref.
  const payment = await prisma.payment.findUnique({
    where: { txRef },
    select: { id: true, status: true, amount: true, currency: true, txRef: true },
  });
  if (!payment) {
    // Belongs to another system, or the attempt was rotated to a new tx_ref by
    // a retry (a late signal for a stale reference). Acknowledge.
    console.warn(`[chapa-webhook] no payment matched tx_ref=${txRef} — acknowledged`);
    return NextResponse.json({ success: true, applied: false });
  }

  // 5. Re-verify the transaction with Chapa.
  let verification: ChapaVerification;
  try {
    verification = await verifyChapaTransaction(txRef);
  } catch (error) {
    if (error instanceof PaymentNotFoundError) {
      // Chapa has no such transaction. Nothing trustworthy to apply.
      console.warn(`[chapa-webhook] Chapa has no verified transaction for tx_ref=${txRef} — not applying`);
      return NextResponse.json({ success: true, applied: false });
    }
    // Transient (network/DB) failure → surface non-2xx so Chapa retries.
    console.error("[chapa-webhook] re-verify failed:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }

  const verifiedStatus = mapChapaStatus(verification.status);
  const eventStatus = mapChapaStatus(
    typeof payload.status === "string" ? payload.status : event.replace(/^charge\./, "")
  );

  // 6. Cross-check the verified data. tx_ref must match the one we looked up.
  if (verification.txRef && verification.txRef !== txRef) {
    console.error(`[chapa-webhook] tx_ref mismatch — payload=${txRef} verified=${verification.txRef}; not applying`);
    return NextResponse.json({ success: true, applied: false });
  }

  const amountMatches = Math.round(verification.amount) === payment.amount;
  const currencyMatches = verification.currency.toUpperCase() === payment.currency.toUpperCase();

  if (verifiedStatus === "SUCCESS" && (!amountMatches || !currencyMatches)) {
    console.error(
      `[chapa-webhook] amount/currency mismatch for tx_ref=${txRef}: verified ${verification.amount} ${verification.currency}, expected ${payment.amount} ${payment.currency} — not marking paid`
    );
  }

  // 7. Apply idempotently. applyChapaPaymentResult re-checks amount + currency
  //    and refuses to mark a payment SUCCESS on any mismatch, and it never
  //    downgrades an already-SUCCESS payment (so duplicate deliveries cannot
  //    double-count the seat or corrupt the registration).
  try {
    const result = await applyChapaPaymentResult(payment.id, {
      status: verifiedStatus,
      chapaReference: verification.chapaReference,
      txRef: verification.txRef || txRef,
      amount: verification.amount,
      currency: verification.currency,
      method: verification.method,
      charge: verification.charge,
      raw: { event, payload, verification, eventStatus },
    });

    console.log(
      `[chapa-webhook] tx_ref=${txRef} event=${event} eventStatus=${eventStatus} verifiedStatus=${verifiedStatus} applied=${result?.changed ?? false} payment=${result?.paymentStatus ?? payment.status}`
    );

    // 8. Acknowledge.
    return NextResponse.json({ success: true });
  } catch (error) {
    // A DB failure must surface as non-2xx so Chapa retries the delivery;
    // otherwise the payment could be stuck in PENDING forever.
    console.error("[chapa-webhook] processing failed:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
