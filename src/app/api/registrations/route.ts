import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function generateReferenceId(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `NA-${year}-${random}`;
}

// POST /api/registrations — public, create registration + pending payment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fullName,
      email,
      phone,
      age,
      courseId,
      scheduleId,
      previousExperience,
      motivation,
    } = body;

    // Basic validation
    if (!fullName || !email || !phone || !age || !courseId || !motivation) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

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

    // Get course price for payment record
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
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

    // Create registration
    const application = await prisma.application.create({
      data: {
        referenceId,
        fullName,
        email,
        phone,
        age: Number(age),
        courseId,
        scheduleId: scheduleId || null,
        previousExperience: previousExperience || "",
        motivation,
      },
    });

    // Create pending payment
    await prisma.payment.create({
      data: {
        applicationId: application.id,
        amount: paymentAmount,
        method: "bank_transfer",
        status: "pending",
      },
    });

    // Increment enrolled count on schedule
    if (scheduleId) {
      await prisma.schedule.update({
        where: { id: scheduleId },
        data: { enrolled: { increment: 1 } },
      });
    }

    return NextResponse.json(
      { success: true, referenceId: application.referenceId },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Registration error:", error);
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
