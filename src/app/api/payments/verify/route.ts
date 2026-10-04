import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAndIncrement } from "@/lib/rateLimit";
import { verifyPayment, ChapaApiError, ChapaConfigError } from "@/lib/payments/chapa";
import {
  verifyWithRecovery,
  UnresolvableReferenceError,
} from "@/lib/payments/resolve";
import { applyPaymentResult } from "@/lib/payments/apply";

export const dynamic = "force-dynamic";

/** Generous enough for a polling return page, tight enough to protect Chapa. */
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

interface VerificationTarget {
  paymentId: string;
  referenceId: string;
  applicationId: string;
  applicationStatus: string;
  merchantReference: string | null;
  paymentStatus: string;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  chapaReference: string | null;
  paidAt: Date | null;
  course: { id: string; title: string } | null;
  schedule: {
    group: string;
    session: string;
    days: string;
    startTime: string;
    endTime: string;
  } | null;
}

function buildSummary(target: VerificationTarget) {
  return {
    referenceId: target.referenceId,
    registrationStatus: target.applicationStatus,
    course: target.course?.title || null,
    courseId: target.course?.id || null,
    schedule: target.schedule
      ? `SCHEDULE ${target.schedule.group}: ${target.schedule.session} (${target.schedule.days}, ${target.schedule.startTime}–${target.schedule.endTime})`
      : null,
    amount: target.amount,
    currency: target.currency,
    paymentStatus: target.paymentStatus,
    paymentMethod: target.paymentMethod,
    merchantReference: target.merchantReference,
    chapaReference: target.chapaReference,
    paidAt: target.paidAt ? target.paidAt.toISOString() : null,
  };
}

