import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChapaWebhookPayload = Record<string, unknown>;

function isRecord(value: unknown): value is ChapaWebhookPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAmount(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function getTimestamp(...values: unknown[]): Date {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

function hasValidSignature(rawBody: string, signature: string, secret: string): boolean {
  const received = signature.trim().replace(/^sha256=/i, "");
  if (!/^[\da-f]{64}$/i.test(received)) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const actual = Buffer.from(received, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    console.error("[webhooks/chapa] CHAPA_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 500 });
  }

  const signature =
    request.headers.get("x-chapa-signature") ??
    request.headers.get("chapa-signature") ??
    "";
  const rawBody = await request.text();
  if (!hasValidSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid webhook JSON." }, { status: 400 });
  }
  if (!isRecord(parsed)) {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const event = isRecord(parsed.data) ? parsed.data : parsed;
  const merchantReference =
    typeof event.merchant_reference === "string"
      ? event.merchant_reference.trim()
      : typeof event.tx_ref === "string"
        ? event.tx_ref.trim()
        : "";
  const status = typeof event.status === "string" ? event.status.trim().toUpperCase() : "";
  if (!merchantReference || !status) {
    return NextResponse.json({ error: "Webhook is missing payment reference or status." }, { status: 400 });
  }

  try {
    const transaction = await prisma.transaction.findUnique({
      where: { txRef: merchantReference },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        registration: {
          select: { id: true, status: true, scheduleId: true },
        },
      },
    });

    if (!transaction) {
      console.warn("[webhooks/chapa] Ignoring event for unknown merchant reference", { merchantReference });
      return NextResponse.json({ received: true });
    }

    const successful = status === "SUCCESS" || status === "PAID";
    const failed = status === "FAILED" || status === "CANCELLED" || status === "INCOMPLETE";
    const chapaReference =
      typeof event.chapa_reference === "string"
        ? event.chapa_reference
        : typeof event.reference === "string"
          ? event.reference
          : undefined;
    const amount = getAmount(event.amount);
    const serviceFee = getAmount(event.service_fee);
    const currency = typeof event.currency === "string" ? event.currency.trim().toUpperCase() : "";
    const netAmount =
      amount !== null && serviceFee !== null && serviceFee >= 0 && serviceFee <= amount
        ? amount - serviceFee
        : amount;

    if (successful && (netAmount !== transaction.amount || currency !== transaction.currency.toUpperCase())) {
      console.error("[webhooks/chapa] Successful event does not match stored transaction", {
        merchantReference,
        expectedAmount: transaction.amount,
        receivedAmount: amount,
        receivedServiceFee: serviceFee,
        expectedCurrency: transaction.currency,
        receivedCurrency: currency,
      });
      return NextResponse.json({ error: "Payment details do not match transaction." }, { status: 409 });
    }

    if (!successful && !failed) {
      return NextResponse.json({ received: true, status: "ignored" });
    }

    const paidAt = getTimestamp(event.updated_at, event.created_at);
    await prisma.$transaction(async (tx) => {
      if (successful) {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "SUCCESS",
            paidAt,
            ...(chapaReference ? { chapaReference } : {}),
            ...(serviceFee !== null ? { serviceFee: Math.round(serviceFee) } : {}),
            ...(typeof event.payment_method === "string" ? { paymentMethod: event.payment_method } : {}),
            rawWebhook: parsed as object,
          },
        });

        const registration = await tx.registration.updateMany({
          where: { id: transaction.registration.id, status: "PENDING" },
          data: { status: "PAID", paidAt },
        });
        if (registration.count > 0 && transaction.registration.scheduleId) {
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
            ...(typeof event.payment_method === "string" ? { paymentMethod: event.payment_method } : {}),
            rawWebhook: parsed as object,
          },
        });
      }
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhooks/chapa] Failed to persist webhook event", {
      merchantReference,
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not process webhook event." }, { status: 500 });
  }
}
