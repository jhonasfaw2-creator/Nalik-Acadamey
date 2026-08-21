import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api/auth-guard";

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() || "";
    const program = searchParams.get("program") || "";
    const status = searchParams.get("status") || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    if (program) {
      where.program = program;
    }

    if (status) {
      where.status = status;
    }

    const [applications, total, stats] = await Promise.all([
      prisma.application.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.application.count({ where }),
      prisma.application.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ]);

    const statusCounts = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    for (const group of stats) {
      statusCounts.total += group._count.id;
      if (group.status in statusCounts) {
        statusCounts[group.status as keyof typeof statusCounts] = group._count.id;
      }
    }

    return NextResponse.json({
      applications,
      total,
      page,
      limit,
      stats: statusCounts,
    });
  } catch (error) {
    console.error("Admin applications error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
