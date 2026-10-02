import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  chapaV2SecretKey,
  createChapaHostedPayment,
  generateTxRef,
  normalizePhoneForChapaV2,
} from "@/lib/payments/chapa";
import { ensurePaymentForApplication } from "@/lib/payments/record";

export const dynamic = "force-dynamic";

// POST /api/payments/chapa/init — create a v2 hosted checkout session.
export async function POST(request: NextRequest) {
  try {
    const secretKey = chapaV2SecretKey();
    if (!secretKey) {
      return NextResponse.json(
        { error: "Online payments are not configured. Please try again later." },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const referenceId = typeof body.referenceId === "string" ? body.referenceId.trim() : "";
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

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "PENDING", txRef: merchantReference, chapaReference: null, notes: null },
    });

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
        data: { chapaReference: hosted.chapaReference },
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
    console.error("Chapa init error:", error);
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
