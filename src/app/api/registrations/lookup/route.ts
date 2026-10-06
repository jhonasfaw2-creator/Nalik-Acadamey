import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAndIncrement } from "@/lib/rateLimit";
import { createDownloadToken } from "@/lib/downloadToken";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkAndIncrement(`lookup:${ip}`, 20, 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  const id = (request.nextUrl.searchParams.get("id") || "").trim().toUpperCase();
  if (!id) {
    return NextResponse.json({ error: "Registration ID is required" }, { status: 400 });
  }

  if (!/^NA-\d{4}-[A-Z2-9]{6}$/.test(id)) {
    return NextResponse.json({ found: false, error: "That registration ID doesn't look right. Check it and try again (format: NA-YYYY-XXXXXX)." }, { status: 404 });
  }

  try {
    const registration = await prisma.registration.findUnique({
      where: { referenceId: id },
      select: {
        referenceId: true,
        fullName: true,
        status: true,
        course: {
          select: {
            id: true,
            title: true,
          },
        },
        schedule: {
          select: { group: true, session: true, days: true, startTime: true, endTime: true, startDate: true },
        },
      },
    });

    if (!registration) {
      return NextResponse.json(
        { found: false, error: "We couldn't find a registration with that ID. Double-check it, or contact us if you think this is a mistake." },
        { status: 404 }
      );
    }

    const enrolled =
      registration.status === "PAID" || registration.status === "CONFIRMED";

    return NextResponse.json({
      found: true,
      registration: {
        referenceId: registration.referenceId,
        fullName: registration.fullName,
        course: registration.course?.title || null,
        courseId: registration.course?.id || null,
        ...(enrolled ? { downloadToken: createDownloadToken(registration.referenceId) } : {}),
        schedule: registration.schedule
          ? {
              days: registration.schedule.days,
              session: registration.schedule.session,
              group: registration.schedule.group,
              startTime: registration.schedule.startTime,
              endTime: registration.schedule.endTime,
              startDate: registration.schedule.startDate
                ? registration.schedule.startDate.toISOString()
                : null,
            }
          : null,
        registrationStatus: registration.status,
      },
    });
  } catch (error) {
    console.error("Registration lookup error:", error);
    return NextResponse.json({ error: "Failed to look up registration" }, { status: 500 });
  }
}