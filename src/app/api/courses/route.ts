import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/courses — public, active courses only
export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: {
        schedules: {
          where: { active: true },
          orderBy: { startDate: "asc" },
        },
      },
    });

    return NextResponse.json(courses);
  } catch (error) {
    console.error("Courses fetch error:", error);
    return NextResponse.json({ error: "Failed to load courses" }, { status: 500 });
  }
}
