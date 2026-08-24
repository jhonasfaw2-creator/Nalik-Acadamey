import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applicationSchema } from "@/lib/validators";

function generateReferenceId(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `NA-${year}-${random}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const result = applicationSchema.safeParse(body);
    if (!result.success) {
      const firstError = result.error.errors[0];
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      );
    }

    const data = result.data;

    const existing = await prisma.application.findUnique({
      where: {
        email_courseSelection: {
          email: data.email,
          courseSelection: data.courseSelection,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error:
            "You have already applied for this course. Please contact us if you need to update your application.",
          referenceId: existing.referenceId,
        },
        { status: 409 }
      );
    }

    let referenceId = generateReferenceId();
    let attempts = 0;
    while (attempts < 5) {
      const exists = await prisma.application.findUnique({
        where: { referenceId },
      });
      if (!exists) break;
      referenceId = generateReferenceId();
      attempts++;
    }

    const application = await prisma.application.create({
      data: {
        referenceId,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        age: data.age,
        courseSelection: data.courseSelection,
        previousExperience: data.previousExperience,
        motivation: data.motivation,
      },
    });

    return NextResponse.json(
      {
        success: true,
        referenceId: application.referenceId,
        message: "Application submitted successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Application submission error:", error);
    const message = error instanceof Error && error.message.includes("connect")
      ? "Database connection failed. Please try again later."
      : "Something went wrong. Please try again later.";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
