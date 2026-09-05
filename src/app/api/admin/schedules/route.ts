import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson, isNotFoundError } from "@/lib/http";
import { scheduleSchema } from "@/lib/validators";

// GET /api/admin/schedules — list all schedules with course info
export async function GET(request: NextRequest) {
  try {
    const courseId = request.nextUrl.searchParams.get("courseId");
    const where: Record<string, unknown> = {};
    if (courseId) where.courseId = courseId;

    const schedules = await prisma.schedule.findMany({
      where,
      include: { course: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error("Admin schedules fetch error:", error);
    return NextResponse.json({ error: "Failed to load schedules" }, { status: 500 });
  }
}

// POST /api/admin/schedules — create a schedule
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Strips unknown keys (e.g. `enrolled` / nested `course` from the admin UI)
    // and rejects invalid dates, times, and seat counts with a clean 400.
    const parsed = scheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid schedule data" },
        { status: 400 }
      );
    }

    const schedule = await prisma.schedule.create({
      data: {
        courseId: parsed.data.courseId,
        batchName: parsed.data.batchName,
        days: parsed.data.days,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        startDate: new Date(parsed.data.startDate),
        maxSeats: parsed.data.maxSeats,
        active: parsed.data.active,
      },
      include: { course: { select: { id: true, title: true } } },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error("Admin schedule create error:", error);
    return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 });
  }
}

// PUT /api/admin/schedules — update a schedule
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

    // Rebuild only the editable fields (schema already stripped `enrolled` and
    // the nested `course` object the admin UI sends back).
    const updateData: {
      courseId?: string;
      batchName?: string;
      days?: string;
      startTime?: string;
      endTime?: string;
      startDate?: Date;
      maxSeats?: number;
      active?: boolean;
    } = {};
    if (parsed.data.courseId !== undefined) updateData.courseId = parsed.data.courseId;
    if (parsed.data.batchName !== undefined) updateData.batchName = parsed.data.batchName;
    if (parsed.data.days !== undefined) updateData.days = parsed.data.days;
    if (parsed.data.startTime !== undefined) updateData.startTime = parsed.data.startTime;
    if (parsed.data.endTime !== undefined) updateData.endTime = parsed.data.endTime;
    if (parsed.data.startDate !== undefined) updateData.startDate = new Date(parsed.data.startDate);
    if (parsed.data.maxSeats !== undefined) updateData.maxSeats = parsed.data.maxSeats;
    if (parsed.data.active !== undefined) updateData.active = parsed.data.active;

    try {
      const schedule = await prisma.schedule.update({
        where: { id },
        data: updateData,
        include: { course: { select: { id: true, title: true } } },
      });
      return NextResponse.json(schedule);
    } catch (error) {
      if (isNotFoundError(error)) {
        return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
      }
      throw error;
    }
  } catch (error) {
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
        { error: "Cannot delete this schedule because it has registrations. Remove or reassign them first." },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin schedule delete error:", error);
    return NextResponse.json({ error: "Failed to delete schedule" }, { status: 500 });
  }
}