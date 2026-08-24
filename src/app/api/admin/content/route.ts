import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/admin/content?section=hero
export async function GET(request: NextRequest) {
  const section = request.nextUrl.searchParams.get("section");
  if (!section) {
    return NextResponse.json({ error: "section param required" }, { status: 400 });
  }

  const items = await prisma.content.findMany({
    where: { section },
    orderBy: { key: "asc" },
  });

  // Return as a flat object { key: value }
  const data: Record<string, string> = {};
  for (const item of items) {
    data[item.key] = item.value;
  }

  return NextResponse.json(data);
}

// PUT /api/admin/content  body: { section, data: { key: value, ... } }
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { section, data } = body as { section: string; data: Record<string, string> };

  if (!section || !data) {
    return NextResponse.json({ error: "section and data required" }, { status: 400 });
  }

  for (const [key, value] of Object.entries(data)) {
    await prisma.content.upsert({
      where: { section_key: { section, key } },
      update: { value },
      create: { section, key, value },
    });
  }

  return NextResponse.json({ success: true });
}
