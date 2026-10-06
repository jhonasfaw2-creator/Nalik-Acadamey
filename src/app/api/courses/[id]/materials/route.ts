import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAndIncrement } from "@/lib/rateLimit";
import { verifyDownloadToken } from "@/lib/downloadToken";

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
    const token = searchParams.get("token")?.trim() ?? "";
    const registrationId = token ? verifyDownloadToken(token) : null;

    if (!registrationId) {
      return NextResponse.json(
        { error: "A valid download entitlement is required." },
        { status: 403 }
      );
    }

    const registration = await prisma.registration.findUnique({
      where: { referenceId: registrationId },
      select: {
        courseId: true,
        status: true,
      },
    });

    if (!registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    if (registration.courseId !== courseId) {
      return NextResponse.json(
        { error: "This registration is not for the requested course." },
        { status: 403 }
      );
    }

    const isConfirmed =
      registration.status === "PAID" || registration.status === "CONFIRMED";

    if (!isConfirmed) {
      return NextResponse.json(
        { error: "Course materials are only available for enrolled registrations." },
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