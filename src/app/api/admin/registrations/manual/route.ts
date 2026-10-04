import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJson, isUniqueConstraintError } from "@/lib/http";
import { generateUniqueReferenceId } from "@/lib/reference";

// ── Manual student enrollment (admin) ───────────────────────────────
// POST /api/admin/registrations/manual — add a student who registered outside
// the website (phone / in person). Reuses the SAME Application model as online
// registrations so the student appears in the existing tables and their
// reference ID works with the public /registration lookup.
//
// paymentStatus:
//   "PAID"      → create the registration as already paid (cash/bank transfer).
//                 Occupies a seat immediately.
//   "PENDING"   → create as pending; the student settles it out of band.

const manualSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(120),
  email: z.string().trim().email("Please enter a valid email").max(200),
  phone: z.string().trim().min(8, "Phone must be at least 8 digits").max(30),
  age: z.coerce.number().int("Age must be a whole number").min(10, "Age must be 10–99").max(99, "Age must be 10–99"),
  courseId: z.string().min(1, "Course is required"),
  scheduleId: z.string().min(1, "Schedule session is required"),
  paymentStatus: z.enum(["PAID", "PENDING"]).default("PENDING"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = manualSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    const { fullName, email, phone, age, courseId, scheduleId, paymentStatus } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Course must exist and be active.
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    if (!course.active) {
      return NextResponse.json({ error: "This course is not active" }, { status: 400 });
    }

    // Session must exist, be active, and (for paid enrollment) hold a free seat.
    // An admin-marked Full session (availabilityOverride=false) is blocked too —
    // the admin said it is full, so it is full.
    const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) {
      return NextResponse.json({ error: "Schedule session not found" }, { status: 404 });
    }
    if (!schedule.active || schedule.availabilityOverride === false) {
      return NextResponse.json(
        { error: "That session is marked Full. Pick another session or mark it Available first." },
        { status: 400 }
      );
    }
    if (schedule.enrolled >= schedule.maxSeats) {
      return NextResponse.json({ error: "That session is full. Pick another session." }, { status: 400 });
    }

    // Duplicate guard consistent with online registration.
    const existing = await prisma.application.findUnique({
      where: { email_courseId: { email: normalizedEmail, courseId } },
    });
    if (existing) {
      return NextResponse.json(
        { error: `This email is already registered for ${course.title}.`, referenceId: existing.referenceId },
        { status: 409 }
      );
    }

    const referenceId = await generateUniqueReferenceId(async (id) =>
      Boolean(await prisma.application.findUnique({ where: { referenceId: id }, select: { id: true } }))
    );
    const now = new Date();

    // Registration + seat increment written atomically. A PAID manual
    // enrollment moves the registration to PAID and takes the seat in the same
    // transaction, so the counts can never drift apart.
    const created = await prisma.$transaction(async (tx) => {
      const application = await tx.application.create({
        data: {
          referenceId,
          fullName,
          email: normalizedEmail,
          phone,
          age,
          courseId,
          scheduleId,
          status: paymentStatus === "PAID" ? "PAID" : "PENDING",
          paidAt: paymentStatus === "PAID" ? now : null,
        },
      });
      if (paymentStatus === "PAID") {
        await tx.schedule.update({
          where: { id: scheduleId },
          data: { enrolled: { increment: 1 } },
        });
      }
      return application;
    });

    return NextResponse.json(
      {
        success: true,
        application: {
          id: created.id,
          referenceId: created.referenceId,
          fullName: created.fullName,
          status: created.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "This email is already registered for this course." },
        { status: 409 }
      );
    }
    console.error("Manual enrollment error:", error);
    return NextResponse.json({ error: "Failed to add student" }, { status: 500 });
  }
}
