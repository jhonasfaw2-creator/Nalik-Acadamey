import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPayment } from "@/lib/payments/chapa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WebhookPayload = Record<string, unknown>;

function isRecord(value: unknown): value is WebhookPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseEventDate(...values: unknown[]): Date {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const normalizedSignature = signature.trim().replace(/^sha256=/i, "");
  if (!/^[\da-f]{64}$/i.test(normalizedSignature)) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const received = Buffer.from(normalizedSignature, "hex");
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export async function POST(request: NextRequest) {
  const secret =
    process.env.CHAPA_WEBHOOK_SECRET?.trim() ||
    process.env.CHAPA_SECRET_KEY?.trim();
  if (!secret) {
    console.error("[webhooks/chapa] No webhook signing secret is configured");
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 500 });
  }

  const signature =
    request.headers.get("x-chapa-signature") ??
    request.headers.get("chapa-signature") ??
    "";
  const rawBody = await request.text();

  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid webhook JSON." }, { status: 400 });
  }
  if (!isRecord(payload)) {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const event = isRecord(payload.data) ? payload.data : payload;
  const reference =
    typeof event.merchant_reference === "string"
      ? event.merchant_reference.trim()
      : typeof event.tx_ref === "string"
        ? event.tx_ref.trim()
        : typeof event.reference === "string"
          ? event.reference.trim()
          : "";
  const eventName =
    typeof event.event === "string"
      ? event.event.trim().toLowerCase()
      : typeof payload.event === "string"
        ? payload.event.trim().toLowerCase()
        : "";
  const rawStatus =
    typeof event.status === "string"
      ? event.status.trim().toUpperCase()
      : typeof payload.status === "string"
        ? payload.status.trim().toUpperCase()
        : "";
  const success = eventName === "payment.success" || rawStatus === "SUCCESS" || rawStatus === "PAID";
  const status = success ? "SUCCESS" : rawStatus || eventName.split(".").at(-1)?.toUpperCase() || "";
  if (!reference || !status) {
    return NextResponse.json(
      { error: "Webhook is missing payment reference or status." },
      { status: 400 },
    );
  }

  let merchantReference = reference;
  try {
    const transaction = await prisma.transaction.findFirst({
      where: {
        OR: [{ txRef: reference }, { chapaReference: reference }],
      },
      select: {
        id: true,
        txRef: true,
        amount: true,
        currency: true,
        registration: { select: { id: true, scheduleId: true } },
      },
    });

    if (!transaction) {
      console.warn("[webhooks/chapa] Ignoring event for unknown merchant reference", {
        reference,
      });
      return NextResponse.json({ received: true });
    }

    merchantReference = transaction.txRef;
    const failure = ["FAILED", "CANCELLED", "INCOMPLETE", "BLOCKED"].includes(status);
    if (!success && !failure) {
      return NextResponse.json({ received: true, status: "ignored" });
    }

    const chapaReference =
      typeof event.chapa_reference === "string"
        ? event.chapa_reference
        : typeof event.reference === "string"
          ? event.reference
          : undefined;
    const amount = parseNumber(event.amount);
    const serviceFee = parseNumber(event.service_fee);
    const amountNetOfFee =
      amount !== null && serviceFee !== null && serviceFee >= 0 && serviceFee <= amount
        ? amount - serviceFee
        : amount;
    const amountMatches =
      amount === transaction.amount ||
      amountNetOfFee === transaction.amount;
    const currency =
      typeof event.currency === "string" ? event.currency.trim().toUpperCase() : "";

    if (
      success &&
      (!amountMatches || currency !== transaction.currency.toUpperCase() || !chapaReference)
    ) {
      console.error("[webhooks/chapa] Successful event does not match transaction", {
        merchantReference,
        expectedAmount: transaction.amount,
        receivedAmount: amount,
        receivedServiceFee: serviceFee,
        receivedCurrency: currency,
        hasChapaReference: Boolean(chapaReference),
      });
      return NextResponse.json(
        { error: "Payment details do not match transaction." },
        { status: 409 },
      );
    }

    if (success && chapaReference) {
      const verified = await verifyPayment(chapaReference);
      const verifiedStatus = verified.status.trim().toUpperCase();
      const verifiedNetAmount =
        verified.amount !== null &&
        verified.service_fee !== null &&
        verified.service_fee >= 0 &&
        verified.service_fee <= verified.amount
          ? verified.amount - verified.service_fee
          : verified.amount;
      const verifiedAmountMatches =
        verified.amount === transaction.amount ||
        verifiedNetAmount === transaction.amount;
      if (
        (verifiedStatus !== "SUCCESS" && verifiedStatus !== "PAID") ||
        verified.merchant_reference !== merchantReference ||
        !verifiedAmountMatches ||
        verified.currency?.trim().toUpperCase() !== transaction.currency.toUpperCase()
      ) {
        console.error("[webhooks/chapa] Chapa verification did not confirm the webhook payment", {
          merchantReference,
          chapaReference,
          verifiedStatus,
          verifiedMerchantReference: verified.merchant_reference,
          verifiedAmount: verified.amount,
          verifiedServiceFee: verified.service_fee,
          verifiedCurrency: verified.currency,
        });
        return NextResponse.json(
          { error: "Chapa verification did not confirm this payment." },
          { status: 409 },
        );
      }
    }

    const paidAt = parseEventDate(event.updated_at, event.created_at);
    await prisma.$transaction(async (tx) => {
      if (success) {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "SUCCESS",
            paidAt,
            chapaReference,
            ...(serviceFee !== null ? { serviceFee: Math.round(serviceFee) } : {}),
            ...(typeof event.payment_method === "string"
              ? { paymentMethod: event.payment_method }
              : {}),
            rawWebhook: payload as object,
          },
        });

        const updated = await tx.registration.updateMany({
          where: { id: transaction.registration.id, status: "PENDING" },
          data: { status: "PAID", paidAt },
        });
        if (updated.count > 0 && transaction.registration.scheduleId) {
          await tx.schedule.update({
            where: { id: transaction.registration.scheduleId },
            data: { enrolled: { increment: 1 } },
          });
        }
      } else {
        await tx.transaction.updateMany({
          where: { id: transaction.id, status: { not: "SUCCESS" } },
          data: {
            status,
            ...(chapaReference ? { chapaReference } : {}),
            ...(serviceFee !== null ? { serviceFee: Math.round(serviceFee) } : {}),
            ...(typeof event.payment_method === "string"
              ? { paymentMethod: event.payment_method }
              : {}),
            rawWebhook: payload as object,
          },
        });
      }
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhooks/chapa] Failed to process event", {
      merchantReference,
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not process webhook event." }, { status: 500 });
  }
}
