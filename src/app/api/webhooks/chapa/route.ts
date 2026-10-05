import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    // 1. Direct Secret Verification (Secret-with-Secret)
    const chapaSignature =
      req.headers.get("x-chapa-signature") ||
      req.headers.get("chapa-signature");
    
    const configuredSecret =
      process.env.CHAPA_WEBHOOK_SECRET || process.env.CHAPA_SECRET_KEY;

    if (!chapaSignature || chapaSignature !== configuredSecret) {
      console.error("[Chapa V2 Webhook] Signature mismatch or unauthenticated call");
      return NextResponse.json({ error: "Unauthorized signature" }, { status: 401 });
    }

    // 2. Parse payload
    const body = await req.json();
    const { tx_ref, status, reference, payment_method } = body;

    console.log(`[Chapa V2 Webhook] Validated event for tx_ref: ${tx_ref}, status: ${status}`);

    if (status === "success" || status === "COMPLETED") {
      const transaction = await prisma.transaction.findUnique({
        where: { txRef: tx_ref },
        include: { registration: true },
      });

      if (!transaction) {
        console.error(`[Chapa V2 Webhook] Transaction missing: ${tx_ref}`);
        return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
      }

      const now = new Date();

      // Atomic DB update
      await prisma.$transaction([
        prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "SUCCESS",
            chapaReference: reference || null,
            paymentMethod: payment_method || null,
            rawWebhook: body,
            paidAt: now,
          },
        }),
        prisma.registration.update({
          where: { id: transaction.registrationId },
          data: {
            status: "PAID",
            paidAt: now,
          },
        }),
      ]);

      if (transaction.registration.scheduleId) {
        await prisma.schedule.update({
          where: { id: transaction.registration.scheduleId },
          data: { enrolled: { increment: 1 } },
        });
      }

      console.log(`[Chapa V2 Webhook] Registration ${transaction.registrationId} confirmed PAID`);
    }

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (error: any) {
    console.error("[Chapa V2 Webhook Error]:", error);
    return NextResponse.json({ error: error.message || "Webhook processing failed" }, { status: 500 });
  }
}