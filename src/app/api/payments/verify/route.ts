import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createDownloadToken } from "@/lib/downloadToken";
import { ChapaApiError, ChapaConfigError, verifyPayment } from "@/lib/payments/chapa";
import { checkAndIncrement } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const TX_REF_PATTERN = /^(?:TX-[A-F0-9]{16}|NA-\d{4}-[A-Z2-9]{6}(?:-retry-[a-f0-9]{16})?)$/;

function successfulStatus(status: string): boolean {
  const normalized = status.trim().toUpperCase();
  return normalized === "SUCCESS" || normalized === "PAID";
}

function paymentResponse(
  transaction: {
    txRef: string;
    amount: number;
    currency: string;
    chapaReference: string | null;
    paymentMethod: string | null;
    paidAt: Date | null;
    registration: {
      referenceId: string;
      fullName: string;
      status: string;
      course: { id: string; title: string };
    };
  },
  paidAt: Date,
) {
  return {
    status: "SUCCESS",
    payment: {
      studentName: transaction.registration.fullName,
      course: transaction.registration.course.title,
      courseId: transaction.registration.course.id,
      amount: transaction.amount,
      currency: transaction.currency,
      tx_ref: transaction.txRef,
      referenceId: transaction.registration.referenceId,
      chapa_reference: transaction.chapaReference,
      payment_method: transaction.paymentMethod,
      paidAt: (transaction.paidAt ?? paidAt).toISOString(),
    },
    downloadToken: createDownloadToken(transaction.registration.referenceId),
  };
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkAndIncrement(`payment-verify:${ip}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "Too many verification attempts. Please try again shortly." },
      { status: 429 },
    );
  }

  const txRef = (
    request.nextUrl.searchParams.get("tx_ref") ??
    request.nextUrl.searchParams.get("merchant_reference") ??
    ""
  ).trim();
  if (!TX_REF_PATTERN.test(txRef)) {
    return NextResponse.json({ error: "A valid transaction reference is required." }, { status: 400 });
  }

  try {
    const transaction = await prisma.transaction.findUnique({
      where: { txRef },
      select: {
        id: true,
        txRef: true,
        amount: true,
        currency: true,
        status: true,
        chapaReference: true,
        paymentMethod: true,
        paidAt: true,
        registration: {
          select: {
            id: true,
            referenceId: true,
            fullName: true,
            status: true,
            scheduleId: true,
            course: { select: { id: true, title: true } },
          },
        },
      },
    });
    if (!transaction) {
      return NextResponse.json({ error: "Payment transaction not found." }, { status: 404 });
    }

    if (transaction.status === "SUCCESS") {
      return NextResponse.json(paymentResponse(transaction, new Date()));
    }

    if (!transaction.chapaReference) {
      return NextResponse.json({ status: "PENDING" });
    }

    const verified = await verifyPayment(transaction.chapaReference);
    if (verified.merchant_reference !== txRef) {
      console.error("[payments/verify] Chapa merchant reference mismatch", {
        txRef,
        verifiedMerchantReference: verified.merchant_reference,
      });
      return NextResponse.json(
        { error: "Payment reference could not be confirmed." },
        { status: 409 },
      );
    }

    const success = successfulStatus(verified.status);
    const verifiedNetAmount =
      verified.amount !== null &&
      verified.service_fee !== null &&
      verified.service_fee >= 0 &&
      verified.service_fee <= verified.amount
        ? verified.amount - verified.service_fee
        : verified.amount;
    const amountMatches =
      verified.amount === transaction.amount || verifiedNetAmount === transaction.amount;
    const currencyMatches =
      verified.currency?.trim().toUpperCase() === transaction.currency.toUpperCase();

    if (success && (!amountMatches || !currencyMatches)) {
      console.error("[payments/verify] Verified payment does not match stored transaction", {
        txRef,
        expectedAmount: transaction.amount,
        receivedAmount: verified.amount,
        receivedServiceFee: verified.service_fee,
        expectedCurrency: transaction.currency,
        receivedCurrency: verified.currency,
      });
      return NextResponse.json(
        { error: "Verified payment details do not match this registration." },
        { status: 409 },
      );
    }

    if (!success) {
      return NextResponse.json({
        status: verified.status.trim().toUpperCase() || "PENDING",
      });
    }

    const paidAt = verified.updated_at || verified.created_at
      ? new Date(verified.updated_at ?? verified.created_at!)
      : new Date();
    const validPaidAt = Number.isNaN(paidAt.getTime()) ? new Date() : paidAt;

    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "SUCCESS",
          paidAt: validPaidAt,
          ...(verified.chapa_reference
            ? { chapaReference: verified.chapa_reference }
            : {}),
          ...(verified.payment_method
            ? { paymentMethod: verified.payment_method }
            : {}),
          ...(verified.service_fee !== null && Number.isFinite(verified.service_fee)
            ? { serviceFee: Math.round(verified.service_fee) }
            : {}),
        },
      });

      const updatedRegistration = await tx.registration.updateMany({
        where: { id: transaction.registration.id, status: "PENDING" },
        data: { status: "PAID", paidAt: validPaidAt },
      });
      if (updatedRegistration.count > 0 && transaction.registration.scheduleId) {
        await tx.schedule.update({
          where: { id: transaction.registration.scheduleId },
          data: { enrolled: { increment: 1 } },
        });
      }
    });

    return NextResponse.json({
      ...paymentResponse(transaction, validPaidAt),
      payment: {
        ...paymentResponse(transaction, validPaidAt).payment,
        chapa_reference: verified.chapa_reference ?? transaction.chapaReference,
        payment_method: verified.payment_method ?? transaction.paymentMethod,
        paidAt: validPaidAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof ChapaApiError) {
      console.error("[payments/verify] Chapa API error", {
        txRef,
        httpStatus: error.httpStatus,
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { error: "Could not verify payment yet. Please try again." },
        { status: 502 },
      );
    }
    if (error instanceof ChapaConfigError) {
      console.error("[payments/verify] Chapa configuration error", { message: error.message });
      return NextResponse.json(
        { error: "Payment verification is not configured." },
        { status: 500 },
      );
    }
    console.error("[payments/verify] Unexpected failure", {
      txRef,
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Payment verification failed." }, { status: 500 });
  }
}
