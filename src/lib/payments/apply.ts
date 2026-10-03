import { prisma } from "@/lib/prisma";
import type { PaymentStatus } from "@/lib/payments/chapa";

// ── Idempotent payment-result applier ─────────────────────────────────────
// Shared by the verify route and the webhook so a payment settles exactly once
// no matter how many signals arrive for it.
//
// Invariants:
//   - A payment moves to SUCCESS only when Chapa reports success AND the
//     amount and currency match what we stored. A browser callback carries no
//     amount, so it can never settle a payment on its own.
//   - The PENDING → SUCCESS claim uses a conditional updateMany, so under
//     concurrent requests exactly one caller wins the transition. Only the
//     winner flips the registration and takes a seat, which keeps
//     schedule.enrolled from drifting.
//   - A payment already SUCCESS is never downgraded; provider fields are
//     refreshed so late webhooks still fill in the Chapa reference.

export interface ApplyPaymentInput {
  status: PaymentStatus;
  chapaReference?: string | null;
  merchantReference?: string | null;
  amount?: number | null;
  currency?: string | null;
  paymentMethod?: string | null;
  serviceFee?: number | null;
}

export interface ApplyPaymentResult {
  /** True when this call performed the PENDING → SUCCESS transition. */
  changed: boolean;
  paymentStatus: PaymentStatus;
  applicationStatus: string;
  paid: boolean;
  paidAt: Date | null;
  /** Set when Chapa claimed success but the amount or currency disagreed. */
  mismatch?: "amount" | "currency" | null;
  /** True when the payment had already succeeded before this call. */
  alreadyPaid?: boolean;
}

export async function applyPaymentResult(
  paymentId: string,
  input: ApplyPaymentInput
): Promise<ApplyPaymentResult | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      applicationId: true,
      amount: true,
      currency: true,
      status: true,
      paidAt: true,
      chapaReference: true,
      merchantReference: true,
      paymentMethod: true,
      serviceFee: true,
      application: { select: { status: true, scheduleId: true } },
    },
  });
  if (!payment) return null;

  const providerFields = {
    ...(input.chapaReference ? { chapaReference: input.chapaReference } : {}),
    ...(input.merchantReference ? { merchantReference: input.merchantReference } : {}),
    ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
    ...(input.serviceFee != null ? { serviceFee: input.serviceFee } : {}),
  };

  // Already settled — refresh provider metadata, never downgrade.
  if (payment.status === "SUCCESS") {
    await prisma.payment.update({ where: { id: paymentId }, data: providerFields });
    return {
      changed: false,
      alreadyPaid: true,
      paid: true,
      paymentStatus: "SUCCESS",
      applicationStatus: payment.application.status,
      paidAt: payment.paidAt,
    };
  }

  if (input.status === "SUCCESS") {
    // A missing amount or currency is NOT a match: only a verified server-side
    // source that reports the charged figures can settle a payment.
    const amountMatches = input.amount != null && Math.round(input.amount) === payment.amount;
    const currencyMatches =
      Boolean(input.currency) &&
      input.currency!.toString().toUpperCase() === payment.currency.toUpperCase();

    if (!amountMatches || !currencyMatches) {
      await prisma.payment.update({ where: { id: paymentId }, data: providerFields });
      return {
        changed: false,
        paid: false,
        mismatch: !amountMatches ? "amount" : "currency",
        paymentStatus: payment.status as PaymentStatus,
        applicationStatus: payment.application.status,
        paidAt: null,
      };
    }

    const paidAt = new Date();

    // Atomic claim: only the caller whose update actually changed a row goes on
    // to confirm the registration and occupy a seat.
    const claimed = await prisma.payment.updateMany({
      where: { id: paymentId, status: { not: "SUCCESS" } },
      data: { status: "SUCCESS", paidAt, ...providerFields },
    });

    if (claimed.count === 0) {
      // Lost the race; the winner already settled it.
      const settled = await prisma.payment.findUnique({
        where: { id: paymentId },
        select: { status: true, paidAt: true },
      });
      return {
        changed: false,
        alreadyPaid: true,
        paid: true,
        paymentStatus: "SUCCESS",
        applicationStatus: payment.application.status,
        paidAt: settled?.paidAt ?? paidAt,
      };
    }

    await prisma.$transaction([
      prisma.application.update({
        where: { id: payment.applicationId },
        data: { status: "CONFIRMED", paidAt },
      }),
      ...(payment.application.scheduleId
        ? [
            prisma.schedule.update({
              where: { id: payment.application.scheduleId },
              data: { enrolled: { increment: 1 } },
            }),
          ]
        : []),
    ]);

    return {
      changed: true,
      paid: true,
      paymentStatus: "SUCCESS",
      applicationStatus: "CONFIRMED",
      paidAt,
    };
  }

  // Terminal non-success states (FAILED / CANCELLED / INCOMPLETE / PENDING) are
  // recorded so the admin list stays accurate. The registration is untouched:
  // only a verified success may grant a seat.
  if (input.status !== payment.status) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: input.status, ...providerFields },
    });
  } else if (Object.keys(providerFields).length > 0) {
    await prisma.payment.update({ where: { id: paymentId }, data: providerFields });
  }

  return {
    changed: input.status !== payment.status,
    paid: false,
    paymentStatus: input.status,
    applicationStatus: payment.application.status,
    paidAt: null,
  };
}