import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/projects — public, only published projects
export async function GET() {
  const projects = await prisma.project.findMany({
    where: { published: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(projects);
}
