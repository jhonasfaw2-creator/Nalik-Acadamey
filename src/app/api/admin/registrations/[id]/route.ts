import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson, isNotFoundError } from "@/lib/http";
import { applyChapaPaymentResult } from "@/lib/payments/apply";

// PUT /api/admin/registrations/[id] — update registration status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await readJson(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { status } = body as { status?: unknown };

    if (typeof status !== "string" || !["PENDING_PAYMENT", "PAID", "CONFIRMED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    let application;
    try {
      application = await prisma.application.update({
        where: { id },
        data: { status },
        include: {
          course: { select: { title: true } },
          schedule: { select: { id: true, batchName: true } },
          payment: { select: { id: true, amount: true, currency: true, status: true, merchantReference: true } },
        },
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        return NextResponse.json({ error: "Registration not found" }, { status: 404 });
      }
      throw error;
    }

    // Marking a registration PAID manually should also settle the payment.
    // applyChapaPaymentResult is idempotent and internally transactional, so
    // calling it here is safe even if a concurrent webhook already settled
    // the same payment.
    if (status === "PAID" && application.payment && application.payment.status !== "SUCCESS") {
      const result = await applyChapaPaymentResult(application.payment.id, {
        status: "SUCCESS",
        amount: application.payment.amount,
        currency: application.payment.currency,
      });

      // If the payment was just settled, refresh the application to reflect
      // the new payment status in the response.
      if (result?.changed) {
        application = await prisma.application.findUnique({
          where: { id: application.id },
          include: {
            course: { select: { title: true } },
            schedule: { select: { id: true, batchName: true } },
            payment: { select: { id: true, amount: true, currency: true, status: true, merchantReference: true } },
          },
        });
      }
    }

    return NextResponse.json(application);
  } catch (error) {
    console.error("Admin registration update error:", error);
    return NextResponse.json({ error: "Failed to update registration" }, { status: 500 });
  }
}