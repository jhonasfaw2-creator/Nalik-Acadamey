import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/courses — public, active courses only
export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        discountPrice: true,
        discountLabel: true,
        sortOrder: true,
      },
    });

    return NextResponse.json(courses);
  } catch (error) {
    console.error("Courses fetch error:", error);
    return NextResponse.json({ error: "Failed to load courses" }, { status: 500 });
  }
}
