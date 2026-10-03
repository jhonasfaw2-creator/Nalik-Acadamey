import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapChapaStatus } from "@/lib/payments/chapa";
import { applyPaymentResult } from "@/lib/payments/apply";

export const dynamic = "force-dynamic";

// POST /api/payments/webhook — asynchronous payment confirmation from Chapa.
//
// Chapa signs the exact bytes it sends, so the raw body is read once and used
// for BOTH the signature check and the parse. Re-serializing the parsed JSON
// before verifying would produce a different byte sequence and reject every
// legitimate event.
//
// The signature is the authentication boundary: once it verifies, the payload
// is trusted as coming from Chapa, and settlement still additionally requires
// the amount and currency to match what we stored. Applying through
// applyPaymentResult keeps this path idempotent and shares the exactly-once
// seat bookkeeping with /api/payments/verify, so a webhook and a poll racing
// each other can never double-enroll a student.
//
// Every handled request answers 200: Chapa retries non-200 responses, and
// retrying cannot fix an unknown reference or a duplicate event.

/** Chapa sends a lowercase hex HMAC-SHA256 digest. */
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/i;

/**
 * Constant-time check of the x-chapa-signature header against the raw body.
 * Returns false — never throws — for a missing or malformed header.
 */
function isValidSignature(rawBody: string, received: string | null): boolean {
  const secret = process.env.CHAPA_WEBHOOK_SECRET?.trim().replace(/^["']+|["']+$/g, "");
  if (!secret) return false;
  if (!received || !SIGNATURE_PATTERN.test(received)) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const receivedBytes = Buffer.from(received, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  if (receivedBytes.length !== expectedBytes.length) return false;

  return crypto.timingSafeEqual(receivedBytes, expectedBytes);
}

/** Webhook numerics arrive as strings (e.g. "40000"). */
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[\s,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  let rawBody = "";
  let event: Record<string, unknown> | null = null;

  try {
    if (!process.env.CHAPA_WEBHOOK_SECRET?.trim()) {
      console.error(
        "[chapa-webhook] CHAPA_WEBHOOK_SECRET is not configured; cannot authenticate events."
      );
      return NextResponse.json(
        { error: "Webhook is not configured." },
        { status: 500 }
      );
    }

    // Read once, as bytes. Never parse before verifying.
    rawBody = await request.text();

    if (!isValidSignature(rawBody, request.headers.get("x-chapa-signature"))) {
      console.warn("[chapa-webhook] Rejected event with missing or invalid signature.");
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }

    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("not an object");
      }
      event = parsed as Record<string, unknown>;
    } catch {
      console.error("[chapa-webhook] Signed event was not a JSON object.");
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const webhookType = toText(event.webhook_type);
    const eventName = toText(event.event);

    // Payouts and refunds also carry merchant_reference. Only payment
    // lifecycle events may touch a Payment row. Refunds are tracked manually
    // and must never move a settled payment backwards.
    if (webhookType !== "payment") {
      console.info("[chapa-webhook] Ignored non-payment event", { eventName, webhookType });
      return NextResponse.json({ received: true, ignored: webhookType ?? "unknown" });
    }

    const merchantReference = toText(event.merchant_reference);
    if (!merchantReference) {
      console.error("[chapa-webhook] Payment event had no merchant_reference", { eventName });
      return NextResponse.json({ error: "Missing merchant_reference." }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({
      where: { merchantReference },
      select: { id: true, status: true, amount: true, currency: true },
    });
    if (!payment) {
      // Nothing to settle. Answer 200 so Chapa stops retrying; the verify
      // route will still catch the payment by reference ID if it exists.
      console.warn("[chapa-webhook] No payment matches this merchant_reference", {
        merchantReference,
        eventName,
      });
      return NextResponse.json({ received: true, ignored: "unknown_reference" });
    }

    const status = mapChapaStatus(event.status);

    const applied = await applyPaymentResult(payment.id, {
      status,
      chapaReference: toText(event.chapa_reference),
      merchantReference,
      amount: toNumber(event.amount),
      currency: toText(event.currency),
      paymentMethod: toText(event.payment_method),
      serviceFee: toNumber(event.service_fee),
    });

    if (!applied) {
      console.warn("[chapa-webhook] Payment vanished before the event was applied", {
        merchantReference,
      });
      return NextResponse.json({ received: true, ignored: "unknown_reference" });
    }

    if (applied.mismatch) {
      // Signed by Chapa, yet the figures disagree with what we stored. Refuse
      // to grant access and surface it for manual reconciliation.
      console.error("[chapa-webhook] Rejected SUCCESS on amount/currency mismatch", {
        merchantReference,
        eventName,
        mismatch: applied.mismatch,
        expected: { amount: payment.amount, currency: payment.currency },
        received: {
          amount: toNumber(event.amount),
          currency: toText(event.currency),
          chapaReference: toText(event.chapa_reference),
        },
      });
      return NextResponse.json({ received: true, status: "FAILED", mismatch: applied.mismatch });
    }

    console.info("[chapa-webhook] Event applied", {
      merchantReference,
      eventName,
      status: applied.paymentStatus,
      changed: applied.changed,
    });

    return NextResponse.json({ received: true, status: applied.paymentStatus });
  } catch (error) {
    console.error("[chapa-webhook] Unexpected failure:", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ received: false }, { status: 500 });
  }
}