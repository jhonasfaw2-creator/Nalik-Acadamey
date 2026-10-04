import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPayment, ChapaApiError, ChapaConfigError } from "@/lib/payments/chapa";
import { resolveChapaReference } from "@/lib/payments/resolve";
import { applyPaymentResult } from "@/lib/payments/apply";

export const dynamic = "force-dynamic";

// POST /api/admin/registrations/reconcile — settle every outstanding Chapa
// payment in one pass.
//
// Individual payments only settle when a signal arrives: the hosted checkout
// redirects back, or Chapa delivers a webhook. Both can be missed — the
// customer completes payment on Chapa's own receipt page and never returns, or
// a webhook is rejected. When that happens the money is real and the database
// still says PENDING, which is exactly the "admin cannot see the student who
// paid" symptom.
//
// This endpoint closes that gap on demand: for each unsettled payment it asks
// Chapa what actually happened and applies the result through the same
// idempotent applier every other path uses. Payments whose Chapa reference was
// never captured are recovered from the transaction list first, so this doubles
// as the repair tool for older rows.
//
// It is authenticated by the admin middleware and never grants a seat without a
// Chapa-confirmed amount and currency that match what we stored.

/** Keeps one reconcile pass well inside the function time limit. */
const MAX_PAYMENTS = 60;
/** Chapa is called once per payment; run them in small parallel batches. */
const BATCH_SIZE = 5;

type Outcome = "settled" | "already_settled" | "not_found" | "pending" | "unavailable" | "mismatch" | "error";

interface ReconcileResult {
  referenceId: string;
  outcome: Outcome;
  detail?: string;
}

async function reconcileOne(paymentId: string): Promise<ReconcileResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      status: true,
      merchantReference: true,
      chapaReference: true,
      application: { select: { referenceId: true } },
    },
  });

  if (!payment) {
    return { referenceId: "", outcome: "not_found" };
  }
  const referenceId = payment.application.referenceId;

  if (payment.status === "SUCCESS") {
    return { referenceId, outcome: "already_settled" };
  }

  const resolution = await resolveChapaReference({
    id: payment.id,
    merchantReference: payment.merchantReference,
    chapaReference: payment.chapaReference,
  });

  if (!resolution.reference) {
    return resolution.providerUnavailable
      ? { referenceId, outcome: "unavailable", detail: "Chapa could not be reached" }
      : { referenceId, outcome: "not_found", detail: "No Chapa transaction for this reference" };
  }

  let verification;
  try {
    verification = await verifyPayment(resolution.reference);
  } catch (error) {
    if (error instanceof ChapaApiError) {
      if (error.httpStatus === 404) {
        return { referenceId, outcome: "not_found", detail: "Chapa has no such transaction" };
      }
      return { referenceId, outcome: "unavailable", detail: error.message };
    }
    if (error instanceof ChapaConfigError) {
      return { referenceId, outcome: "error", detail: error.message };
    }
    return { referenceId, outcome: "error", detail: "Unexpected verification failure" };
  }

  const applied = await applyPaymentResult(payment.id, {
    status: verification.status,
    chapaReference: verification.chapaReference ?? resolution.reference,
    merchantReference: verification.merchantReference,
    amount: verification.amount,
    currency: verification.currency,
    paymentMethod: verification.paymentMethod,
    serviceFee: verification.serviceFee,
  });

  if (!applied) {
    return { referenceId, outcome: "not_found" };
  }
  if (applied.mismatch) {
    return { referenceId, outcome: "mismatch", detail: `Chapa reported a different ${applied.mismatch}` };
  }
  if (applied.paid) {
    return {
      referenceId,
      outcome: applied.changed ? "settled" : "already_settled",
    };
  }
  return {
    referenceId,
    outcome: "pending",
    detail: `Chapa reports ${verification.status}`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const requestedLimit = Number((body as { limit?: unknown })?.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), MAX_PAYMENTS)
      : MAX_PAYMENTS;

    // Oldest first: the payments that have been stuck longest are the ones an
    // admin most wants resolved.
    const pending = await prisma.payment.findMany({
      where: { status: { not: "SUCCESS" } },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true },
    });

    const results: ReconcileResult[] = [];
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      const settled = await Promise.all(
        batch.map((row) =>
          reconcileOne(row.id).catch(
            (): ReconcileResult => ({ referenceId: "", outcome: "error", detail: "Reconcile failed" })
          )
        )
      );
      results.push(...settled);
    }

    const tally = results.reduce<Record<Outcome, number>>(
      (acc, result) => {
        acc[result.outcome] = (acc[result.outcome] ?? 0) + 1;
        return acc;
      },
      {} as Record<Outcome, number>
    );

    console.info("[admin-reconcile] pass complete", {
      examined: pending.length,
      ...tally,
    });

    return NextResponse.json({
      success: true,
      examined: pending.length,
      summary: tally,
      // Only the rows an admin actually has to look at. "No transaction at
      // Chapa" is a normal answer for an abandoned checkout, not a problem.
      needsAttention: results.filter(
        (result) =>
          result.outcome === "mismatch" ||
          result.outcome === "error" ||
          result.outcome === "unavailable"
      ),
      settled: results.filter(
        (result) => result.outcome === "settled" || result.outcome === "already_settled"
      ),
    });
  } catch (error) {
    console.error("[admin-reconcile] pass failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Reconcile failed." }, { status: 500 });
  }
}