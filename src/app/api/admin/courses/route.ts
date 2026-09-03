import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    const body = await request.json();
    const { title, description, price, discountPrice, discountLabel, active, sortOrder } = body;

    if (!title || !description || price === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const course = await prisma.course.create({
      data: {
        title,
        description,
        price: Number(price),
        discountPrice: discountPrice ? Number(discountPrice) : null,
        discountLabel: discountLabel || null,
        active: active ?? true,
        sortOrder: sortOrder || 0,
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
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    if (data.price !== undefined) data.price = Number(data.price);
    if (data.discountPrice !== undefined) data.discountPrice = data.discountPrice ? Number(data.discountPrice) : null;
    if (data.sortOrder !== undefined) data.sortOrder = Number(data.sortOrder);

    const course = await prisma.course.update({ where: { id }, data });
    return NextResponse.json(course);
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
    await prisma.course.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin course delete error:", error);
    return NextResponse.json({ error: "Failed to delete course" }, { status: 500 });
  }
}
