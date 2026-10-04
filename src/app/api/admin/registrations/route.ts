import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/admin/registrations — list registrations with their latest payment attempt.
export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const status = request.nextUrl.searchParams.get("status") ?? "";
    const courseId = request.nextUrl.searchParams.get("courseId") ?? "";
    const skip = Math.max(0, Number.parseInt(request.nextUrl.searchParams.get("skip") || "0", 10) || 0);
    const take = Math.min(100, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("take") || "100", 10) || 100));

    const baseWhere: Prisma.RegistrationWhereInput = {};
    if (courseId) baseWhere.courseId = courseId;
    if (search) {
      baseWhere.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { referenceId: { contains: search, mode: "insensitive" } },
        { transactions: { some: { txRef: { contains: search, mode: "insensitive" } } } },
      ];
    }
    const where: Prisma.RegistrationWhereInput = {
      ...baseWhere,
      ...(status ? { status } : {}),
    };

    const [registrations, counts, totalCount] = await Promise.all([
      prisma.registration.findMany({
        where,
        include: {
          course: { select: { id: true, title: true } },
          schedule: {
            select: { id: true, group: true, session: true, days: true, startTime: true, endTime: true },
          },
          transactions: {
            orderBy: { createdAt: "desc" },
            select: {
              amount: true,
              currency: true,
              txRef: true,
              status: true,
              paidAt: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.registration.groupBy({
        by: ["status"],
        _count: true,
        where: baseWhere,
      }),
      prisma.registration.count({ where }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const count of counts) statusCounts[count.status] = count._count;

    const applications = registrations.map(({ transactions, ...registration }) => {
      const successfulTransaction = transactions.find((transaction) => transaction.status === "SUCCESS") ?? null;
      const latestTransaction = successfulTransaction ?? transactions[0] ?? null;
      const paid = registration.status === "PAID" || registration.status === "CONFIRMED";
      return {
        ...registration,
        txRef: latestTransaction?.txRef ?? null,
        payment: successfulTransaction
          ? {
              amount: successfulTransaction.amount,
              currency: successfulTransaction.currency,
              status: "SUCCESS",
              paidAt: successfulTransaction.paidAt?.toISOString() ?? null,
            }
          : {
              amount: null,
              currency: "ETB",
              status: paid ? "SUCCESS" : latestTransaction?.status ?? "PENDING",
              paidAt: registration.paidAt?.toISOString() ?? null,
            },
      };
    });

    return NextResponse.json({ applications, statusCounts, totalCount });
  } catch (error) {
    console.error("Admin registrations fetch error:", error);
    return NextResponse.json({ error: "Failed to load registrations" }, { status: 500 });
  }
}
