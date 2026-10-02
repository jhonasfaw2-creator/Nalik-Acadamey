import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ChapaHostedPaymentError,
  chapaV2SecretKey,
  createChapaHostedPayment,
  generateTxRef,
  normalizePhoneForChapaV2,
} from "@/lib/payments/chapa";
import { ensurePaymentForApplication } from "@/lib/payments/record";

export const dynamic = "force-dynamic";

// POST /api/payments/chapa/init — create a v2 hosted checkout session.
export async function POST(request: NextRequest) {
  let referenceId = "";
  try {
    const rawKey = process.env.CHAPA_SECRET_KEY;
    if (!rawKey) {
      console.error("[chapa-init] CHAPA_SECRET_KEY is missing from environment variables.");
      return NextResponse.json({ error: "Server misconfiguration: missing payment key" }, { status: 500 });
    }

    const secretKey = chapaV2SecretKey();
    if (!secretKey) {
      console.error("[chapa-init] CHAPA_SECRET_KEY is not a valid Chapa v2 server key.");
      return NextResponse.json(
        { error: "Server misconfiguration: CHAPA_SECRET_KEY must be a Chapa v2 key" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    referenceId = typeof body.referenceId === "string" ? body.referenceId.trim() : "";
    const rotate = body.rotate === true;
    if (!referenceId) {
      return NextResponse.json({ error: "Missing referenceId" }, { status: 400 });
    }

    const application = await prisma.application.findUnique({
      where: { referenceId },
      select: { id: true, referenceId: true, fullName: true, email: true, phone: true },
    });
    if (!application) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    const email = application.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error("[chapa-init] Registration has an invalid customer email", { referenceId });
      return NextResponse.json({ error: "A valid email address is required for payment." }, { status: 400 });
    }

    // Legacy registrations (pre-online-payments) have no Payment row — create
    // the missing PENDING payment on the spot so they become payable.
    const payment = await ensurePaymentForApplication(application.id);
    if (!payment) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }
    if (payment.status === "SUCCESS") {
      return NextResponse.json({ success: true, alreadyPaid: true, status: "SUCCESS" });
    }

    // Re-check right before writing so a webhook that settled the payment in
    // the meantime can never be downgraded back to PENDING.
    const current = await prisma.payment.findUnique({ where: { id: payment.id } });
    if (!current || current.status === "SUCCESS") {
      return NextResponse.json({ success: true, alreadyPaid: true, status: "SUCCESS" });
    }

    // V2 requires a unique merchant_reference for each payment attempt.
    const reuseExisting =
      !rotate && current.status === "PENDING" && !current.chapaReference && Boolean(current.txRef);
    const rawMerchantReference = reuseExisting ? (current.txRef as string) : generateTxRef(application.referenceId);
    const merchantReference = rawMerchantReference.replace(/[^A-Za-z0-9-]/g, "");
    if (!merchantReference) {
      console.error("[chapa-init] Could not create a valid merchant_reference", { referenceId });
      return NextResponse.json({ error: "Unable to create a valid payment reference." }, { status: 400 });
    }

    const rawAmount = String(payment.amount);
    const amount = Number(rawAmount.replace(/[\s,]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      console.error("[chapa-init] Registration has an invalid amount", { referenceId });
      return NextResponse.json({ error: "This registration has an invalid payment amount." }, { status: 400 });
    }

    const [firstName, ...lastNameParts] = application.fullName.trim().split(/\s+/).filter(Boolean);
    const appOrigin = getAppOrigin(request);
    if (!appOrigin) {
      console.error("[chapa-init] Could not determine an absolute return URL origin", { referenceId });
      return NextResponse.json({ error: "Payment return URL is not configured correctly." }, { status: 500 });
    }
    const returnUrl = new URL("/payment/return", appOrigin);
    returnUrl.searchParams.set("referenceId", application.referenceId);

    const hosted = await createChapaHostedPayment(
      {
        amount,
        currency: "ETB",
        merchant_reference: merchantReference,
        customer: {
          first_name: firstName || "Student",
          last_name: lastNameParts.join(" ") || "Applicant",
          email,
          phone_number: normalizePhoneForChapaV2(application.phone),
        },
        meta: { order_id: application.referenceId },
        return_url: returnUrl.toString(),
      },
      secretKey
    );

    if (!isAllowedCheckoutUrl(hosted.checkoutUrl)) {
      console.error("[chapa-init] Chapa returned a non-allowlisted checkout URL");
      return NextResponse.json({ error: "Chapa returned an invalid checkout URL." }, { status: 502 });
    }

    if (hosted.chapaReference) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "PENDING",
          txRef: merchantReference,
          chapaReference: hosted.chapaReference,
          currency: "ETB",
          notes: null,
        },
      });
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "PENDING", txRef: merchantReference, chapaReference: null, currency: "ETB", notes: null },
      });
    }

    return NextResponse.json({
      success: true,
      alreadyPaid: false,
      checkoutUrl: hosted.checkoutUrl,
      merchantReference,
      referenceId: application.referenceId,
    });
  } catch (error) {
    if (error instanceof ChapaHostedPaymentError) {
      console.error("[chapa-init] Chapa rejected hosted payment initialization:", {
        referenceId,
        httpStatus: error.status,
        providerCode: error.providerCode,
        message: error.message,
        response: error.details,
      });
      return NextResponse.json(
        {
          error: error.message || "Failed to initialize Chapa payment",
          details: error.details,
        },
        { status: 400 }
      );
    }

    console.error("[chapa-init] Unexpected payment initialization failure:", {
      referenceId: referenceId || undefined,
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: "Unable to start payment. Please try again." }, { status: 500 });
  }
}

function getAppOrigin(request: NextRequest): string | undefined {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/^['"]+|['"]+$/g, "");
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      console.error("[chapa-init] NEXT_PUBLIC_APP_URL is not an absolute URL");
      return undefined;
    }
  }

  const requestUrl = new URL(request.url);
  return requestUrl.protocol === "https:" || requestUrl.protocol === "http:"
    ? requestUrl.origin
    : undefined;
}

function isAllowedCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["checkout.chapa.co", "checkout.chapa.global"].includes(url.hostname);
  } catch {
    return false;
  }
}
