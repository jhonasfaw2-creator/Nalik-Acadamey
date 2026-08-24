import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/admin/courses
export async function GET() {
  const courses = await prisma.course.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(courses);
}

// POST /api/admin/courses
export async function POST(request: NextRequest) {
  const body = await request.json();
  const course = await prisma.course.create({
    data: {
      title: body.title,
      description: body.description || "",
      price: body.price || "",
      discountPrice: body.discountPrice || null,
      discountLabel: body.discountLabel || null,
      videoUrl: body.videoUrl || null,
      posterUrl: body.posterUrl || null,
      sortOrder: body.sortOrder || 0,
      published: body.published ?? false,
    },
  });
  return NextResponse.json(course, { status: 201 });
}

// PUT /api/admin/courses  body: { id, ...fields }
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, ...data } = body;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const course = await prisma.course.update({ where: { id }, data });
  return NextResponse.json(course);
}

// DELETE /api/admin/courses?id=xxx
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  await prisma.course.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
