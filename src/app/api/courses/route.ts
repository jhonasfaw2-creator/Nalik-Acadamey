import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/courses — public, only published courses
export async function GET() {
  const courses = await prisma.course.findMany({
    where: { published: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(courses);
}
