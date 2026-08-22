import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Revalidate every 60 seconds on Vercel (ISR)
export const revalidate = 60;

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

    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Portfolio fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load portfolio" },
      { status: 500 }
    );
  }
}
