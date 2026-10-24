import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPrismaError } from "@/lib/http";
import type { Prisma } from "@prisma/client";
import {
  chapaAmountMatches,
  createWebhookDedupKey,
  getChapaMode,
  normalizeChapaStatus,
  parseChapaAmount,
  parseVerifiedChapaPayment,
  reconcileVerifiedPayment,
  verifyChapaPayment,
  verifyChapaWebhookSignature,
} from "@/lib/payments/chapa";

export const dynamic = "force-dynamic";

interface ChapaWebhook {
  webhook_type?: unknown;
  event?: unknown;
  status?: unknown;
  mode?: unknown;
  amount?: unknown;
  service_fee?: unknown;
  currency?: unknown;
  merchant_reference?: unknown;
  chapa_reference?: unknown;
  updated_at?: unknown;
}

export async function POST(request: NextRequest) {
  if (!process.env.CHAPA_WEBHOOK_SECRET) {
    console.error("CHAPA_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  let expectedMode: ReturnType<typeof getChapaMode>;
  try {
    expectedMode = getChapaMode();
  } catch (error) {
    console.error("Chapa API key is not configured for webhook reconciliation", error);
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const rawBody = Buffer.from(await request.arrayBuffer());
  if (!verifyChapaWebhookSignature(rawBody, request.headers.get("x-chapa-signature"))) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: ChapaWebhook;
  try {
    const parsed: unknown = JSON.parse(rawBody.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
    }
    payload = parsed as ChapaWebhook;
  } catch {
    return NextResponse.json({ error: "Invalid webhook JSON." }, { status: 400 });
  }

  if (payload.webhook_type !== "payment") {
    return NextResponse.json({ received: true, ignored: true });
  }
  if (
    (payload.mode !== undefined && payload.mode !== expectedMode) ||
    typeof payload.event !== "string" ||
    typeof payload.status !== "string" ||
    typeof payload.merchant_reference !== "string" ||
    typeof payload.chapa_reference !== "string" ||
    typeof payload.currency !== "string" ||
    payload.amount === undefined
  ) {
    return NextResponse.json({ error: "Invalid payment webhook fields." }, { status: 400 });
  }

  const eventStatus = normalizeChapaStatus(payload.status);
  const amount = parseChapaAmount(payload.amount);
  if (
    eventStatus === "INVALID" ||
    payload.event !== `payment.${payload.status.toLowerCase()}` ||
    amount === null ||
    !payload.merchant_reference ||
    !payload.chapa_reference
  ) {
    return NextResponse.json({ error: "Invalid payment webhook fields." }, { status: 400 });
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { merchantReference: payload.merchant_reference },
    });
    if (!payment) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    const response = await verifyChapaPayment(payload.chapa_reference);
    const serviceFee = parseChapaAmount(payload.service_fee);
    const webhookMatches =
      chapaAmountMatches(amount, serviceFee, payment.amount) &&
      payload.currency.toUpperCase() === payment.currency.toUpperCase();
    if (!webhookMatches) {
      // Never mutate a payment from a notification that disagrees with the
      // stored order. A legitimate payment still reconciles through /verify.
      console.error("Chapa webhook did not match the stored payment", {
        merchantReference: payload.merchant_reference,
      });
      return NextResponse.json({ received: true, ignored: true });
    }

    const verified = parseVerifiedChapaPayment(response, {
      merchantReference: payment.merchantReference,
      amount: payment.amount,
      currency: payment.currency,
    });
    const dedupKey = createWebhookDedupKey({
      event: payload.event,
      chapaReference: payload.chapa_reference,
      status: payload.status,
      updatedAt: typeof payload.updated_at === "string" ? payload.updated_at : "",
      rawBody,
    });

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.paymentWebhookEvent.create({
        data: {
          dedupKey,
          event: payload.event as string,
          chapaReference: payload.chapa_reference as string,
        },
      });
      await reconcileVerifiedPayment(
        tx,
        payment.id,
        verified?.chapaReference ?? payment.chapaReference ?? (payload.chapa_reference as string),
        verified,
      );
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    if (error instanceof Error && error.message === "PAYMENT_SCHEDULE_FULL") {
      console.error("Verified payment could not be enrolled because its schedule is full", {
        merchantReference: payload.merchant_reference,
      });
      return NextResponse.json({ error: "Schedule is full." }, { status: 503 });
    }
    console.error("Chapa webhook processing failed", {
      event: payload.event,
      bodyHash: createHash("sha256").update(rawBody).digest("hex"),
      error,
    });
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 502 });
  }
}
