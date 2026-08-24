import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const section = request.nextUrl.searchParams.get("section");
    if (!section) {
      return NextResponse.json({ error: "section param required" }, { status: 400 });
    }

    const items = await prisma.content.findMany({
      where: { section },
      orderBy: { key: "asc" },
    });

    const data: Record<string, string> = {};
    for (const item of items) {
      data[item.key] = item.value;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Admin content fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load content" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { section, data } = body as { section: string; data: Record<string, string> };

    if (!section || !data) {
      return NextResponse.json({ error: "section and data required" }, { status: 400 });
    }

    await prisma.$transaction(
      Object.entries(data).map(([key, value]) =>
        prisma.content.upsert({
          where: { section_key: { section, key } },
          update: { value },
          create: { section, key, value },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin content save error:", error);
    return NextResponse.json(
      { error: "Failed to save content" },
      { status: 500 }
    );
  }
}
