import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createDownloadToken } from "@/lib/downloadToken";
import { verifyPayment, ChapaApiError, ChapaConfigError } from "@/lib/payments/chapa";
import { checkAndIncrement } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const TX_REF_PATTERN = /^NA-\d{4}-[A-Z2-9]{6}(?:-retry-[a-f0-9]{16})?$/;

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkAndIncrement(`payment-verify:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many verification attempts. Please try again shortly." }, { status: 429 });
  }

  const txRef = request.nextUrl.searchParams.get("tx_ref")?.trim() ?? "";
  if (!TX_REF_PATTERN.test(txRef)) {
    return NextResponse.json({ error: "A valid tx_ref is required." }, { status: 400 });
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
        paidAt: true,
        chapaReference: true,
        paymentMethod: true,
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

    if (transaction.status === "SUCCESS" || transaction.registration.status === "PAID" || transaction.registration.status === "CONFIRMED") {
      return NextResponse.json({
        status: "SUCCESS",
        payment: {
          studentName: transaction.registration.fullName,
          course: transaction.registration.course.title,
          courseId: transaction.registration.course.id,
          amount: transaction.amount,
          currency: transaction.currency,
          tx_ref: txRef,
          referenceId: transaction.registration.referenceId,
          chapa_reference: transaction.chapaReference,
          payment_method: transaction.paymentMethod,
          paidAt: transaction.paidAt?.toISOString() ?? new Date().toISOString(),
        },
        downloadToken: createDownloadToken(transaction.registration.referenceId),
      });
    }

    if (!transaction.chapaReference) {
      return NextResponse.json({ status: "PENDING" });
    }

    const verified = await verifyPayment(transaction.chapaReference);
    if (verified.merchant_reference !== txRef) {
      console.error("[payments/verify] Chapa reference mismatch", {
        txRef,
        verifiedMerchantReference: verified.merchant_reference,
      });
      return NextResponse.json({ error: "Payment reference could not be confirmed." }, { status: 409 });
    }

    const status = verified.status.trim().toUpperCase();
    const isSuccess = status === "SUCCESS" || status === "PAID";
    const verifiedNetAmount =
      verified.amount !== null &&
      verified.service_fee !== null &&
      verified.service_fee >= 0 &&
      verified.service_fee <= verified.amount
        ? verified.amount - verified.service_fee
        : verified.amount;
    const expectedScaledAmount = transaction.amount * 100;
    const amountMatches =
      verified.amount === transaction.amount ||
      verified.amount === expectedScaledAmount ||
      verifiedNetAmount === transaction.amount ||
      verifiedNetAmount === expectedScaledAmount;
    const currencyMatches = verified.currency?.toUpperCase() === transaction.currency.toUpperCase();

    if (isSuccess && (!amountMatches || !currencyMatches)) {
      console.error("[payments/verify] Verified payment does not match transaction", {
        txRef,
        expectedAmount: transaction.amount,
        receivedAmount: verified.amount,
        expectedCurrency: transaction.currency,
        receivedCurrency: verified.currency,
      });
      return NextResponse.json(
        { error: "The payment details do not match this registration. Please contact support." },
        { status: 409 },
      );
    }

    const paymentStatus = isSuccess
      ? "SUCCESS"
      : status === "FAILED" || status === "CANCELLED" || status === "INCOMPLETE"
        ? status
        : "PENDING";

    const isAlreadyPaid =
      transaction.status === "SUCCESS" ||
      transaction.registration.status === "PAID" ||
      transaction.registration.status === "CONFIRMED";

    if (isSuccess || !isAlreadyPaid) {
      const verifiedPaidAt = verified.updated_at || verified.created_at
        ? new Date(verified.updated_at ?? verified.created_at!)
        : null;
      const paidAt = verifiedPaidAt && !Number.isNaN(verifiedPaidAt.getTime())
        ? verifiedPaidAt
        : new Date();
      await prisma.$transaction(async (tx) => {
        const data = {
            status: paymentStatus,
            ...(verified.chapa_reference ? { chapaReference: verified.chapa_reference } : {}),
            ...(verified.payment_method ? { paymentMethod: verified.payment_method } : {}),
            ...(verified.service_fee != null && Number.isFinite(verified.service_fee)
              ? { serviceFee: Math.round(verified.service_fee) }
              : {}),
            ...(isSuccess ? { paidAt } : {}),
          };

        if (isSuccess) {
          await tx.transaction.update({ where: { id: transaction.id }, data });
        } else {
          await tx.transaction.updateMany({
            where: { id: transaction.id, status: { not: "SUCCESS" } },
            data,
          });
        }

        if (isSuccess) {
          const registration = await tx.registration.findUnique({
            where: { id: transaction.registration.id },
            select: { status: true, scheduleId: true },
          });
          if (!registration) throw new Error("Registration not found");

          const paidTransition = registration.status === "PENDING"
            ? await tx.registration.updateMany({
                where: { id: transaction.registration.id, status: "PENDING" },
                data: { status: "PAID", paidAt },
              })
            : { count: 0 };
          if (paidTransition.count > 0 && registration.scheduleId) {
            await tx.schedule.update({
              where: { id: registration.scheduleId },
              data: { enrolled: { increment: 1 } },
            });
          }
        }
      });
    }

    const transactionAlreadyPaid = transaction.status === "SUCCESS";
    if (!isSuccess && !transactionAlreadyPaid) {
      return NextResponse.json({ status: paymentStatus });
    }

    return NextResponse.json({
      status: "SUCCESS",
      payment: {
        studentName: transaction.registration.fullName,
        course: transaction.registration.course.title,
        courseId: transaction.registration.course.id,
        amount: transaction.amount,
        currency: transaction.currency,
        tx_ref: txRef,
        referenceId: transaction.registration.referenceId,
        chapa_reference: verified.chapa_reference ?? transaction.chapaReference,
        payment_method: verified.payment_method,
        paidAt:
          verified.updated_at ??
          verified.created_at ??
          transaction.paidAt?.toISOString() ??
          new Date().toISOString(),
      },
      downloadToken: createDownloadToken(transaction.registration.referenceId),
    });
  } catch (error) {
    if (error instanceof ChapaApiError) {
      console.error("[payments/verify] Chapa API error", {
        txRef,
        httpStatus: error.httpStatus,
        code: error.code,
        message: error.message,
      });
      return NextResponse.json({ error: "Could not verify payment yet. Please try again." }, { status: 502 });
    }
    if (error instanceof ChapaConfigError) {
      console.error("[payments/verify] Chapa configuration error", { message: error.message });
      return NextResponse.json({ error: "Payment verification is not configured." }, { status: 500 });
    }
    console.error("[payments/verify] Unexpected failure", {
      txRef,
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Payment verification failed." }, { status: 500 });
  }
}
