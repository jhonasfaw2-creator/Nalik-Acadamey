import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyChapaPaymentResult } from "@/lib/payments/apply";

// PUT /api/admin/registrations/[id] — update registration status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !["PENDING_PAYMENT", "PAID", "CONFIRMED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const application = await prisma.application.update({
      where: { id },
      data: { status },
      include: {
        course: { select: { title: true } },
        schedule: { select: { id: true, batchName: true } },
        payment: { select: { id: true, amount: true, currency: true, status: true, merchantReference: true } },
      },
    });

    // Marking a registration PAID manually should also settle the payment.
    if (status === "PAID" && application.payment && application.payment.status !== "SUCCESS") {
      await applyChapaPaymentResult(application.payment.id, {
        status: "SUCCESS",
        amount: application.payment.amount,
        currency: application.payment.currency,
      });
      application.payment.status = "SUCCESS";
    }

    return NextResponse.json(application);
  } catch (error) {
    console.error("Admin registration update error:", error);
    return NextResponse.json({ error: "Failed to update registration" }, { status: 500 });
  }
}