import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPayment } from "@/lib/payments/chapa";
import { applyPaymentResult } from "@/lib/payments/apply";

export const dynamic = "force-dynamic";

// GET /api/payments/status — called by /payment/complete to check payment
// status using the na_pending_ref cookie set at init time.
//
// This is the fallback path when Chapa's redirect URL carries no query params.
// It reads the merchant reference from the httpOnly cookie, verifies with
// Chapa server-to-server, and settles the payment if confirmed.

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
    });
  }

  // Verify with Chapa server-to-server.
  const verifyRef = payment.chapaReference || merchantReference;
  let verification;
  try {
    verification = await verifyPayment(verifyRef);
  } catch {
    // Transient — keep polling.
    return NextResponse.json({ status: "PENDING", reason: "verify_unavailable" });
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
