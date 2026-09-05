import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registrationSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const REF_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

// Reference IDs are used to look up a registration's payment status, so they
// must not be guessable. The old 4-digit format (NA-2026-1234, ~9k values per
// year) was trivially enumerable and leaked student PII via /api/payments/
// verify. Now: 6 chars from a 32-char alphabet ≈ 1B combinations.
function generateReferenceId(): string {
  const year = new Date().getFullYear();
  const random = Array.from({ length: 6 }, () =>
    REF_ID_ALPHABET[crypto.getRandomValues(new Uint8Array(1))[0] % REF_ID_ALPHABET.length]
  ).join("");
  return `NA-${year}-${random}`;
}

// POST /api/registrations — create a registration with a PENDING payment.
//
// The amount is ALWAYS calculated server-side from the course in the
// database (discount price when active, otherwise list price). The browser
// never sends a price.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registrationSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError =
        Object.values(fieldErrors).flat()[0] || "Invalid input";
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

    // Check duplicate
    const existing = await prisma.application.findUnique({
      where: { email_courseId: { email, courseId } },
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

    // Only allow schedules that still have seats and belong to this course.
    if (scheduleId) {
      const schedule = await prisma.schedule.findFirst({
        where: { id: scheduleId, courseId, active: true },
      });
      if (!schedule) {
        return NextResponse.json({ error: "Schedule not found" }, { status: 400 });
      }
      const spotsLeft = schedule.maxSeats - schedule.enrolled;
      if (spotsLeft <= 0) {
        return NextResponse.json({ error: "This schedule is full. Please choose another." }, { status: 400 });
      }
    }

    const paymentAmount = course.discountPrice ?? course.price;

    // Generate unique reference ID
    let referenceId = generateReferenceId();
    let attempts = 0;
    while (attempts < 5) {
      const exists = await prisma.application.findUnique({ where: { referenceId } });
      if (!exists) break;
      referenceId = generateReferenceId();
      attempts++;
    }

    // Create registration + PENDING payment. Seats are not consumed until the
    // payment is verified (see applyChapaPaymentResult).
    const application = await prisma.application.create({
      data: {
        referenceId,
        fullName,
        email,
        phone,
        age,
        courseId,
        scheduleId: scheduleId || null,
        previousExperience: previousExperience || "",
        motivation: motivation || "",
        status: "PENDING_PAYMENT",
      },
    });

    await prisma.payment.create({
      data: {
        applicationId: application.id,
        amount: paymentAmount,
        currency: "ETB",
        status: "PENDING",
      },
    });

    return NextResponse.json(
      {
        success: true,
        referenceId: application.referenceId,
        amount: paymentAmount,
        currency: "ETB",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Registration error:", error);
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}