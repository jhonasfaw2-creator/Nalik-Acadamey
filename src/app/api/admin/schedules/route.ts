import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson, isNotFoundError } from "@/lib/http";
import { scheduleSchema } from "@/lib/validators";

// Sessions are fixed per group; days are derived from the group.
const DAYS_BY_GROUP: Record<string, string> = {
  A: "Monday, Wednesday, Friday",
  B: "Tuesday, Thursday, Saturday",
};

// GET /api/admin/schedules — list all schedule sessions with live availability
export async function GET(request: NextRequest) {
  try {
    const group = request.nextUrl.searchParams.get("group");
    const where: Record<string, unknown> = {};
    if (group) where.group = group;

    const schedules = await prisma.schedule.findMany({
      where,
      orderBy: [{ group: "asc" }, { startTime: "asc" }],
    });
    type ScheduleRow = (typeof schedules)[number];

    return NextResponse.json(
      schedules.map((s: ScheduleRow) => ({
        ...s,
        days: DAYS_BY_GROUP[s.group] || s.days,
        seatsAvailable: Math.max(0, s.maxSeats - s.enrolled),
        isFull: s.enrolled >= s.maxSeats,
      }))
    );
  } catch (error) {
    console.error("Admin schedules fetch error:", error);
    return NextResponse.json({ error: "Failed to load schedules" }, { status: 500 });
  }
}

// POST /api/admin/schedules — create a schedule session
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Strips unknown keys (e.g. `enrolled` from the admin UI) and rejects
    // invalid times/seat counts with a clean 400.
    const parsed = scheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid schedule data" },
        { status: 400 }
      );
    }

    const days = DAYS_BY_GROUP[parsed.data.group] || parsed.data.group;

    const schedule = await prisma.schedule.create({
      data: {
        group: parsed.data.group,
        session: parsed.data.session,
        days,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        maxSeats: parsed.data.maxSeats,
        active: parsed.data.active,
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "A session with this name already exists in this schedule group." },
        { status: 409 }
      );
    }
    console.error("Admin schedule create error:", error);
    return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 });
  }
}

// PUT /api/admin/schedules — update a schedule session
export async function PUT(request: NextRequest) {
  try {
    const body = await readJson(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { id, ...data } = body as Record<string, unknown>;
    if (typeof id !== "string" || !id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const parsed = scheduleSchema.partial().safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid schedule data" },
        { status: 400 }
      );
    }

    // Rebuild only the editable fields (schema already stripped `enrolled`).
    const updateData: {
      group?: string;
      session?: string;
      days?: string;
      startTime?: string;
      endTime?: string;
      maxSeats?: number;
      active?: boolean;
    } = {};
    if (parsed.data.group !== undefined) {
      updateData.group = parsed.data.group;
      updateData.days = DAYS_BY_GROUP[parsed.data.group] || parsed.data.group;
    }
    if (parsed.data.session !== undefined) updateData.session = parsed.data.session;
    if (parsed.data.startTime !== undefined) updateData.startTime = parsed.data.startTime;
    if (parsed.data.endTime !== undefined) updateData.endTime = parsed.data.endTime;
    if (parsed.data.maxSeats !== undefined) updateData.maxSeats = parsed.data.maxSeats;
    if (parsed.data.active !== undefined) updateData.active = parsed.data.active;

    try {
      const schedule = await prisma.schedule.update({
        where: { id },
        data: updateData,
      });
      return NextResponse.json(schedule);
    } catch (error) {
      if (isNotFoundError(error)) {
        return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
      }
      throw error;
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "A session with this name already exists in this schedule group." },
        { status: 409 }
      );
    }
    console.error("Admin schedule update error:", error);
    return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 });
  }
}

// DELETE /api/admin/schedules?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    try {
      await prisma.schedule.delete({ where: { id } });
    } catch (error) {
      if (isNotFoundError(error)) {
        return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
      }
      // Foreign key constraint: the schedule has dependent registrations
      // that must be removed or reassigned first.
      console.error("Admin schedule delete error:", error);
      return NextResponse.json(
        { error: "Cannot delete this session because it has registrations. Remove or reassign them first." },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin schedule delete error:", error);
    return NextResponse.json({ error: "Failed to delete schedule" }, { status: 500 });
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
