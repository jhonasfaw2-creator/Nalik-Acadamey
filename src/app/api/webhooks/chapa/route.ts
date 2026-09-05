import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidChapaWebhook, type ChapaVerification } from "@/lib/payments/chapa";
import { applyChapaPaymentResult, mapChapaStatus } from "@/lib/payments/apply";

export const dynamic = "force-dynamic";

// POST /api/webhooks/chapa — receive Chapa payment events.
//
// Chapa signs every webhook with x-chapa-signature = HMAC-SHA256(webhook
// secret, raw body). When CHAPA_WEBHOOK_SECRET is configured the signature is
// verified before anything is parsed (constant-time comparison over the raw
// bytes). Without the secret the endpoint still accepts deliveries for local
// development, but production MUST set it.
//
// Events handled: payment.success / payment.failed / payment.cancelled /
// payment.incomplete / payment.blocked / payment.auth_needed. Processing is
// idempotent (safe for Chapa's retries and out-of-order deliveries): a
// payment that already reached SUCCESS is never downgraded, and the seat +
// registration only flip to paid on the pending → SUCCESS transition.
export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const signature = request.headers.get("x-chapa-signature");
  const secretConfigured = Boolean(process.env.CHAPA_WEBHOOK_SECRET);

  if (secretConfigured) {
    if (!isValidChapaWebhook(rawBody, signature)) {
      console.warn("[chapa-webhook] invalid signature — rejecting");
      return NextResponse.json({ success: false }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Without the secret we cannot verify the sender. Accepting unsigned
    // deliveries in production would let an attacker forge payment.success
    // events (the amount/currency guard alone is not enough — amounts are
    // public). Fail closed: acknowledge nothing and let Chapa keep retrying
    // so the operator notices and configures the secret.
    console.error("[chapa-webhook] CHAPA_WEBHOOK_SECRET is not set — rejecting all webhooks in production");
    return NextResponse.json({ success: false }, { status: 503 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const event = typeof payload.event === "string" ? payload.event : "";
  if (!event.startsWith("payment.")) {
    // Payout/refund events and unknown types: acknowledge so Chapa stops retrying.
    console.log(`[chapa-webhook] ignoring non-payment event: ${event || "(none)"}`);
    return NextResponse.json({ success: true });
  }

  const status = mapChapaStatus(typeof payload.status === "string" ? payload.status : "");
  const chapaReference =
    typeof payload.chapa_reference === "string" ? payload.chapa_reference : undefined;
  const merchantReference =
    typeof payload.merchant_reference === "string" ? payload.merchant_reference : undefined;
  const amount = payload.amount != null && payload.amount !== "" ? Number(payload.amount) : undefined;
  const currency = typeof payload.currency === "string" ? payload.currency : undefined;
  const method = typeof payload.payment_method === "string" ? payload.payment_method : undefined;
  const serviceFee = payload.service_fee != null && payload.service_fee !== "" ? Number(payload.service_fee) : undefined;

  console.log(
    `[chapa-webhook] event=${event} status=${status} merchant_ref=${merchantReference} chapa_ref=${chapaReference} amount=${amount} mode=${payload.mode ?? "?"}`
  );

  // Find the payment by Chapa's ids — our saved attempt data or the student's
  // stored reference.
  try {
    let payment = null;
    if (chapaReference) {
      payment = await prisma.payment.findFirst({
        where: { chapaReference },
        include: { application: true },
      });
    }
    if (!payment && merchantReference) {
      payment = await prisma.payment.findUnique({
        where: { merchantReference },
        include: { application: true },
      });
    }
    if (!payment) {
      console.warn(`[chapa-webhook] no payment matched for ${merchantReference || chapaReference || event}`);
      // Acknowledge to stop retries — the reference belongs to another system or
      // the attempt was overwritten by a retry (late signal for a stale attempt).
      return NextResponse.json({ success: true });
    }

    const verification: ChapaVerification = {
      status,
      chapaReference: chapaReference || "",
      merchantReference: merchantReference || "",
      amount: amount ?? 0,
      currency: currency || "ETB",
      method,
      serviceFee,
      customer: null,
    };

    await applyChapaPaymentResult(payment.id, {
      status,
      chapaReference,
      merchantReference,
      amount,
      currency,
      method,
      serviceFee,
      raw: payload,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // A transient DB failure here must surface as a non-2xx so Chapa retries
    // the delivery; otherwise the payment could be stuck in PENDING forever.
    console.error("[chapa-webhook] processing failed:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}