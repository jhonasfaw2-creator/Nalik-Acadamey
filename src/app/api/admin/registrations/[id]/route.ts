import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson, isNotFoundError } from "@/lib/http";
import type { Prisma } from "@prisma/client";

// PUT /api/admin/registrations/[id] — reassign course and/or schedule.
// Payment status is exclusively updated by verified payment events.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { status, courseId, scheduleId } = body as {
      status?: unknown;
      courseId?: unknown;
      scheduleId?: unknown;
    };
    if (status !== undefined) {
      return NextResponse.json({ error: "Payment status is managed by verified payment events." }, { status: 403 });
    }
    if (courseId !== undefined && (typeof courseId !== "string" || !courseId)) {
      return NextResponse.json({ error: "Invalid courseId" }, { status: 400 });
    }
    if (scheduleId !== undefined && (typeof scheduleId !== "string" || !scheduleId)) {
      return NextResponse.json({ error: "Invalid scheduleId" }, { status: 400 });
    }
    if (courseId === undefined && scheduleId === undefined) {
      return NextResponse.json({ error: "No registration changes provided." }, { status: 400 });
    }

    if (typeof courseId === "string") {
      const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
      if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.registration.findUnique({
        where: { id },
        select: { id: true, scheduleId: true, status: true },
      });
      if (!existing) throw new Error("REGISTRATION_NOT_FOUND");

      const scheduleChanged = typeof scheduleId === "string" && scheduleId !== existing.scheduleId;
      if (scheduleChanged) {
        const schedule = await tx.schedule.findUnique({
          where: { id: scheduleId },
          select: { id: true, active: true, enrolled: true, maxSeats: true, availabilityOverride: true },
        });
        if (!schedule) throw new Error("SCHEDULE_NOT_FOUND");
        if (!schedule.active || schedule.availabilityOverride === false) {
          throw new Error("SCHEDULE_UNAVAILABLE");
        }

        const holdsSeat = existing.status === "PAID" || existing.status === "CONFIRMED";
        if (holdsSeat && schedule.enrolled >= schedule.maxSeats) throw new Error("SCHEDULE_FULL");
        if (holdsSeat && existing.scheduleId) {
          await tx.schedule.update({
            where: { id: existing.scheduleId },
            data: { enrolled: { decrement: 1 } },
          });
        }
        if (holdsSeat) {
          await tx.schedule.update({
            where: { id: scheduleId },
            data: { enrolled: { increment: 1 } },
          });
        }
      }

      const data: Prisma.RegistrationUpdateInput = {};
      if (typeof courseId === "string") data.course = { connect: { id: courseId } };
      if (typeof scheduleId === "string") data.schedule = { connect: { id: scheduleId } };
      return tx.registration.update({ where: { id }, data });
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error) {
      const responses: Record<string, { error: string; status: number }> = {
        REGISTRATION_NOT_FOUND: { error: "Registration not found", status: 404 },
        SCHEDULE_NOT_FOUND: { error: "Schedule not found", status: 404 },
        SCHEDULE_UNAVAILABLE: { error: "That schedule session is inactive or unavailable.", status: 400 },
        SCHEDULE_FULL: { error: "That schedule session is full.", status: 400 },
      };
      const response = responses[error.message];
      if (response) return NextResponse.json({ error: response.error }, { status: response.status });
    }
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Registration or schedule not found" }, { status: 404 });
    }
    console.error("Admin registration update error:", error);
    return NextResponse.json({ error: "Failed to update registration" }, { status: 500 });
  }
}
