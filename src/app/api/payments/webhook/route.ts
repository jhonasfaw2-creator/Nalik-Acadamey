import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SIGNATURE_PATTERN = /^[a-f0-9]{64}\$/i;

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
  const secret = process.env.CHAPA_WEBHOOK_SECRET?.trim().replace(/^["']+|["']+\$/g, "");
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
  const verifiedStatus = typeof verification.status === "string" ? verification.status.toUpperCase() : "PENDING";
  const status = verifiedStatus === "PAID" ? "SUCCESS" : verifiedStatus;
  const amount = verification.amount;
  const currency = verification.currency;
  const chapaReference = verification.chapa_reference;
  const paymentMethod = verification.payment_method;
  const serviceFee = verification.service_fee;
  
  const verifiedPaidAt = verification.updated_at || verification.created_at
    ? new Date(verification.updated_at ?? verification.created_at!)
    : null;
    
  const paidAt = verifiedPaidAt && !Number.isNaN(verifiedPaidAt.getTime())
    ? verifiedPaidAt
    : new Date();

  const existingTx = await tx.transaction.findUnique({
    where: { id: transactionId },
    select: { amount: true, currency: true, status: true, txRef: true },
  });

  if (!existingTx) {
    throw new Error("Transaction not found");
  }
  
  if (verification.tx_ref !== existingTx.txRef) {
    throw new Error(`Verified payment reference mismatch for transaction ${transactionId}`);
  }

  if (status === "SUCCESS") {
    if (amount == null || amount !== existingTx.amount) {
      throw new Error(`Verified payment amount mismatch for transaction ${transactionId}`);
    }
    if (!currency || currency.toUpperCase() !== existingTx.currency.toUpperCase()) {
      throw new Error(`Verified payment currency mismatch for transaction ${transactionId}`);
    }
  }
  
  if (existingTx.status === "SUCCESS" && status !== "SUCCESS") {
    return { paymentStatus: "SUCCESS", changed: false };
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
  if (serviceFee != null && Number.isFinite(serviceFee)) updateData.serviceFee = Math.round(serviceFee);
  if (status === "SUCCESS" || status === "FAILED" || status === "CANCELLED") {
    updateData.paidAt = paidAt;
  }

  await tx.transaction.update({
    where: { id: transactionId },
    data: updateData,
  });

  if (status === "SUCCESS") {
    const registration = await tx.registration.findUnique({
      where: { id: registrationId },
      select: { status: true, scheduleId: true },
    });
    if (!registration) throw new Error("Registration not found");

    const paidTransition = registration.status === "PENDING"
      ? await tx.registration.updateMany({
          where: { id: registrationId, status: "PENDING" },
          data: { status: "PAID", paidAt },
        })
      : { count: 0 };
      
    if (paidTransition.count > 0 && registration.scheduleId) {
      await tx.schedule.update({
        where: { id: registration.scheduleId },
        data: { enrolled: { increment: 1 } },
      });
    }
  }

  return { paymentStatus: status, changed: true };
}

export async function POST(request: NextRequest) {
  let rawBody = "";
  let event: Record<string, unknown> | null = null;

  try {
    rawBody = await request.text();
    const sigResult = checkSignature(rawBody, request);

    console.info("[chapa-webhook] incoming validation log:", {
      sigResult,
      hasXChapaSignature: !!request.headers.get("x-chapa-signature"),
      hasChapaSignature: !!request.headers.get("chapa-signature"),
      bodyLength: rawBody.length,
    });

    if (sigResult !== "valid") {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }

    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("not an object");
      }
      event = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const webhookType = toText(event.webhook_type);
    const eventName = toText(event.event);

    if (webhookType !== "payment") {
      return NextResponse.json({ received: true, ignored: webhookType ?? "unknown" });
    }

    const eventData = (event.data && typeof event.data === "object" ? event.data : {}) as Record<string, unknown>;
    const txRef = toText(eventData.merchant_reference) ?? toText(eventData.tx_ref) ?? toText(event.tx_ref);
    
    if (!txRef) {
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
      },
    });

    if (!transaction) {
      return NextResponse.json({ received: true, ignored: "unknown_reference" });
    }

    const chapaReference = toText(eventData.chapa_reference) ?? toText(event.chapa_reference);
    if (chapaReference && !transaction.chapaReference) {
      try {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { chapaReference },
        });
      } catch (e) {
        console.error("[chapa-webhook] Failed setting chapaReference baseline", e);
      }
    }

    const chapaStatus = toText(eventData.status) ?? toText(event.status) ?? "PENDING";
    const verificationPayload: VerificationResult = {
      status: chapaStatus,
      amount: typeof eventData.amount === "number" ? eventData.amount : typeof event.amount === "number" ? event.amount : null,
      currency: toText(eventData.currency) ?? toText(event.currency),
      tx_ref: txRef,
      chapa_reference: chapaReference,
      payment_method: toText(eventData.payment_method) ?? toText(event.payment_method),
      service_fee: typeof eventData.charge === "number" ? eventData.charge : null,
      created_at: toText(eventData.created_at) ?? toText(event.created_at),
      updated_at: toText(eventData.updated_at) ?? toText(event.updated_at),
      raw: event,
    };

    const executionResult = await prisma.$transaction(async (tx) => {
      return await applyPaymentResult(
        tx,
        transaction.id,
        verificationPayload,
        transaction.registrationId
      );
    });

    return NextResponse.json({ received: true, state: executionResult.paymentStatus });

  } catch (error) {
    console.error("[chapa-webhook] Fatal error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
