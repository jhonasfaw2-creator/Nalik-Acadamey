import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const txRef = searchParams.get("tx_ref") || searchParams.get("merchant_reference");

  if (!txRef) {
    return NextResponse.json({ error: "Missing transaction reference" }, { status: 400 });
  }

  try {
    // 1. Query Chapa V2 Verification Endpoint using merchant_reference
    const chapaRes = await fetch(`https://api.chapa.global/v2/payments/${txRef}/verify`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
      },
      cache: "no-store",
    });

    const data = await chapaRes.json();

    if (!chapaRes.ok || data.status !== "success") {
      return NextResponse.json({ status: "PENDING", details: data }, { status: 200 });
    }

    const event = data.data;
    const status = (event.status || "").toUpperCase();
    const successful = status === "SUCCESS" || status === "PAID";

    if (successful) {
      const paidAt = new Date();
      const chapaReference = event.chapa_reference || event.reference;

      // 2. Persist database update to PAID upon successful return verification
      await prisma.$transaction(async (tx) => {
        const transaction = await tx.transaction.findUnique({
          where: { txRef },
          select: { id: true, registrationId: true },
        });

        if (transaction) {
          await tx.transaction.update({
            where: { id: transaction.id },
            data: {
              status: "SUCCESS",
              paidAt,
              ...(chapaReference ? { chapaReference } : {}),
            },
          });

          await tx.registration.updateMany({
            where: { id: transaction.registrationId, status: "PENDING" },
            data: { status: "PAID", paidAt },
          });
        }
      });

      return NextResponse.json({ status: "SUCCESS", data: event });
    }

    return NextResponse.json({ status: status || "PENDING" });
  } catch (error: any) {
    console.error("VERIFY ROUTE ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}