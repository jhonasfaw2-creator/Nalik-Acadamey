import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyChapaPaymentResult } from "@/lib/payments/apply";

// GET /api/admin/payments — list all payments with registration info
export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const payments = await prisma.payment.findMany({
      where,
      include: {
        application: {
          select: {
            id: true,
            referenceId: true,
            fullName: true,
            email: true,
            phone: true,
            courseId: true,
            scheduleId: true,
            status: true,
            course: { select: { title: true } },
            schedule: { select: { batchName: true, days: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error("Admin payments fetch error:", error);
    return NextResponse.json({ error: "Failed to load payments" }, { status: 500 });
  }
}

// PUT /api/admin/payments — update payment status (manual override)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, notes } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const VALID_STATUSES = ["PENDING", "SUCCESS", "FAILED", "CANCELLED", "INCOMPLETE"];
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid payment status" }, { status: 400 });
    }

    let payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

    if (notes !== undefined) {
      payment = await prisma.payment.update({
        where: { id },
        data: { notes },
        include: { application: { select: { referenceId: true, fullName: true, email: true } } },
      });
    }

    if (status) {
      const result = await applyChapaPaymentResult(payment.id, {
        status,
        amount: payment.amount,
        currency: payment.currency,
        chapaReference: typeof body.chapaReference === "string" ? body.chapaReference : payment.chapaReference || undefined,
        merchantReference: typeof body.merchantReference === "string" ? body.merchantReference : payment.merchantReference || undefined,
        method: typeof body.method === "string" ? body.method : payment.method || undefined,
      });
      payment = (await prisma.payment.findUnique({
        where: { id },
        include: { application: { select: { referenceId: true, fullName: true, email: true } } },
      }))!;
      if (!result) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Admin payment update error:", error);
    return NextResponse.json({ error: "Failed to update payment" }, { status: 500 });
  }
}