import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── GET: Public content endpoint ──────────────
export async function GET() {
  try {
    const contentRows = await prisma.websiteContent.findMany();

    // Convert content to key-value, parsing JSON strings
    const content: Record<string, Record<string, string>> = {};
    for (const row of contentRows) {
      try {
        content[row.key] = JSON.parse(row.value);
      } catch {
        // If parsing fails, store as empty object
        content[row.key] = {};
      }
    }

    return NextResponse.json({
      content,
      programs: [],
    });
  } catch (error) {
    console.error("Public content error:", error);
    return NextResponse.json(
      { error: "Failed to load content" },
      { status: 500 }
    );
  }
}
