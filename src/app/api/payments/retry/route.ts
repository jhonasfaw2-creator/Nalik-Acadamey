import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { generateMerchantReference } from "@/lib/payments/chapa";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const currentPaymentId = request.cookies.get("nalik_payment")?.value;
  if (!currentPaymentId) {
    return NextResponse.json({ error: "No payment session was found." }, { status: 400 });
  }

  try {
    const paymentId = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const current = await tx.payment.findUnique({
        where: { id: currentPaymentId },
        select: {
          id: true,
          registrationId: true,
          amount: true,
          currency: true,
          status: true,
          registration: { select: { status: true } },
        },
      });
      if (!current) throw new Error("PAYMENT_NOT_FOUND");
      if (current.registration.status !== "PENDING") throw new Error("REGISTRATION_NOT_PENDING");
      if (current.status === "PENDING") return current.id;
      if (!["FAILED", "CANCELLED", "INCOMPLETE"].includes(current.status)) {
        throw new Error("PAYMENT_NOT_RETRYABLE");
      }

      const existingPending = await tx.payment.findFirst({
        where: { registrationId: current.registrationId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (existingPending) return existingPending.id;

      const retry = await tx.payment.create({
        data: {
          registrationId: current.registrationId,
          merchantReference: generateMerchantReference(),
          amount: current.amount,
          currency: current.currency,
          status: "PENDING",
        },
        select: { id: true },
      });
      return retry.id;
    });

    const response = NextResponse.json({ success: true, paymentId });
    response.cookies.set("nalik_payment", paymentId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/payments",
      maxAge: 60 * 60 * 3,
    });
    return response;
  } catch (error) {
    if (error instanceof Error) {
      const responses: Record<string, { error: string; status: number }> = {
        PAYMENT_NOT_FOUND: { error: "Payment not found.", status: 404 },
        REGISTRATION_NOT_PENDING: {
          error: "This registration is already confirmed.",
          status: 409,
        },
        PAYMENT_NOT_RETRYABLE: {
          error: "This payment cannot be retried. Contact the academy for help.",
          status: 409,
        },
      };
      const result = responses[error.message];
      if (result) return NextResponse.json({ error: result.error }, { status: result.status });
    }
    console.error("Payment retry creation failed:", error);
    return NextResponse.json(
      { error: "We could not prepare another payment attempt. Please try again." },
      { status: 500 },
    );
  }
}
