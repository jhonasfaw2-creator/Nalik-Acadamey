import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applicationSchema } from "@/lib/validators";

// 1. Force Vercel to treat this route as dynamic (never cached)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function generateReferenceId(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `NA-${year}-${random}`;
}

export async function POST(request: NextRequest) {
  console.log("=== API ROUTE HIT: /api/applications ===");

  try {
    const body = await request.json();
    console.log("Incoming Payload:", body);

    // Zod validation
    const result = applicationSchema.safeParse(body);
    if (!result.success) {
      const firstError = result.error.errors[0]?.message || "Invalid input";
      console.log("Validation Failed:", firstError);
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const data = result.data;

    // Check duplicate
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
          error: "You have already applied for this course.",
          referenceId: existing.referenceId,
        },
        { status: 409 }
      );
    }

    // Generate ID
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

    // Insert into Neon DB
    const application = await prisma.application.create({
      data: {
        referenceId,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        age: Number(data.age),
        courseSelection: data.courseSelection,
        previousExperience: data.previousExperience,
        motivation: data.motivation,
        whatsappNumber: (data as any).whatsappNumber || "",
      },
    });

    console.log("Success! Saved ID:", application.referenceId);

    return NextResponse.json(
      {
        success: true,
        referenceId: application.referenceId,
        message: "Application submitted successfully",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("FULL DATABASE ERROR:", error);

    return NextResponse.json(
      {
        error: "Database insertion failed.",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}