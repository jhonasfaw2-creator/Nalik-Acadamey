import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPayment, ChapaApiError, ChapaConfigError } from "@/lib/payments/chapa";
import { applyPaymentResult } from "@/lib/payments/apply";

export const dynamic = "force-dynamic";

// POST /api/admin/registrations/[id]/verify — reconcile one registration
// against Chapa on demand.
//
// Settlement normally happens through the browser return page or a webhook,
// both of which can be missed (student closed the tab, redirect landed on the
// wrong path, webhook not yet delivered). This endpoint lets an admin ask
// Chapa directly, so a payment that really succeeded can be settled without
// manually marking the student PAID.
//
// It is authenticated by the admin middleware (same as every other /api/admin
// route) and uses the exact same idempotent applier as the public verify route
// and the webhook, so it can never double-enroll a student or grant a seat
// without a matching amount and currency.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const application = await prisma.application.findUnique({
      where: { id },
      select: {
        id: true,
        referenceId: true,
        status: true,
        payment: {
          select: {
            id: true,
            status: true,
            merchantReference: true,
            chapaReference: true,
          },
        },
      },
    });

    if (!application) {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }

    const payment = application.payment;
    if (!payment) {
      return NextResponse.json(
        { error: "This registration has no online payment to verify." },
        { status: 400 }
      );
    }

    if (payment.status === "SUCCESS") {
      return NextResponse.json({
        success: true,
        alreadySettled: true,
        status: "SUCCESS",
        applicationStatus: application.status,
      });
    }

    const reference = payment.chapaReference || payment.merchantReference;
    if (!reference) {
      return NextResponse.json(
        { error: "This registration has no payment reference to verify with Chapa." },
        { status: 400 }
      );
    }

    const verification = await verifyPayment(reference);

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
      console.error("[admin-verify] Rejected SUCCESS on amount/currency mismatch", {
        referenceId: application.referenceId,
        mismatch: applied.mismatch,
      });
      return NextResponse.json(
        {
          success: false,
          status: applied.paymentStatus,
          code: "AMOUNT_MISMATCH",
          error:
            "Chapa reported a payment, but the amount or currency does not match this registration. Review it manually.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      status: applied.paymentStatus,
      applicationStatus: applied.applicationStatus,
      changed: applied.changed,
      alreadyPaid: applied.alreadyPaid ?? false,
    });
  } catch (error) {
    if (error instanceof ChapaConfigError) {
      console.error("[admin-verify] Chapa configuration error:", {
        registrationId: id,
        message: error.message,
      });
      return NextResponse.json(
        { error: "Payment verification is not configured on this server." },
        { status: 500 }
      );
    }

    if (error instanceof ChapaApiError) {
      console.error("[admin-verify] Chapa verification call failed:", {
        registrationId: id,
        httpStatus: error.httpStatus,
        providerCode: error.code,
        message: error.message,
      });
      return NextResponse.json(
        {
          error:
            "Chapa could not find or confirm this transaction. The student may not have completed payment.",
        },
        { status: error.httpStatus === 404 ? 404 : 502 }
      );
    }

    console.error("[admin-verify] Unexpected failure:", {
      registrationId: id,
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to verify the payment." }, { status: 500 });
  }
}
