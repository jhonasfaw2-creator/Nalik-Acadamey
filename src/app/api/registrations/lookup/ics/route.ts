import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAndIncrement } from "@/lib/rateLimit";
import { buildScheduleIcs } from "@/lib/calendar";

export const dynamic = "force-dynamic";

// GET /api/registrations/lookup/ics?id=NA-2026-XXXXXX — download the class
// schedule as a calendar event (.ics). Same security model as the lookup
// route: the unguessable reference ID is the capability, rate-limited, and
// the payload contains only schedule data.
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkAndIncrement(`lookup:${ip}`, 20, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const id = (request.nextUrl.searchParams.get("id") || "").trim().toUpperCase();
  if (!/^NA-\d{4}-[A-Z2-9]{6}$/.test(id)) {
    return NextResponse.json({ error: "Invalid registration ID" }, { status: 404 });
  }

  try {
    const registration = await prisma.registration.findUnique({
      where: { referenceId: id },
      select: {
        referenceId: true,
        course: { select: { title: true } },
        schedule: { select: { days: true, startTime: true, endTime: true, startDate: true } },
      },
    });

    if (!registration || !registration.schedule) {
      return NextResponse.json({ error: "No schedule found for this registration ID" }, { status: 404 });
    }

    const ics = buildScheduleIcs({
      referenceId: registration.referenceId,
      courseTitle: registration.course?.title || "Class",
      days: registration.schedule.days.split(",").map((day: string) => day.trim()).filter(Boolean),
      startTime: registration.schedule.startTime,
      endTime: registration.schedule.endTime,
      startDate: registration.schedule.startDate ? registration.schedule.startDate.toISOString() : null,
    });

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="nalik-schedule-${registration.referenceId}.ics"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ICS generation error:", error);
    return NextResponse.json({ error: "Failed to generate calendar file" }, { status: 500 });
  }
}
