// ── Shared, idempotent payment-result applier ──────────────────────────────
// Both the webhook and the server-side verify route funnel into
// applyChapaPaymentResult so state transitions (and the schedule seat
// bookkeeping) happen exactly once:
//   - A payment is marked SUCCESS only when amount + currency match the
//     stored payment, and the registration moves to PAID at that moment.
//   - The enrolled seat is incremented exactly once per registration, on
//     the transition into SUCCESS (not at registration time).
//   - A payment already SUCCESS is never downgraded; refs/method are still
//     refreshed from the latest signal.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Map a Chapa verification/webhook status to our Payment.status. */
export function mapChapaStatus(status: string | undefined | null): string {
  const s = (status || "").toString().trim().toLowerCase();
  switch (s) {
    case "success":
      return "SUCCESS";
    case "failed":
      return "FAILED";
    case "cancelled":
    case "canceled":
      return "CANCELLED";
    case "incomplete":
    case "abandoned":
    case "timeout":
      return "INCOMPLETE";
    case "blocked":
      return "BLOCKED";
    case "auth_needed":
      return "AUTH_NEEDED";
    case "pending":
      return "PENDING";
    default:
      return s ? s.toUpperCase() : "PENDING";
  }
}

export interface ApplyPaymentInput {
  status: string; // mapped Payment.status (SUCCESS, FAILED, …)
  chapaReference?: string;
  merchantReference?: string;
  amount?: number;
  currency?: string;
  method?: string;
  serviceFee?: number;
  raw?: unknown;
}

/** Result returned to callers (webhook/verify/admin) for the API response. */
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
    if (input.merchantReference && input.merchantReference !== payment.merchantReference) data.merchantReference = input.merchantReference;
    if (input.method) data.method = input.method;
    if (input.serviceFee != null) data.serviceFee = input.serviceFee;
    if (input.raw !== undefined) data.rawWebhook = input.raw as Prisma.InputJsonValue;
    if (Object.keys(data).length > 0) {
      await prisma.payment.update({ where: { id: paymentId }, data });
    }
    return { changed: false, paymentStatus: "SUCCESS", applicationStatus: app.status, paid: true };
  }

  // Security guard for success: amount + currency must match what we charged.
  if (targetStatus === "SUCCESS") {
    const amountMatches = input.amount == null || Math.round(input.amount) === payment.amount;
    const currencyMatches =
      !input.currency || input.currency.toString().toUpperCase() === payment.currency.toUpperCase();
    if (!amountMatches || !currencyMatches) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          chapaReference: input.chapaReference || payment.chapaReference,
          merchantReference: input.merchantReference || payment.merchantReference,
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
          merchantReference: input.merchantReference || payment.merchantReference,
          method: input.method,
          serviceFee: input.serviceFee,
          rawWebhook: input.raw !== undefined ? (input.raw as Prisma.InputJsonValue) : undefined,
          notes: null,
          paidAt: new Date(),
        },
      }),
      prisma.application.update({
        where: { id: app.id },
        data: {
          // Never downgrade an already-CONFIRMED registration.
          status: app.status === "CONFIRMED" ? "CONFIRMED" : "PAID",
        },
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

  // Terminal non-success states — record them; registration stays pending.
  if (targetStatus !== payment.status) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: targetStatus,
        chapaReference: input.chapaReference || payment.chapaReference,
        merchantReference: input.merchantReference || payment.merchantReference,
        method: input.method,
        rawWebhook: input.raw !== undefined ? (input.raw as Prisma.InputJsonValue) : undefined,
      },
    });
    return { changed: true, paymentStatus: targetStatus, applicationStatus: app.status, paid: false };
  }

  return { changed: false, paymentStatus: payment.status, applicationStatus: app.status, paid: false };
}