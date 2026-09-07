import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/schedules — public, active schedule groups + sessions.
// Returns the two fixed groups (A and B), each with its three sessions,
// including live availability so the site can show "N Seats Available"
// or "FULL" without extra requests.
export async function GET() {
  try {
    const schedules = await prisma.schedule.findMany({
      where: { active: true },
      orderBy: [{ group: "asc" }, { startTime: "asc" }],
    });
    type ScheduleRow = (typeof schedules)[number];

    const groups = ["A", "B"].map((group) => {
      const sessions = schedules
        .filter((s: ScheduleRow) => s.group === group)
        .map((s: ScheduleRow) => ({
          id: s.id,
          session: s.session,
          startTime: s.startTime,
          endTime: s.endTime,
          maxSeats: s.maxSeats,
          enrolled: s.enrolled,
          seatsAvailable: Math.max(0, s.maxSeats - s.enrolled),
          isFull: s.enrolled >= s.maxSeats,
        }));

      return {
        group,
        days:
          group === "A"
            ? "Monday, Wednesday, Friday"
            : "Tuesday, Thursday, Saturday",
        sessions,
        isFull: sessions.length > 0 && sessions.every((s: { isFull: boolean }) => s.isFull),
      };
    });

    return NextResponse.json({ groups });
  } catch (error) {
    console.error("Schedules fetch error:", error);
    return NextResponse.json({ error: "Failed to load schedules" }, { status: 500 });
  }
}
