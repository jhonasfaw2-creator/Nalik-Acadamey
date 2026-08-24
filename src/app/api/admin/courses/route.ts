import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const courses = await prisma.course.findMany({ orderBy: { sortOrder: "asc" } });
    return NextResponse.json(courses);
  } catch (error) {
    console.error("Admin courses fetch error:", error);
    return NextResponse.json({ error: "Failed to load courses" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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
  } catch (error) {
    console.error("Admin course create error:", error);
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const course = await prisma.course.update({ where: { id }, data });
    return NextResponse.json(course);
  } catch (error) {
    console.error("Admin course update error:", error);
    return NextResponse.json({ error: "Failed to update course" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await prisma.course.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin course delete error:", error);
    return NextResponse.json({ error: "Failed to delete course" }, { status: 500 });
  }
}
