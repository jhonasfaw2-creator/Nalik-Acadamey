import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { derivePayment } from "@/lib/registration";

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
      ];
    }

    const skip = Math.max(0, parseInt(request.nextUrl.searchParams.get("skip") || "0", 10) || 0);
    const take = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get("take") || "100", 10) || 100));

    const [applications, counts] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          course: { select: { id: true, title: true, price: true, discountPrice: true } },
          schedule: {
            select: { id: true, group: true, session: true, days: true, startTime: true, endTime: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.application.groupBy({ by: ["status"], _count: true, where }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const c of counts) statusCounts[c.status] = c._count;

    // There is no Payment table any more, so the admin list keeps its existing
    // `payment` field by deriving it from the registration status.
    const withPayment = applications.map(({ course, paidAt, ...application }) => ({
      ...application,
      payment: derivePayment({
        registrationStatus: application.status,
        paidAt,
        course,
      }),
    }));

    return NextResponse.json({ applications: withPayment, statusCounts });
  } catch (error) {
    console.error("Admin registrations fetch error:", error);
    return NextResponse.json({ error: "Failed to load registrations" }, { status: 500 });
  }
}