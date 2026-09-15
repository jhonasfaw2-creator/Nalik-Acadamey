import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_SETTINGS = new Set([
  "academy_name",
  "academy_email",
  "academy_phone",
  "academy_address",
]);

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
    const { data } = body as { data?: Record<string, unknown> };

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return NextResponse.json({ error: "data required" }, { status: 400 });
    }

    const entries = Object.entries(data).filter(([key]) => ALLOWED_SETTINGS.has(key));
    const forbidden = Object.keys(data).find((key) => !ALLOWED_SETTINGS.has(key));
    if (forbidden) {
      return NextResponse.json({ error: `Setting not allowed: ${forbidden}` }, { status: 400 });
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: "No valid settings provided" }, { status: 400 });
    }

    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value: String(value ?? "") },
          create: { key, value: String(value ?? "") },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin settings save error:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