async function handle(request: NextRequest) {
  let referenceId = "";
  let merchantReference = "";
  let chapaReference = "";

  try {
    const search = request.nextUrl.searchParams;
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const bag = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

    const pick = (name: string): string => {
      const fromBody = bag[name];
      if (typeof fromBody === "string" && fromBody.trim()) return fromBody.trim();
      return search.get(name)?.trim() || "";
    };

    referenceId = pick("referenceId").toUpperCase();
    merchantReference =
      pick("merchantReference") || pick("tx_ref") || pick("trxref") || pick("trx_ref");
    chapaReference =
      pick("chapaReference") || pick("chapa_reference") || pick("ref_id") || pick("reference");

    if (!referenceId && !merchantReference && !chapaReference) {
      return NextResponse.json(
        { error: "A referenceId, merchantReference or chapaReference is required." },
        { status: 400 }
      );
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkAndIncrement(`verify:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many verification attempts. Try again shortly." },
        { status: 429 }
      );
    }

    const payment = await prisma.payment.findFirst({
      where: referenceId
        ? { application: { referenceId } }
        : merchantReference
          ? { merchantReference }
          : { chapaReference },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        paymentMethod: true,
        merchantReference: true,
        chapaReference: true,
        paidAt: true,
        application: {
          select: {
            id: true,
            referenceId: true,
            status: true,
            course: { select: { id: true, title: true } },
            schedule: {
              select: { group: true, session: true, days: true, startTime: true, endTime: true },
            },
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }

    const target: VerificationTarget = {
      paymentId: payment.id,
      referenceId: payment.application.referenceId,
      applicationId: payment.application.id,
      applicationStatus: payment.application.status,
      merchantReference: payment.merchantReference,
      paymentStatus: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      chapaReference: payment.chapaReference,
      paidAt: payment.paidAt,
      course: payment.application.course,
      schedule: payment.application.schedule,
    };

    // Already settled — answer from the database without calling Chapa.
    if (payment.status === "SUCCESS") {
      return NextResponse.json({
        status: "SUCCESS",
        registration: buildSummary(target),
      });
    }

    // Verify with Chapa. /v2/payments/{reference}/verify resolves Chapa *transaction*
    // references only. verifyWithRecovery resolves the reference (recovering and
    // persisting it from the transaction list when needed) and re-resolves once
    // if the stored value turns out not to be verifiable.
    let verification: Awaited<ReturnType<typeof verifyPayment>>;
    let usedReference: string;
    let recoveredReference = false;
    try {
      const outcome = await verifyWithRecovery(
        {
          id: payment.id,
          merchantReference: payment.merchantReference,
          chapaReference: payment.chapaReference,
        },
        verifyPayment
      );
      verification = outcome.verification;
      usedReference = outcome.reference;
      recoveredReference = outcome.recovered;
    } catch (error) {
      if (error instanceof UnresolvableReferenceError) {
        // No Chapa transaction exists for this reference — payment never completed.
        return NextResponse.json({
          status: "FAILED",
          code: error.providerUnavailable ? "CHAPA_UNAVAILABLE" : "NO_TRANSACTION",
          error: error.providerUnavailable
            ? "Chapa could not be reached. Please try again shortly."
            : "No payment transaction found for this registration.",
          registration: buildSummary(target),
        }, { status: error.providerUnavailable ? 502 : 404 });
      }

      if (error instanceof ChapaConfigError) {
        console.error("[verify] Chapa configuration error:", {
          referenceId: referenceId || undefined,
          message: error.message,
        });
        return NextResponse.json(
          { error: "Payment verification is not configured on this server." },
          { status: 500 }
        );
      }

      if (error instanceof ChapaApiError) {
        // Transient Chapa errors (network, 5xx) — return 502 so client knows to retry.
        const transient =
          error.httpStatus === undefined ||
          error.httpStatus >= 500;

        console.error("[verify] Chapa verification call failed:", {
          referenceId: target.referenceId,
          httpStatus: error.httpStatus,
          providerCode: error.code,
          message: error.message,
          transient,
        });

        if (transient) {
          return NextResponse.json(
            { error: "Chapa verification temporarily unavailable. Please retry." },
            { status: 502 }
          );
        }
        // 404 = Chapa has no such transaction = payment not completed.
        return NextResponse.json({
          status: "FAILED",
          code: "NO_TRANSACTION",
          error: "No payment transaction found for this registration.",
          registration: buildSummary(target),
        }, { status: 404 });
      }
      throw error;
    }

    if (recoveredReference) {
      console.info("[verify] Recovered the Chapa reference from the transaction list", {
        referenceId: target.referenceId,
        usedReference,
      });
    }

    // The verified transaction must belong to this registration.
    if (
      verification.merchantReference &&
      verification.merchantReference !== payment.merchantReference
    ) {
      console.error("[verify] merchant_reference mismatch", {
        referenceId: target.referenceId,
        expected: payment.merchantReference,
        received: verification.merchantReference,
      });
      return NextResponse.json({
        status: "FAILED",
        code: "REFERENCE_MISMATCH",
        registration: buildSummary(target),
      });
    }

    const applied = await applyPaymentResult(payment.id, {
      status: verification.status,
      chapaReference: verification.chapaReference,
      merchantReference: verification.merchantReference,
      amount: verification.amount,
      currency: verification.currency,
      paymentMethod: verification.paymentMethod,
      serviceFee: verification.serviceFee,
    });

    if (!applied) {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }

    if (applied.mismatch) {
      console.error("[verify] Rejected SUCCESS on amount/currency mismatch", {
        referenceId: target.referenceId,
        mismatch: applied.mismatch,
        expected: { amount: payment.amount, currency: payment.currency },
        received: {
          amount: verification.amount,
          currency: verification.currency,
          chapaReference: verification.chapaReference,
        },
      });
      return NextResponse.json({
        status: "FAILED",
        code: "AMOUNT_MISMATCH",
        error: "The verified payment does not match this registration.",
        registration: buildSummary({ ...target, paymentStatus: applied.paymentStatus }),
      });
    }

    // Re-read so the response reflects the committed state.
    const [freshPayment, freshApplication] = await Promise.all([
      prisma.payment.findUnique({
        where: { id: payment.id },
        select: {
          status: true,
          paymentMethod: true,
          merchantReference: true,
          chapaReference: true,
          paidAt: true,
        },
      }),
      prisma.application.findUnique({
        where: { id: payment.application.id },
        select: { status: true },
      }),
    ]);

    return NextResponse.json({
      status: freshPayment?.status ?? applied.paymentStatus,
      registration: buildSummary({
        ...target,
        applicationStatus: freshApplication?.status ?? applied.applicationStatus,
        paymentStatus: freshPayment?.status ?? applied.paymentStatus,
        paymentMethod: freshPayment?.paymentMethod ?? target.paymentMethod,
        merchantReference: freshPayment?.merchantReference ?? target.merchantReference,
        chapaReference: freshPayment?.chapaReference ?? target.chapaReference,
        paidAt: freshPayment?.paidAt ?? applied.paidAt,
      }),
    });
  } catch (error) {
    console.error("[verify] Unexpected verification failure:", {
      referenceId: referenceId || merchantReference || undefined,
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to verify payment." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}