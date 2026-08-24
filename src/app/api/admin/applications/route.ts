import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search") || "";
    const status = request.nextUrl.searchParams.get("status") || "";

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { referenceId: { contains: search } },
        { courseSelection: { contains: search } },
      ];
    }

    const [applications, counts] = await Promise.all([
      prisma.application.findMany({
        where,
        orderBy: { createdAt: "desc" },
      }),
      prisma.application.groupBy({
        by: ["status"],
        _count: true,
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const c of counts) {
      statusCounts[c.status] = c._count;
    }

    return NextResponse.json({ applications, statusCounts });
  } catch (error) {
    console.error("Admin applications fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load applications" },
      { status: 500 }
    );
  }
}
