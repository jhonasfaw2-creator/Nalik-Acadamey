import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
            status: true,
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

// PUT /api/admin/payments — update payment status
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, transactionRef, notes } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (transactionRef !== undefined) updateData.transactionRef = transactionRef;
    if (notes !== undefined) updateData.notes = notes;
    if (status === "confirmed") updateData.confirmedAt = new Date();

    const payment = await prisma.payment.update({
      where: { id },
      data: updateData,
      include: {
        application: {
          select: { referenceId: true, fullName: true, email: true },
        },
      },
    });

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Admin payment update error:", error);
    return NextResponse.json({ error: "Failed to update payment" }, { status: 500 });
  }
}
