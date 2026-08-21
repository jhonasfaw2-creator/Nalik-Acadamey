import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const items = await prisma.ourWork.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        videoSrc: true,
        posterImage: true,
      },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Portfolio fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load portfolio" },
      { status: 500 }
    );
  }
}
