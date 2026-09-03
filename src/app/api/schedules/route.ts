import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/schedules — public, active schedules only
export async function GET() {
  try {
    const schedules = await prisma.schedule.findMany({
      where: { active: true, course: { active: true } },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            price: true,
            discountPrice: true,
            discountLabel: true,
          },
        },
      },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error("Schedules fetch error:", error);
    return NextResponse.json({ error: "Failed to load schedules" }, { status: 500 });
  }
}
