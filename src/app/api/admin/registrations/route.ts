import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/admin/registrations — list all registrations
export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search") || "";
    const status = request.nextUrl.searchParams.get("status") || "";
    const courseId = request.nextUrl.searchParams.get("courseId") || "";

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (courseId) where.courseId = courseId;

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { referenceId: { contains: search } },
        { payment: { is: { merchantReference: { contains: search } } } },
      ];
    }

    const [applications, counts] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          course: { select: { id: true, title: true } },
          schedule: {
            select: { id: true, batchName: true, days: true, startTime: true, endTime: true },
          },
          payment: {
            select: {
              amount: true,
              currency: true,
              status: true,
              method: true,
              merchantReference: true,
              chapaReference: true,
              paidAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.application.groupBy({ by: ["status"], _count: true }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const c of counts) statusCounts[c.status] = c._count;

    return NextResponse.json({ applications, statusCounts });
  } catch (error) {
    console.error("Admin registrations fetch error:", error);
    return NextResponse.json({ error: "Failed to load registrations" }, { status: 500 });
  }
}