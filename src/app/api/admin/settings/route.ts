import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/admin/settings
export async function GET() {
  try {
    const settings = await prisma.setting.findMany({
      select: { key: true, value: true },
    });
    const data: Record<string, string> = {};
    for (const s of settings) data[s.key] = s.value;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Admin settings fetch error:", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

// PUT /api/admin/settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { data } = body as { data: Record<string, string> };

    if (!data) return NextResponse.json({ error: "data required" }, { status: 400 });

    await prisma.$transaction(
      Object.entries(data).map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin settings save error:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
