import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAndIncrement } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkAndIncrement(`course-materials:${ip}`, 30, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { id } = await params;
  const courseId = id;

  try {
    const searchParams = request.nextUrl.searchParams;
    const registrationId = searchParams.get("registrationId")?.trim().toUpperCase();

    if (!registrationId) {
      return NextResponse.json(
        { error: "Registration ID is required to access course materials." },
        { status: 400 }
      );
    }

    if (!/^NA-\d{4}-[A-Z2-9]{6}$/.test(registrationId)) {
      return NextResponse.json({ error: "Invalid registration ID" }, { status: 404 });
    }

    const application = await prisma.application.findUnique({
      where: { referenceId: registrationId },
      select: {
        courseId: true,
        status: true,
      },
    });

    if (!application) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    if (application.courseId !== courseId) {
      return NextResponse.json(
        { error: "This registration is not for the requested course." },
        { status: 403 }
      );
    }

    const isConfirmed =
      application.status === "PAID" || application.status === "CONFIRMED";

    if (!isConfirmed) {
      return NextResponse.json(
        { error: "Course materials are only available for paid registrations." },
        { status: 409 }
      );
    }

    const materials = await prisma.courseMaterial.findMany({
      where: { courseId },
      select: { id: true, title: true, fileUrl: true, fileType: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ materials });
  } catch (error) {
    console.error("Course materials fetch error:", error);
    return NextResponse.json({ error: "Failed to load course materials" }, { status: 500 });
  }
}