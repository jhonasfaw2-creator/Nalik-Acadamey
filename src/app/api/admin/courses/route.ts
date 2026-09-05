import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson, isNotFoundError } from "@/lib/http";
import { courseSchema } from "@/lib/validators";

// GET /api/admin/courses — list all courses
export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { schedules: true } } },
    });
    return NextResponse.json(courses);
  } catch (error) {
    console.error("Admin courses fetch error:", error);
    return NextResponse.json({ error: "Failed to load courses" }, { status: 500 });
  }
}

// POST /api/admin/courses — create course
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = courseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid course data" },
        { status: 400 }
      );
    }
    const { title, description, price, discountPrice, discountLabel, active, sortOrder } = parsed.data;

    const course = await prisma.course.create({
      data: {
        title,
        description,
        price,
        discountPrice: discountPrice ?? null,
        discountLabel: discountLabel || null,
        active: active ?? true,
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    console.error("Admin course create error:", error);
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
}

// PUT /api/admin/courses — update course
export async function PUT(request: NextRequest) {
  try {
    const body = await readJson(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { id, ...data } = body as Record<string, unknown>;
    if (typeof id !== "string" || !id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Validate + strip unknown keys. The admin UI sends the full course row
    // back (including _count), which Prisma would otherwise reject as an
    // unknown argument and turn into a 500 — edit was broken.
    const parsed = courseSchema.partial().safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid course data" },
        { status: 400 }
      );
    }

    try {
      const course = await prisma.course.update({ where: { id }, data: parsed.data });
      return NextResponse.json(course);
    } catch (error) {
      if (isNotFoundError(error)) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
      }
      throw error;
    }
  } catch (error) {
    console.error("Admin course update error:", error);
    return NextResponse.json({ error: "Failed to update course" }, { status: 500 });
  }
}

// DELETE /api/admin/courses?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    try {
      await prisma.course.delete({ where: { id } });
    } catch (error) {
      if (isNotFoundError(error)) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
      }
      throw error;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin course delete error:", error);
    return NextResponse.json({ error: "Failed to delete course" }, { status: 500 });
  }
}