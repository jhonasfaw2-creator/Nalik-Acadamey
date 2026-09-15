import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type PublicCourse = {
  id: string;
  title: string;
  description: string;
  price: number;
  discountPrice: number | null;
  discountLabel: string | null;
  discountStartAt: Date | string | null;
  discountEndAt: Date | string | null;
  sortOrder: number;
};

type CourseRow = PublicCourse;

function isDiscountActive(course: Pick<CourseRow, "discountPrice" | "discountStartAt" | "discountEndAt">) {
  if (course.discountPrice === null || course.discountPrice === undefined) return false;
  const now = new Date();
  const start = course.discountStartAt ? new Date(course.discountStartAt) : null;
  const end = course.discountEndAt ? new Date(course.discountEndAt) : null;

  if (start && start > now) return false;
  if (end && end < now) return false;
  return true;
}

// GET /api/courses — public, active courses only
export async function GET() {
  try {
    const courses: CourseRow[] = await prisma.course.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        discountPrice: true,
        discountLabel: true,
        discountStartAt: true,
        discountEndAt: true,
        sortOrder: true,
      },
    });

    const publicCourses: PublicCourse[] = courses.map((course: CourseRow) => {
      const discountActive = isDiscountActive(course);
      return {
        ...course,
        discountPrice: discountActive ? course.discountPrice : null,
        discountLabel: discountActive ? course.discountLabel : null,
      };
    });

    return NextResponse.json(publicCourses);
  } catch (error) {
    console.error("Courses fetch error:", error);
    return NextResponse.json({ error: "Failed to load courses" }, { status: 500 });
  }
}
