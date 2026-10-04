import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson, isUniqueConstraintError } from "@/lib/http";
import { registrationSchema } from "@/lib/validators";
import { generateUniqueReferenceId } from "@/lib/reference";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// POST /api/registrations — create a registration.
//
// Registration-only compatibility endpoint. The checkout form uses
// /api/payments/initialize so online signups always receive a transaction.
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = registrationSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError = Object.values(fieldErrors).flat()[0] || "Invalid input";
      return NextResponse.json({ error: firstError, fields: fieldErrors }, { status: 400 });
    }
    const {
      fullName,
      email,
      phone,
      age,
      courseId,
      scheduleId,
      previousExperience,
      motivation,
    } = parsed.data;

    // Normalize so the same student registering with different casing is
    // caught by the (email, courseId) duplicate guard.
    const normalizedEmail = email.toLowerCase();

    // Check duplicate
    const existing = await prisma.registration.findUnique({
      where: { email_courseId: { email: normalizedEmail, courseId } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You have already registered for this course.", referenceId: existing.referenceId },
        { status: 409 }
      );
    }

    // Get course price so the amount comes from the database, not the client.
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    if (!course.active) {
      return NextResponse.json({ error: "This course is not available" }, { status: 400 });
    }

    // A schedule (group + session) is REQUIRED. The session must be active
    // and still have at least one free seat.
    if (!scheduleId) {
      return NextResponse.json({ error: "Please select a schedule group and session." }, { status: 400 });
    }
    const schedule = await prisma.schedule.findFirst({
      where: { id: scheduleId, active: true },
    });
    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 400 });
    }
    // An admin-marked Full session (availabilityOverride=false) is blocked for
    // public registration regardless of the raw seat count.
    if (schedule.availabilityOverride === false) {
      return NextResponse.json({ error: "This session is full. Please choose another session." }, { status: 400 });
    }
    if (schedule.enrolled >= schedule.maxSeats) {
      return NextResponse.json({ error: "This session is full. Please choose another session." }, { status: 400 });
    }

    const paymentAmount = course.discountPrice ?? course.price;

    // Generate unique reference ID (shared with admin manual enrollment).
    const referenceId = await generateUniqueReferenceId(async (id) =>
      Boolean(await prisma.registration.findUnique({ where: { referenceId: id }, select: { id: true } }))
    );

    let registration: { id: string; referenceId: string };
    try {
      registration = await prisma.registration.create({
        data: {
          referenceId,
          fullName,
          email: normalizedEmail,
          phone,
          age,
          courseId,
          scheduleId,
          previousExperience: previousExperience || "",
          motivation: motivation || "",
          status: "PENDING",
        },
      });
    } catch (error) {
      // Two concurrent submissions can both pass the findUnique check above;
      // the (email, courseId) unique index is the authoritative guard.
      if (isUniqueConstraintError(error)) {
        const duplicate = await prisma.registration.findUnique({
          where: { email_courseId: { email: normalizedEmail, courseId } },
        });
        return NextResponse.json(
          {
            error: "You have already registered for this course.",
            referenceId: duplicate?.referenceId,
          },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        referenceId: registration.referenceId,
        amount: paymentAmount,
        currency: "ETB",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Registration error:", error);
    // Never surface internal error details to the browser.
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
