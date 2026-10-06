import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/admin/registrations — list student registrations.
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
          payments: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true, amount: true, currency: true },
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

    return NextResponse.json({ applications: registrations, statusCounts, totalCount });
  } catch (error) {
    console.error("Admin registrations fetch error:", error);
    return NextResponse.json({ error: "Failed to load registrations" }, { status: 500 });
  }
}
