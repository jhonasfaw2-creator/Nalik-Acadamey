import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson, isNotFoundError } from "@/lib/http";
import type { Prisma, PrismaClient } from "@prisma/client";

// PUT /api/admin/registrations/[id] — update registration status, course, or schedule.
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
    if (status !== undefined && status !== "PENDING" && status !== "CONFIRMED") {
      return NextResponse.json({ error: "Status must be PENDING or CONFIRMED." }, { status: 400 });
    }
    if (courseId !== undefined && (typeof courseId !== "string" || !courseId)) {
      return NextResponse.json({ error: "Invalid courseId" }, { status: 400 });
    }
    if (scheduleId !== undefined && (typeof scheduleId !== "string" || !scheduleId)) {
      return NextResponse.json({ error: "Invalid scheduleId" }, { status: 400 });
    }
    if (courseId === undefined && scheduleId === undefined && status === undefined) {
      return NextResponse.json({ error: "No registration changes provided." }, { status: 400 });
    }

    if (typeof courseId === "string") {
      const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
      if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.registration.findUnique({
        where: { id },
        select: {
          id: true,
          scheduleId: true,
          status: true,
          payments: { select: { status: true } },
        },
      });
      if (!existing) throw new Error("REGISTRATION_NOT_FOUND");
      if (
        status === "CONFIRMED" &&
        existing.payments.length > 0 &&
        !existing.payments.some((payment: { status: string }) => payment.status === "SUCCESS")
      ) {
        throw new Error("PAYMENT_NOT_VERIFIED");
      }

      const nextStatus = typeof status === "string" ? status : existing.status;
      const previousHoldsSeat = existing.status === "PAID" || existing.status === "CONFIRMED";
      const nextHoldsSeat = nextStatus === "PAID" || nextStatus === "CONFIRMED";
      const nextScheduleId = typeof scheduleId === "string" ? scheduleId : existing.scheduleId;
      const scheduleChanged = nextScheduleId !== existing.scheduleId;
      const shouldAddSeat = nextHoldsSeat && (!previousHoldsSeat || scheduleChanged);
      const shouldRemoveSeat = previousHoldsSeat && (!nextHoldsSeat || scheduleChanged);

      if (scheduleChanged || shouldAddSeat) {
        if (!nextScheduleId) throw new Error("SCHEDULE_REQUIRED");
        const schedule = await tx.schedule.findUnique({
          where: { id: nextScheduleId },
          select: { id: true, active: true, enrolled: true, maxSeats: true, availabilityOverride: true },
        });
        if (!schedule) throw new Error("SCHEDULE_NOT_FOUND");
        if (!schedule.active || schedule.availabilityOverride === false) {
          throw new Error("SCHEDULE_UNAVAILABLE");
        }
        if (shouldAddSeat && schedule.enrolled >= schedule.maxSeats) throw new Error("SCHEDULE_FULL");
      }

      if (shouldRemoveSeat && existing.scheduleId) {
        await tx.schedule.update({
          where: { id: existing.scheduleId },
          data: { enrolled: { decrement: 1 } },
        });
      }
      if (shouldAddSeat && nextScheduleId) {
        await tx.schedule.update({
          where: { id: nextScheduleId },
          data: { enrolled: { increment: 1 } },
        });
      }

      const data: Prisma.RegistrationUpdateInput = {};
      if (typeof status === "string") data.status = status;
      if (typeof courseId === "string") data.course = { connect: { id: courseId } };
      if (scheduleChanged && nextScheduleId) data.schedule = { connect: { id: nextScheduleId } };
      return tx.registration.update({ where: { id }, data });
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error) {
      const responses: Record<string, { error: string; status: number }> = {
        REGISTRATION_NOT_FOUND: { error: "Registration not found", status: 404 },
        PAYMENT_NOT_VERIFIED: { error: "Registration cannot be confirmed before payment is verified.", status: 409 },
        SCHEDULE_NOT_FOUND: { error: "Schedule not found", status: 404 },
        SCHEDULE_UNAVAILABLE: { error: "That schedule session is inactive or unavailable.", status: 400 },
        SCHEDULE_FULL: { error: "That schedule session is full.", status: 400 },
        SCHEDULE_REQUIRED: { error: "A schedule is required before confirming enrollment.", status: 400 },
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
