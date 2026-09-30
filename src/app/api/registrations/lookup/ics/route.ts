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
    const application = await prisma.application.findUnique({
      where: { referenceId: id },
      select: {
        referenceId: true,
        course: { select: { title: true } },
        schedule: { select: { days: true, startTime: true, endTime: true, startDate: true } },
      },
    });

    if (!application || !application.schedule) {
      return NextResponse.json({ error: "No schedule found for this registration ID" }, { status: 404 });
    }

    const ics = buildScheduleIcs({
      referenceId: application.referenceId,
      courseTitle: application.course?.title || "Class",
      days: application.schedule.days.split(",").map((d) => d.trim()).filter(Boolean),
      startTime: application.schedule.startTime,
      endTime: application.schedule.endTime,
      startDate: application.schedule.startDate ? application.schedule.startDate.toISOString() : null,
    });

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="nalik-schedule-${application.referenceId}.ics"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ICS generation error:", error);
    return NextResponse.json({ error: "Failed to generate calendar file" }, { status: 500 });
  }
}
