// ── Shared, idempotent payment-result applier ──────────────────────────────
// Both the webhook and the server-side verify route funnel into
// applyChapaPaymentResult so state transitions (and the schedule seat
// bookkeeping) happen exactly once:
//   - A payment is marked SUCCESS only when amount + currency match the
//     stored payment, and the registration moves to PAID at that moment.
//   - The enrolled seat is incremented exactly once per registration, on the
//     transition into SUCCESS.
//   - A payment already SUCCESS is never downgraded; refs/method are refreshed.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Map a Chapa status (verify/webhook) to our Payment.status. */
export function mapChapaStatus(status: string | undefined | null): string {
  const raw = (status || "").toString().trim();
  const tokens = raw
    .split(/[\/|,&]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.length > 0) {
    for (const token of tokens) {
      switch (token) {
        case "success":
        case "completed":
          return "SUCCESS";
        case "failed":
        case "failure":
          return "FAILED";
        case "cancelled":
        case "canceled":
        case "reversed":
        case "refunded":
          return "CANCELLED";
        case "incomplete":
        case "abandoned":
        case "timeout":
          return "INCOMPLETE";
        case "pending":
          return "PENDING";
      }
    }
  }

  const s = raw.toLowerCase();
  switch (s) {
    case "success":
    case "completed":
      return "SUCCESS";
    case "failed":
    case "failure":
      return "FAILED";
    case "cancelled":
    case "canceled":
    case "reversed":
    case "refunded":
      return "CANCELLED";
    case "incomplete":
    case "abandoned":
    case "timeout":
      return "INCOMPLETE";
    case "pending":
      return "PENDING";
    default:
      return raw ? raw.toUpperCase() : "PENDING";
  }
}

export interface ApplyPaymentInput {
  status: string; // mapped Payment.status (SUCCESS, FAILED, …)
  chapaReference?: string;
  txRef?: string;
  amount?: number;
  currency?: string;
  method?: string;
  charge?: number;
  raw?: unknown;
}

export interface ApplyPaymentResult {
  changed: boolean;
  paymentStatus: string;
  applicationStatus: string;
  paid: boolean;
}

export async function applyChapaPaymentResult(
  paymentId: string,
  input: ApplyPaymentInput
): Promise<ApplyPaymentResult | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { application: { include: { schedule: true } } },
  });
  if (!payment) return null;

  const app = payment.application;
  const targetStatus = mapChapaStatus(input.status);

  // Already paid — never downgrade. Refresh provider fields, keep PAID.
  if (payment.status === "SUCCESS") {
    const data: Prisma.PaymentUpdateInput = {};
    if (input.chapaReference && input.chapaReference !== payment.chapaReference) data.chapaReference = input.chapaReference;
    if (input.txRef && input.txRef !== payment.txRef) data.txRef = input.txRef;
    if (input.method) data.method = input.method;
    if (input.charge != null) data.charge = input.charge;
    if (input.raw !== undefined) data.rawWebhook = input.raw as Prisma.InputJsonValue;
    if (Object.keys(data).length > 0) {
      await prisma.payment.update({ where: { id: paymentId }, data });
    }
    return { changed: false, paymentStatus: "SUCCESS", applicationStatus: app.status, paid: true };
  }

  // Security guard for success: amount + currency must match what we charged.
  // A missing amount/currency is NOT treated as a match — an unsigned browser
  // callback (which carries no amount) can therefore never settle a payment;
  // only a verified source that reports the amount can.
  if (targetStatus === "SUCCESS") {
    const amountMatches = input.amount != null && Math.round(input.amount) === payment.amount;
    const currencyMatches =
      Boolean(input.currency) &&
      input.currency!.toString().toUpperCase() === payment.currency.toUpperCase();
    if (!amountMatches || !currencyMatches) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          chapaReference: input.chapaReference || payment.chapaReference,
          txRef: input.txRef || payment.txRef,
          notes: `Rejected SUCCESS: amount/currency mismatch (got ${input.amount ?? "?"} ${input.currency ?? "?"}, expected ${payment.amount} ${payment.currency})`,
          rawWebhook: input.raw !== undefined ? (input.raw as Prisma.InputJsonValue) : undefined,
        },
      });
      return { changed: false, paymentStatus: payment.status, applicationStatus: app.status, paid: false };
    }

    const updates: Prisma.PrismaPromise<unknown>[] = [
      prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: "SUCCESS",
          chapaReference: input.chapaReference || payment.chapaReference,
          txRef: input.txRef || payment.txRef,
          method: input.method,
          charge: input.charge,
          rawWebhook: input.raw !== undefined ? (input.raw as Prisma.InputJsonValue) : undefined,
          notes: null,
          paidAt: new Date(),
        },
      }),
      prisma.application.update({
        where: { id: app.id },
        // Never downgrade an already-CONFIRMED registration.
        data: { status: app.status === "CONFIRMED" ? "CONFIRMED" : "PAID" },
      }),
    ];

    // Seat bookkeeping: increment exactly once, when a payment turns paid.
    if (app.scheduleId) {
      updates.push(
        prisma.schedule.update({
          where: { id: app.scheduleId },
          data: { enrolled: { increment: 1 } },
        })
      );
    }

    await prisma.$transaction(updates);
    return { changed: true, paymentStatus: "SUCCESS", applicationStatus: "PAID", paid: true };
  }

  // Terminal non-success states — record them; registration stays PENDING.
  if (targetStatus !== payment.status) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: targetStatus,
        chapaReference: input.chapaReference || payment.chapaReference,
        txRef: input.txRef || payment.txRef,
        method: input.method,
        rawWebhook: input.raw !== undefined ? (input.raw as Prisma.InputJsonValue) : undefined,
      },
    });
    return { changed: true, paymentStatus: targetStatus, applicationStatus: app.status, paid: false };
  }

  return { changed: false, paymentStatus: payment.status, applicationStatus: app.status, paid: false };
}
