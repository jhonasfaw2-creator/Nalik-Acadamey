import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/content?section=hero
export async function GET(request: NextRequest) {
  const section = request.nextUrl.searchParams.get("section");
  if (!section) {
    return NextResponse.json({ error: "section param required" }, { status: 400 });
  }

  try {
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
  } catch (error) {
    console.error("Content fetch error:", error);
    return NextResponse.json({ error: "Failed to load content" }, { status: 500 });
  }
}
