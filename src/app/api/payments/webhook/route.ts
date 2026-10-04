import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPayment, ChapaApiError, ChapaConfigError } from "@/lib/payments/chapa";

export const dynamic = "force-dynamic";

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

function checkSignature(rawBody: string, request: NextRequest): "valid" | "absent" | "malformed" | "invalid" | "no-secret" {
  const secret = process.env.CHAPA_WEBHOOK_SECRET?.trim().replace(/^["']+|["']+$/g, "");
  if (!secret) return "no-secret";

  const received =
    request.headers.get("x-chapa-signature") ||
    request.headers.get("chapa-signature");

  if (!received) return "absent";
  if (!SIGNATURE_PATTERN.test(received.trim())) return "malformed";

  const candidate = received.trim();
  const expected = hmac(secret, rawBody);
  return timingSafeEqual(candidate, expected) ? "valid" : "invalid";
}

function toText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

interface VerificationResult {
  status: string;
  amount: number | null;
  currency: string | null;
  tx_ref: string | null;
  chapa_reference: string | null;
  payment_method: string | null;
  service_fee: number | null;
  created_at: string | null;
  updated_at: string | null;
  raw: unknown;
}

async function applyPaymentResult(
  tx: Prisma.TransactionClient,
  transactionId: string,
  verification: VerificationResult,
  registrationId: string
): Promise<{ paymentStatus: string; changed: boolean }> {
  const status = typeof verification.status === "string" ? verification.status.toUpperCase() : "PENDING";
  const amount = verification.amount;
  const currency = verification.currency;
  const chapaReference = verification.chapa_reference;
  const paymentMethod = verification.payment_method;
  const serviceFee = verification.service_fee;
  const paidAt = verification.created_at ? new Date(verification.created_at) : new Date();

  // Check amount matches what we expect
  const existingTx = await tx.transaction.findUnique({
    where: { id: transactionId },
    select: { amount: true, currency: true, status: true },
  });

  if (!existingTx) {
    throw new Error("Transaction not found");
  }

  if (status === "SUCCESS") {
    if (amount != null && Math.round(amount) !== existingTx.amount) {
      console.error("[webhook] Amount mismatch", { expected: existingTx.amount, received: amount });
      // Still update status but log mismatch
    }
    if (currency && currency.toUpperCase() !== existingTx.currency.toUpperCase()) {
      console.error("[webhook] Currency mismatch", { expected: existingTx.currency, received: currency });
    }
  }

  const updateData: {
    status: string;
    chapaReference?: string;
    paymentMethod?: string;
    serviceFee?: number;
    paidAt?: Date;
  } = { status };

  if (chapaReference) updateData.chapaReference = chapaReference;
  if (paymentMethod) updateData.paymentMethod = paymentMethod;
  if (serviceFee != null) updateData.serviceFee = serviceFee;
  if (status === "SUCCESS" || status === "FAILED" || status === "CANCELLED") {
    updateData.paidAt = paidAt;
  }

  await tx.transaction.update({
    where: { id: transactionId },
    data: updateData,
  });

  // Update registration status
  if (status === "SUCCESS") {
    await tx.registration.update({
      where: { id: registrationId },
      data: { status: "PAID", paidAt },
    });
  } else if (status === "FAILED" || status === "CANCELLED") {
    // Keep registration as PENDING, allow retry
  }

  return { paymentStatus: status, changed: true };
}

export async function POST(request: NextRequest) {
  let rawBody = "";
  let event: Record<string, unknown> | null = null;

  try {
    rawBody = await request.text();

    const sigResult = checkSignature(rawBody, request);

    console.info("[chapa-webhook] incoming", {
      sigResult,
      hasXChapaSignature: !!request.headers.get("x-chapa-signature"),
      hasChapaSignature: !!request.headers.get("chapa-signature"),
      bodyLength: rawBody.length,
    });

    if (sigResult !== "valid") {
      const hint =
        sigResult === "no-secret"
          ? "CHAPA_WEBHOOK_SECRET is not set on this server."
          : sigResult === "absent"
          ? "Chapa sent no signature header."
          : sigResult === "malformed"
          ? "Signature header is not a 64-character hex digest."
          : "Webhook secret mismatch.";
      console.warn("[chapa-webhook] Rejected unauthenticated event.", { sigResult, hint });
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }

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

    const txRef = toText(event.tx_ref);
    if (!txRef) {
      console.error("[chapa-webhook] Payment event had no tx_ref", { eventName });
      return NextResponse.json({ error: "Missing tx_ref." }, { status: 400 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { txRef },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        chapaReference: true,
        registrationId: true,
        registration: { select: { id: true, referenceId: true, status: true } },
      },
    });

    if (!transaction) {
      console.warn("[chapa-webhook] No transaction matches tx_ref", { txRef, eventName });
      return NextResponse.json({ received: true, ignored: "unknown_reference" });
    }

    // Re-verify server-to-server with Chapa
    const chapaReference = toText(event.chapa_reference);
    if (chapaReference && !transaction.chapaReference) {
      try {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { chapaReference },
        });
      } catch (e) {
        console.error("[chapa-webhook] Could not store chapa_reference from event", {
          txRef,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    let authoritative: VerificationResult;
    try {
      const verifyRef = chapaReference ?? txRef;
      authoritative = await verifyPayment(verifyRef);
    } catch (error) {
      console.error("[chapa-webhook] Re-verification failed", {
        txRef,
        verifyRef: chapaReference ?? txRef,
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ received: false, retry: true }, { status: 503 });
    }

    const applied = await prisma.$transaction(async (tx) => {
      return applyPaymentResult(tx, transaction.id, authoritative, transaction.registration.id);
    });

    console.info("[chapa-webhook] Event applied", {
      txRef,
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