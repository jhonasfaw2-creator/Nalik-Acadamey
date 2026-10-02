import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isValidChapaWebhook,
  verifyChapaTransaction,
  PaymentNotFoundError,
  chapaV2SecretKey,
  chapaWebhookSecret,
  type ChapaVerification,
} from "@/lib/payments/chapa";
import { applyChapaPaymentResult, mapChapaStatus } from "@/lib/payments/apply";

export const dynamic = "force-dynamic";

// POST /api/webhooks/chapa — Chapa v2 payment webhook endpoint.
// V2 events identify the local payment by merchant_reference and carry the
// provider's chapa_reference for authoritative server-side verification.
//
// Security model (the webhook payload is a signal, not proof):
//   1. Verify the signature over the RAW body before parsing anything.
//   2. Locate the registration/payment by merchant_reference.
//   3. Re-query Chapa's v2 verify endpoint and drive the state change from the
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
  let rawBody: Buffer;
  try {
    rawBody = Buffer.from(await request.arrayBuffer());
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  // 2. Verify the signature BEFORE doing anything else.
  if (!chapaWebhookSecret()) {
    console.error("[chapa-webhook] CHAPA_WEBHOOK_SECRET is not set — rejecting all webhooks in production");
    return NextResponse.json({ success: false }, { status: 503 });
  }
  if (!isValidChapaWebhook(rawBody, request.headers.get("x-chapa-signature"))) {
    console.warn("[chapa-webhook] invalid signature — rejecting");
    return NextResponse.json({ success: false }, { status: 401 });
  }

  // Re-verification needs the secret key; without it we cannot confirm anything.
  if (!chapaV2SecretKey()) {
    console.error("[chapa-webhook] CHAPA_SECRET_KEY is not set — cannot re-verify, asking Chapa to retry");
    return NextResponse.json({ success: false }, { status: 503 });
  }

  // 3. Parse.
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const event = typeof payload.event === "string" ? payload.event : "";
  const merchantReference =
    (typeof payload.merchant_reference === "string" ? payload.merchant_reference.trim() : "") ||
    (typeof payload.tx_ref === "string" ? payload.tx_ref.trim() : "");
  const chapaReference =
    (typeof payload.chapa_reference === "string" ? payload.chapa_reference.trim() : "") ||
    (typeof payload.reference === "string" ? payload.reference.trim() : "");

  // Event types we deliberately don't act on — acknowledge so Chapa stops retrying.
  if (payload.webhook_type === "payout" || payload.type === "Payout" || event.startsWith("payout.")) {
    console.log(`[chapa-webhook] acknowledged payout event: ${event || "(none)"}`);
    return NextResponse.json({ success: true, applied: false });
  }
  if (event.includes("refunded") || event.includes("reversed")) {
    console.log(`[chapa-webhook] acknowledged refund/reversal event: ${event}`);
    return NextResponse.json({ success: true, applied: false });
  }

  if (!merchantReference) {
    console.warn(`[chapa-webhook] event without merchant_reference: ${event || "(none)"} — acknowledged`);
    return NextResponse.json({ success: true, applied: false });
  }

  if (!chapaReference) {
    console.error(`[chapa-webhook] event missing chapa_reference: ${event || "(none)"}`);
    return NextResponse.json({ success: false }, { status: 400 });
  }

  // 4. Find the payment using our merchant_reference.
  const payment = await prisma.payment.findUnique({
    where: { txRef: merchantReference },
    select: { id: true, status: true, amount: true, currency: true, txRef: true },
  });
  if (!payment) {
    // Belongs to another system or a stale attempt. Acknowledge without applying.
    console.warn(`[chapa-webhook] no payment matched merchant_reference=${merchantReference} — acknowledged`);
    return NextResponse.json({ success: true, applied: false });
  }

  // 5. Re-verify the transaction with Chapa using its provider reference.
  let verification: ChapaVerification;
  try {
    verification = await verifyChapaTransaction(chapaReference);
  } catch (error) {
    if (error instanceof PaymentNotFoundError) {
      // Chapa may not have indexed the webhook's transaction yet; request retry.
      console.warn(`[chapa-webhook] Chapa has no verified payment for merchant_reference=${merchantReference}`);
      return NextResponse.json({ success: false }, { status: 503 });
    }
    // Transient (network/DB) failure → surface non-2xx so Chapa retries.
    console.error("[chapa-webhook] re-verify failed:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }

  const verifiedStatus = mapChapaStatus(verification.status);
  const eventStatus = mapChapaStatus(
    typeof payload.status === "string" ? payload.status : event.replace(/^payment\./, "")
  );

  // 6. Cross-check the verified merchant reference, amount, and currency.
  if (verification.txRef && verification.txRef !== merchantReference) {
    console.error(`[chapa-webhook] merchant_reference mismatch for payment ${payment.id}; not applying`);
    return NextResponse.json({ success: true, applied: false });
  }

  const amountMatches = Math.round(verification.amount) === payment.amount;
  const currencyMatches = verification.currency.toUpperCase() === payment.currency.toUpperCase();

  if (verifiedStatus === "SUCCESS" && (!amountMatches || !currencyMatches)) {
    console.error(
      `[chapa-webhook] amount/currency mismatch for payment ${payment.id}: verified ${verification.amount} ${verification.currency}, expected ${payment.amount} ${payment.currency} — not marking paid`
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
      txRef: verification.txRef || merchantReference,
      amount: verification.amount,
      currency: verification.currency,
      method: verification.method,
      charge: verification.charge,
      raw: { event, payload, verification, eventStatus },
    });

    console.log(
      `[chapa-webhook] merchant_reference=${merchantReference} event=${event} eventStatus=${eventStatus} verifiedStatus=${verifiedStatus} applied=${result?.changed ?? false} payment=${result?.paymentStatus ?? payment.status}`
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
