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
    const merchantReference = reuseExisting ? (current.txRef as string) : generateTxRef(application.referenceId);

    const [firstName, ...lastNameParts] = application.fullName.trim().split(/\s+/).filter(Boolean);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
    const returnUrl = appUrl
      ? `${appUrl}/payment/return?referenceId=${encodeURIComponent(application.referenceId)}`
      : undefined;
    const hosted = await createChapaHostedPayment(
      {
        amount: payment.amount,
        currency: payment.currency,
        merchant_reference: merchantReference,
        customer: {
          first_name: firstName || "Customer",
          last_name: lastNameParts.join(" ") || "Student",
          email: application.email,
          phone_number: normalizePhoneForChapaV2(application.phone),
        },
        meta: { order_id: application.referenceId },
        ...(returnUrl ? { return_url: returnUrl } : {}),
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
          notes: null,
        },
      });
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "PENDING", txRef: merchantReference, chapaReference: null, notes: null },
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
      });
      return NextResponse.json(
        { error: error.message || "Failed to initialize Chapa payment" },
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

function isAllowedCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["checkout.chapa.co", "checkout.chapa.global"].includes(url.hostname);
  } catch {
    return false;
  }
}
