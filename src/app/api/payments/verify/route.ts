import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAndIncrement } from "@/lib/rateLimit";
import { verifyPayment, ChapaApiError, ChapaConfigError } from "@/lib/payments/chapa";
import { applyPaymentResult } from "@/lib/payments/apply";

export const dynamic = "force-dynamic";

// GET/POST /api/payments/verify — authoritative server-side verification.
//
// Identifies the payment by registration reference ID or merchant reference,
// asks Chapa what actually happened, and settles the registration only when
// Chapa confirms success and the amount and currency match what we stored.
//
// The browser is a signal, never proof: a redirect back from checkout or a
// client-side callback cannot mark anything paid on its own.
//
// Transient provider problems (network failure, 5xx, or a 404 while Chapa is
// still propagating the transaction) answer 200 with status PENDING so a
// polling client keeps polling instead of treating them as a hard failure.

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
  course: { title: string } | null;
  schedule: {
    group: string;
    session: string;
    days: string;
    startTime: string;
    endTime: string;
  } | null;
}

/**
 * Response body for a settled or in-flight payment. Deliberately excludes
 * student PII (name, email, phone): this endpoint is public and the
 * reference ID is the only capability presented.
 */
function buildSummary(target: VerificationTarget) {
  return {
    referenceId: target.referenceId,
    registrationStatus: target.applicationStatus,
    course: target.course?.title || null,
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

/** 200 + PENDING keeps a polling client alive through a transient problem. */
function pendingResponse(
  target: VerificationTarget,
  extra: { warning?: string; code?: string } = {}
) {
  return NextResponse.json(
    { status: "PENDING", registration: buildSummary(target), ...extra },
    { status: 200 }
  );
}

async function handle(request: NextRequest) {
  let referenceId = "";
  let merchantReference = "";

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
    merchantReference = pick("merchantReference");

    if (!referenceId && !merchantReference) {
      return NextResponse.json(
        { error: "A referenceId or merchantReference is required." },
        { status: 400 }
      );
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkAndIncrement(`verify:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json(
        { status: "PENDING", error: "Too many verification attempts. Try again shortly." },
        { status: 429 }
      );
    }

    const payment = await prisma.payment.findFirst({
      where: referenceId
        ? { application: { referenceId } }
        : { merchantReference },
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
            course: { select: { title: true } },
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

    // Nothing to verify against yet: checkout was never initialized for this
    // registration, or the reference has not been minted.
    if (!payment.merchantReference) {
      return pendingResponse(target, { code: "NOT_INITIALIZED" });
    }

    let verification;
    try {
      verification = await verifyPayment(payment.merchantReference);
    } catch (error) {
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
        // Chapa documents that a freshly created payment can briefly be
        // unknown, and that transient faults should be retried — both stay
        // PENDING rather than failing the poll.
        const transient =
          error.httpStatus === undefined ||
          error.httpStatus === 404 ||
          error.httpStatus >= 500;

        console.error("[verify] Chapa verification call failed:", {
          referenceId: target.referenceId,
          httpStatus: error.httpStatus,
          providerCode: error.code,
          message: error.message,
          transient,
        });

        if (transient) {
          return pendingResponse(target, {
            warning: "Verification is temporarily unavailable. Retrying.",
            code: "CHAPA_VERIFY_RETRYING",
          });
        }
        return NextResponse.json(
          { error: "Payment verification is currently unavailable." },
          { status: 502 }
        );
      }
      throw error;
    }

    // The verified transaction must belong to this registration. A mismatch
    // means the reference was reused or tampered with — never settle on it.
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
      // Chapa says success but the figures disagree with what we stored. Do
      // NOT grant access; surface it for manual reconciliation.
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
      { status: "ERROR", error: "Failed to verify payment." },
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