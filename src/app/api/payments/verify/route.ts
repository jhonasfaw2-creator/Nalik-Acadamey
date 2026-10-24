import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPrismaError } from "@/lib/http";
import type { Prisma } from "@prisma/client";
import {
  findChapaReferenceForPayment,
  parseVerifiedChapaPayment,
  reconcileVerifiedPayment,
  verifyChapaPayment,
} from "@/lib/payments/chapa";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const paymentId = request.cookies.get("nalik_payment")?.value;
  if (!paymentId) {
    return NextResponse.json({ error: "No payment session was found." }, { status: 400 });
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { registration: { select: { referenceId: true, status: true } } },
    });
    if (!payment) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    if (payment.status === "SUCCESS") {
      return NextResponse.json({
        paymentStatus: payment.status,
        registrationStatus: payment.registration.status,
        referenceId: payment.registration.referenceId,
      });
    }

    // Prefer the Chapa payment reference stored by a previous verification or
    // webhook. Until then, the payment list resolves it for completed payments;
    // a still-pending payment is verified by our merchant reference.
    let chapaResponse: unknown;
    if (payment.chapaReference) {
      try {
        chapaResponse = await verifyChapaPayment(payment.chapaReference);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "CHAPA_VERIFICATION_FAILED") {
          throw error;
        }
        const resolvedReference = await findChapaReferenceForPayment(payment.merchantReference);
        if (!resolvedReference || resolvedReference === payment.chapaReference) throw error;
        chapaResponse = await verifyChapaPayment(resolvedReference);
      }
    } else {
      const resolvedReference = await findChapaReferenceForPayment(payment.merchantReference);
      chapaResponse = await verifyChapaPayment(resolvedReference ?? payment.merchantReference);
    }

    const verified = parseVerifiedChapaPayment(chapaResponse, {
      merchantReference: payment.merchantReference,
      amount: payment.amount,
      currency: payment.currency,
    });

    const paymentStatus = await prisma.$transaction((tx: Prisma.TransactionClient) =>
      reconcileVerifiedPayment(
        tx,
        payment.id,
        verified?.chapaReference ?? payment.chapaReference,
        verified,
      ),
    );
    const registrationStatus =
      paymentStatus === "SUCCESS" ? "CONFIRMED" : payment.registration.status;
    return NextResponse.json({
      paymentStatus,
      registrationStatus,
      referenceId: payment.registration.referenceId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYMENT_SCHEDULE_FULL") {
      return NextResponse.json(
        { error: "Payment is verified, but this schedule is full. Contact the academy." },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message.startsWith("CHAPA_SECRET_KEY")) {
      return NextResponse.json(
        { error: "Online payment verification is not configured." },
        { status: 503 },
      );
    }
    if (isPrismaError(error, "P2025")) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }
    console.error("Payment verification failed:", error);
    return NextResponse.json(
      { error: "Payment verification is temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }
}
