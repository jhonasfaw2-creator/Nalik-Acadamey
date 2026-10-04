import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPayment } from "@/lib/payments/chapa";
import { applyPaymentResult } from "@/lib/payments/apply";

export const dynamic = "force-dynamic";

// POST /api/payments/webhook  — Chapa payment lifecycle events.
// GET  /api/payments/webhook  — Chapa callback_url redirect (ignored, returns 200).
//
// Chapa sends two separate things:
//   1. callback_url  — a GET redirect after the customer finishes checkout.
//      This is a browser signal only. We return 200 and do nothing; the
//      return page (/payment/complete) handles the verify-on-return flow.
//   2. Webhook POST  — a signed server-to-server notification. This is the
//      authoritative settlement signal.
//
// Signature: Chapa signs the raw request body with HMAC-SHA256 using the
// webhook secret configured in Settings → Webhooks. The digest is sent in
// the x-chapa-signature header.
//
// If CHAPA_WEBHOOK_SECRET is not set (or the Chapa dashboard has no secret
// configured), we skip signature verification and rely on Chapa's verify API
// to confirm the payment before settling. Unsigned events are logged clearly
// so the misconfiguration is visible.

/** Chapa sends a lowercase hex HMAC-SHA256 digest. */
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/i;

function hmac(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * Checks the x-chapa-signature header against the raw body.
 * Returns:
 *   "valid"    — signature present and correct
 *   "invalid"  — signature present but wrong
 *   "absent"   — no signature header at all
 *   "no-secret"— CHAPA_WEBHOOK_SECRET not configured on our side
 */
function checkSignature(
  rawBody: string,
  request: NextRequest
): "valid" | "invalid" | "absent" | "no-secret" {
  const secret = process.env.CHAPA_WEBHOOK_SECRET?.trim().replace(/^["']+|["']+$/g, "");
  if (!secret) return "no-secret";

  const received =
    request.headers.get("x-chapa-signature") ??
    request.headers.get("chapa-signature");

  if (!received || !SIGNATURE_PATTERN.test(received)) return "absent";

  const expected = hmac(secret, rawBody);
  return timingSafeEqual(received, expected) ? "valid" : "invalid";
}

function toText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// ── GET — Chapa callback_url redirect ────────────────────────────────────
// Chapa GETs callback_url after the customer finishes checkout. This is a
// browser UX signal. The actual settlement happens via POST webhook or via
// /api/payments/verify when the customer lands on /payment/complete.
export async function GET() {
  return NextResponse.json({ received: true }, { status: 200 });
}

// ── POST — Chapa webhook ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let rawBody = "";
  let event: Record<string, unknown> | null = null;

  try {
    rawBody = await request.text();

    const sigResult = checkSignature(rawBody, request);

    // Diagnostic log on every hit — never logs secret values, only booleans.
    console.info("[chapa-webhook] incoming", {
      sigResult,
      hasXChapaSignature: !!request.headers.get("x-chapa-signature"),
      hasChapaSignature: !!request.headers.get("chapa-signature"),
      bodyLength: rawBody.length,
      bodyPreview: rawBody.slice(0, 120),
    });

    if (sigResult === "invalid") {
      // Signature was present but didn't match. Reject — this is either a
      // misconfigured secret or a forged request.
      console.warn("[chapa-webhook] Rejected event with invalid signature.", {
        hint: "Ensure the Chapa dashboard webhook secret matches CHAPA_WEBHOOK_SECRET in Vercel.",
      });
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }

    if (sigResult === "no-secret") {
      // CHAPA_WEBHOOK_SECRET is not set in Vercel env. Log clearly and
      // continue — we will still verify server-to-server with Chapa before
      // settling, so this is safe but should be fixed.
      console.warn("[chapa-webhook] CHAPA_WEBHOOK_SECRET not configured — proceeding without signature verification.");
    }

    if (sigResult === "absent") {
      // Secret is configured on our side but Chapa sent no signature. This
      // means the Chapa dashboard webhook has no secret set. Log and continue
      // — server-to-server verification still confirms the payment.
      console.warn("[chapa-webhook] No signature header from Chapa — dashboard webhook secret may not be set.");
    }

    // Parse the body.
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("not an object");
      }
      event = parsed as Record<string, unknown>;
    } catch {
      console.error("[chapa-webhook] Body was not a JSON object.");
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const webhookType = toText(event.webhook_type);
    const eventName = toText(event.event);

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
      select: { id: true, status: true, amount: true, currency: true, chapaReference: true },
    });

    if (!payment) {
      console.warn("[chapa-webhook] No payment matches merchant_reference", {
        merchantReference,
        eventName,
      });
      return NextResponse.json({ received: true, ignored: "unknown_reference" });
    }

    // Re-verify server-to-server with Chapa regardless of signature state.
    // The webhook is a signal; the verify API is the proof.
    const eventChapaReference = toText(event.chapa_reference);
    const verifyReference = payment.chapaReference || eventChapaReference || merchantReference;

    let authoritative;
    try {
      authoritative = await verifyPayment(verifyReference);
    } catch (error) {
      console.error("[chapa-webhook] Re-verification failed; requesting retry", {
        merchantReference,
        verifyReference,
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ received: false, retry: true }, { status: 503 });
    }

    const applied = await applyPaymentResult(payment.id, {
      status: authoritative.status,
      chapaReference: authoritative.chapaReference ?? eventChapaReference,
      merchantReference: authoritative.merchantReference ?? merchantReference,
      amount: authoritative.amount,
      currency: authoritative.currency,
      paymentMethod: authoritative.paymentMethod,
      serviceFee: authoritative.serviceFee,
    });

    if (!applied) {
      console.warn("[chapa-webhook] Payment vanished before event was applied", { merchantReference });
      return NextResponse.json({ received: true, ignored: "unknown_reference" });
    }

    if (applied.mismatch) {
      console.error("[chapa-webhook] Rejected SUCCESS — amount/currency mismatch", {
        merchantReference,
        mismatch: applied.mismatch,
        expected: { amount: payment.amount, currency: payment.currency },
        received: { amount: authoritative.amount, currency: authoritative.currency },
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
