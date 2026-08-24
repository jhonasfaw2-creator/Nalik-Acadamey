import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/admin/projects
export async function GET() {
  const projects = await prisma.project.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(projects);
}

// POST /api/admin/projects
export async function POST(request: NextRequest) {
  const body = await request.json();
  const project = await prisma.project.create({
    data: {
      title: body.title,
      description: body.description || "",
      videoUrl: body.videoUrl || null,
      posterUrl: body.posterUrl || null,
      category: body.category || null,
      sortOrder: body.sortOrder || 0,
      published: body.published ?? false,
    },
  });
  return NextResponse.json(project, { status: 201 });
}

// PUT /api/admin/projects  body: { id, ...fields }
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, ...data } = body;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const project = await prisma.project.update({ where: { id }, data });
  return NextResponse.json(project);
}

// DELETE /api/admin/projects?id=xxx
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
