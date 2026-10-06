import { NextRequest, NextResponse } from "next/server";
import { isPrismaError, readJson } from "@/lib/http";
import { initializeHostedPayment } from "@/lib/payments/chapa";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const paymentId = (body as { paymentId?: unknown }).paymentId;
  if (typeof paymentId !== "string" || !paymentId) {
    return NextResponse.json({ error: "Payment ID is required" }, { status: 400 });
  }

  try {
    const checkoutUrl = await initializeHostedPayment(paymentId);
    const response = NextResponse.json({ success: true, checkoutUrl });
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
      const knownErrors: Record<string, { error: string; status: number }> = {
        PAYMENT_NOT_FOUND: { error: "Payment not found.", status: 404 },
        PAYMENT_NOT_PENDING: {
          error: "This payment is no longer awaiting checkout.",
          status: 409,
        },
        INVALID_CUSTOMER_PHONE: {
          error: "Enter an Ethiopian phone number in international format.",
          status: 400,
        },
        "CHAPA_SECRET_KEY is not configured": {
          error: "Online payment is not configured. Please contact the academy.",
          status: 503,
        },
        "CHAPA_SECRET_KEY must be a Chapa TEST-mode secret key": {
          error: "Online payments are restricted to Chapa TEST mode.",
          status: 503,
        },
      };
      const known = knownErrors[error.message];
      if (known) return NextResponse.json({ error: known.error }, { status: known.status });
    }
    if (isPrismaError(error, "P2025")) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }
    console.error("Payment initialization failed:", error);
    return NextResponse.json(
      { error: "We could not start checkout. Please try again." },
      { status: 502 },
    );
  }
}
