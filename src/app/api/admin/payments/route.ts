import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/http";
import {
  isChapaConfigured,
  verifyChapaTransaction,
  PaymentNotFoundError,
} from "@/lib/payments/chapa";
import { applyChapaPaymentResult, mapChapaStatus } from "@/lib/payments/apply";

// GET /api/admin/payments — list all payments with registration info
export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const skip = Math.max(0, parseInt(request.nextUrl.searchParams.get("skip") || "0", 10) || 0);
    const take = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get("take") || "100", 10) || 100));

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
            schedule: { select: { group: true, session: true, days: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error("Admin payments fetch error:", error);
    return NextResponse.json({ error: "Failed to load payments" }, { status: 500 });
  }
}

// POST /api/admin/payments — re-run server-side verification for a payment.
//
// This is not a manual override: it re-queries Chapa's verify endpoint using
// the stored tx_ref and applies the result through the same idempotent,
// amount-checked path as the webhook. Statuses can never be set by hand.
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { id } = body as { id?: unknown };
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

    if (payment.status === "SUCCESS") {
      return NextResponse.json({ success: true, changed: false, status: "SUCCESS" });
    }
    if (!payment.txRef) {
      return NextResponse.json({ error: "This payment has no Chapa transaction reference yet." }, { status: 400 });
    }
    if (!isChapaConfigured()) {
      return NextResponse.json({ error: "Chapa is not configured" }, { status: 503 });
    }

    try {
      const verification = await verifyChapaTransaction(payment.txRef);
      const result = await applyChapaPaymentResult(payment.id, {
        status: mapChapaStatus(verification.status),
        chapaReference: verification.chapaReference,
        txRef: verification.txRef || payment.txRef || undefined,
        amount: verification.amount,
        currency: verification.currency,
        method: verification.method,
        charge: verification.charge,
        raw: verification,
      });
      return NextResponse.json({ success: true, changed: result?.changed ?? false, status: result?.paymentStatus ?? payment.status });
    } catch (error) {
      if (error instanceof PaymentNotFoundError) {
        return NextResponse.json({ error: "Chapa has no transaction for this reference yet." }, { status: 404 });
      }
      throw error;
    }
  } catch (error) {
    console.error("Admin payment verify error:", error);
    return NextResponse.json({ error: "Failed to verify payment" }, { status: 500 });
  }
}
