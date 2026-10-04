import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson, isNotFoundError } from "@/lib/http";
import type { Prisma } from "@prisma/client";

// PUT /api/admin/registrations/[id] — update registration status and/or
// reassign course + schedule.
//
// Reassignment also moves the paid state: `paidAt` is cleared when a paid or
// confirmed registration is sent back to PENDING, and stamped when it
// is moved to PAID or CONFIRMED, so the paid timestamp stays truthful.
//
// Schedule reassignment keeps seat bookkeeping correct: when the schedule
// changes, the old session's enrolled count is decremented and the new one
// incremented — but ONLY for registrations that hold a seat (PAID or
// CONFIRMED). Unpaid registrations never occupied a seat, so moving them is a
// plain pointer update. The public lookup reads these relations live, so any
// change here is reflected to the student automatically.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await readJson(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { status, courseId, scheduleId } = body as {
      status?: unknown;
      courseId?: unknown;
      scheduleId?: unknown;
    };

    if (status !== undefined && (typeof status !== "string" || !["PENDING", "PAID", "CONFIRMED"].includes(status))) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (courseId !== undefined && (typeof courseId !== "string" || !courseId)) {
      return NextResponse.json({ error: "Invalid courseId" }, { status: 400 });
    }
    if (scheduleId !== undefined && (typeof scheduleId !== "string" || !scheduleId)) {
      return NextResponse.json({ error: "Invalid scheduleId" }, { status: 400 });
    }

    // Validate referenced course/schedule exist before touching the registration.
    if (typeof courseId === "string") {
      const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
      if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    if (typeof scheduleId === "string") {
      const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId }, select: { id: true, active: true, enrolled: true, maxSeats: true } });
      if (!schedule) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
      if (!schedule.active) return NextResponse.json({ error: "That schedule session is inactive" }, { status: 400 });
    }

    const existing = await prisma.application.findUnique({
      where: { id },
      select: { id: true, scheduleId: true, status: true, paidAt: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    const data: { status?: string; courseId?: string; scheduleId?: string; paidAt?: Date | null } = {};
    if (typeof status === "string") data.status = status;
    if (typeof courseId === "string") data.courseId = courseId;
    if (typeof scheduleId === "string") data.scheduleId = scheduleId;
    // Stamp the first time a registration becomes paid; clear it if it is sent
    // back to pending. A later PAID after CONFIRMED keeps the original stamp.
    if (typeof status === "string") {
      const nowPaid = status === "PAID" || status === "CONFIRMED";
      const wasPaid = existing.status === "PAID" || existing.status === "CONFIRMED";
      if (nowPaid && !existing.paidAt) data.paidAt = new Date();
      else if (!nowPaid) data.paidAt = null;
      else if (wasPaid) data.paidAt = existing.paidAt;
    }

    // Seat bookkeeping when the schedule actually changes.
    const holdsSeat = existing.status === "PAID" || existing.status === "CONFIRMED";
    const scheduleChanged =
      typeof scheduleId === "string" && scheduleId !== existing.scheduleId;

    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.application.update({ where: { id }, data }),
    ];
    if (scheduleChanged && holdsSeat) {
      if (existing.scheduleId) {
        ops.push(
          prisma.schedule.update({
            where: { id: existing.scheduleId },
            data: { enrolled: { decrement: 1 } },
          })
        );
      }
      ops.push(
        prisma.schedule.update({
          where: { id: scheduleId as string },
          data: { enrolled: { increment: 1 } },
        })
      );
    }

    let application;
    try {
      const results = await prisma.$transaction(ops);
      application = results[0] as typeof application;
    } catch (error) {
      if (isNotFoundError(error)) {
        return NextResponse.json({ error: "Registration not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(application);
  } catch (error) {
    console.error("Admin registration update error:", error);
    return NextResponse.json({ error: "Failed to update registration" }, { status: 500 });
  }
}
