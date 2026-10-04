import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPayment } from "@/lib/payments/chapa";
import { verifyWithRecovery, UnresolvableReferenceError } from "@/lib/payments/resolve";
import { applyPaymentResult } from "@/lib/payments/apply";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const merchantReference = cookieStore.get("na_pending_ref")?.value?.trim();

  if (!merchantReference) {
    return NextResponse.json({ status: "UNKNOWN", reason: "no_cookie" });
  }

  const payment = await prisma.payment.findUnique({
    where: { merchantReference },
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      merchantReference: true,
      chapaReference: true,
      application: {
        select: {
          referenceId: true,
          status: true,
        },
      },
    },
  });

  if (!payment) {
    return NextResponse.json({ status: "UNKNOWN", reason: "not_found" });
  }

  // Already settled — return immediately without calling Chapa.
  if (payment.status === "SUCCESS") {
    return NextResponse.json({
      status: "SUCCESS",
      referenceId: payment.application.referenceId,
      merchantReference,
      chapaReference: payment.chapaReference,
    });
  }

  // Verify with Chapa server-to-server.
  let verification: Awaited<ReturnType<typeof verifyPayment>>;
  let usedReference: string;
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
  } catch (error) {
    if (error instanceof UnresolvableReferenceError) {
      return NextResponse.json({
        status: "FAILED",
        reason: error.providerUnavailable ? "verify_unavailable" : "no_transaction",
        referenceId: payment.application.referenceId,
        merchantReference,
      }, { status: error.providerUnavailable ? 502 : 404 });
    }
    // Transient — return 502 so client retries.
    return NextResponse.json({ status: "FAILED", reason: "verify_unavailable" }, { status: 502 });
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
    return NextResponse.json({ status: "UNKNOWN", reason: "not_found" });
  }

  const response = NextResponse.json({
    status: applied.paymentStatus,
    referenceId: payment.application.referenceId,
    merchantReference,
    chapaReference:
      verification.chapaReference ?? payment.chapaReference ?? usedReference,
    mismatch: applied.mismatch ?? undefined,
  });

  // Clear the cookie once settled (success or terminal failure).
  if (applied.paymentStatus !== "PENDING") {
    response.cookies.set("na_pending_ref", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}