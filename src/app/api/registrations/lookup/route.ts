import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAndIncrement } from "@/lib/rateLimit";
import { derivePayment } from "@/lib/registration";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkAndIncrement(`lookup:${ip}`, 20, 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  const id = (request.nextUrl.searchParams.get("id") || "").trim().toUpperCase();
  if (!id) {
    return NextResponse.json({ error: "Registration ID is required" }, { status: 400 });
  }

  if (!/^NA-\d{4}-[A-Z2-9]{6}$/.test(id)) {
    return NextResponse.json({ found: false, error: "That registration ID doesn't look right. Check it and try again (format: NA-YYYY-XXXXXX)." }, { status: 404 });
  }

  try {
    const application = await prisma.application.findUnique({
      where: { referenceId: id },
      select: {
        referenceId: true,
        fullName: true,
        status: true,
        paidAt: true,
        course: {
          select: {
            id: true,
            title: true,
            price: true,
            discountPrice: true,
          },
        },
        schedule: {
          select: { group: true, session: true, days: true, startTime: true, endTime: true, startDate: true },
        },
        payment: { select: { status: true } },
      },
    });

    if (!application) {
      return NextResponse.json(
        { found: false, error: "We couldn't find a registration with that ID. Double-check it, or contact us if you think this is a mistake." },
        { status: 404 }
      );
    }

    const payment = derivePayment({
      registrationStatus: application.status,
      paidAt: application.paidAt,
      course: application.course,
    });

    let courseMaterials: { id: string; title: string; fileUrl: string; fileType: string }[] = [];
    if (application.course?.id) {
      courseMaterials = await prisma.courseMaterial.findMany({
        where: { courseId: application.course.id },
        select: { id: true, title: true, fileUrl: true, fileType: true },
        orderBy: { sortOrder: "asc" },
      });
    }

    return NextResponse.json({
      found: true,
      registration: {
        referenceId: application.referenceId,
        fullName: application.fullName,
        course: application.course?.title || null,
        courseId: application.course?.id || null,
        schedule: application.schedule
          ? {
              days: application.schedule.days,
              session: application.schedule.session,
              group: application.schedule.group,
              startTime: application.schedule.startTime,
              endTime: application.schedule.endTime,
              startDate: application.schedule.startDate
                ? application.schedule.startDate.toISOString()
                : null,
            }
          : null,
        amount: payment.amount,
        currency: payment.currency,
        paymentStatus: payment.status,
        registrationStatus: application.status,
        paidAt: payment.paidAt,
        courseMaterials,
      },
    });
  } catch (error) {
    console.error("Registration lookup error:", error);
    return NextResponse.json({ error: "Failed to look up registration" }, { status: 500 });
  }
}