import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    const body = await request.json();
    const { courseId, batchName, days, startTime, endTime, startDate, maxSeats, active } = body;

    if (!courseId || !batchName || !days || !startTime || !endTime || !startDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const schedule = await prisma.schedule.create({
      data: {
        courseId,
        batchName,
        days,
        startTime,
        endTime,
        startDate: new Date(startDate),
        maxSeats: maxSeats || 20,
        active: active ?? true,
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
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    if (data.startDate) data.startDate = new Date(data.startDate);

    const schedule = await prisma.schedule.update({
      where: { id },
      data,
      include: { course: { select: { id: true, title: true } } },
    });

    return NextResponse.json(schedule);
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
    await prisma.schedule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin schedule delete error:", error);
    return NextResponse.json({ error: "Failed to delete schedule" }, { status: 500 });
  }
}
