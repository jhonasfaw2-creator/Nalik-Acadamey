import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson, isUniqueConstraintError } from "@/lib/http";
import type { Prisma } from "@prisma/client";
import { registrationSchema } from "@/lib/validators";
import { generateUniqueReferenceId } from "@/lib/reference";
import { checkAndIncrement } from "@/lib/rateLimit";
import { normalizeEthiopianPhone } from "@/lib/payments/phone";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// POST /api/registrations — create a pending registration and bank-payment record together.
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkAndIncrement(`registration:${ip}`, 10, 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please wait a minute and try again." },
      { status: 429 },
    );
  }

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
    const normalizedPhone = normalizeEthiopianPhone(phone);
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: "Enter an Ethiopian phone number in international format, for example +251912345678." },
        { status: 400 },
      );
    }
    const normalizedEmail = email?.trim().toLowerCase() || null;
    const referenceId = await generateUniqueReferenceId(async (id) =>
      Boolean(await prisma.registration.findUnique({ where: { referenceId: id }, select: { id: true } })),
    );
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.registration.findFirst({
        where: {
          courseId,
          scheduleId,
          phone: normalizedPhone,
        },
        select: { referenceId: true },
      });
      if (existing) throw new Error("DUPLICATE_REGISTRATION");

      const course = await tx.course.findUnique({ where: { id: courseId } });
      if (!course) throw new Error("COURSE_NOT_FOUND");
      if (!course.active) throw new Error("COURSE_UNAVAILABLE");

      if (!scheduleId) throw new Error("SCHEDULE_REQUIRED");
      const schedule = await tx.schedule.findFirst({
        where: { id: scheduleId, active: true },
      });
      if (!schedule) throw new Error("SCHEDULE_NOT_FOUND");
      if (
        schedule.availabilityOverride === false ||
        schedule.enrolled >= schedule.maxSeats
      ) {
        throw new Error("SCHEDULE_FULL");
      }

      const now = new Date();
      const discountActive =
        course.discountPrice !== null &&
        (!course.discountStartAt || course.discountStartAt <= now) &&
        (!course.discountEndAt || course.discountEndAt >= now);
      const amountInBirr = discountActive ? (course.discountPrice ?? course.price) : course.price;
      const amount = amountInBirr * 100;
      if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2_147_483_647) {
        throw new Error("COURSE_NOT_PAYABLE");
      }

      const registration = await tx.registration.create({
        data: {
          referenceId,
          fullName,
          email: normalizedEmail,
          phone: normalizedPhone,
          age,
          courseId,
          scheduleId,
          previousExperience: previousExperience || "",
          motivation: motivation || "",
          status: "PENDING",
        },
        select: { id: true, referenceId: true },
      });
      await tx.payment.create({
        data: {
          registrationId: registration.id,
          merchantReference: `BANK-${referenceId}`,
          amount,
          currency: "ETB",
          status: "PENDING",
        },
      });

      return { ...registration, amount: amountInBirr };
    });

    return NextResponse.json(
      {
        success: true,
        referenceId: result.referenceId,
        amount: result.amount,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      const responses: Record<string, { error: string; status: number }> = {
        DUPLICATE_REGISTRATION: {
          error: "You have already registered for this course.",
          status: 409,
        },
        COURSE_NOT_FOUND: { error: "Course not found", status: 404 },
        COURSE_UNAVAILABLE: { error: "This course is not available", status: 400 },
        COURSE_NOT_PAYABLE: {
          error: "This course payment amount is invalid. Please contact the academy.",
          status: 400,
        },
        SCHEDULE_REQUIRED: {
          error: "Please select a schedule group and session.",
          status: 400,
        },
        SCHEDULE_NOT_FOUND: { error: "Schedule not found", status: 400 },
        SCHEDULE_FULL: {
          error: "This session is full. Please choose another session.",
          status: 400,
        },
      };
      const response = responses[error.message];
      if (response) return NextResponse.json({ error: response.error }, { status: response.status });
    }
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "You have already registered for this course." },
        { status: 409 },
      );
    }
    console.error("Registration and pending payment record creation failed:", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 },
    );
  }
}
