import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAndIncrement } from "@/lib/rateLimit";
import { buildReceiptPdf } from "@/lib/receipt";

export const dynamic = "force-dynamic";

// GET /api/registrations/receipt?id=NA-2026-XXXXXX — downloadable PDF receipt.
//
// Same security model as the public lookup route: the unguessable reference ID
// is the capability, rate-limited per IP, and the payload contains only
// enrollment/receipt data (no email, phone, age, or internal identifiers).
// The PDF is generated from the database server-side so the browser cannot
// influence the contents.
//
// Only a settled registration gets a receipt — an unpaid one answers 409 so a
// guessed ID cannot be used to fabricate proof of payment.
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkAndIncrement(`lookup:${ip}`, 20, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const id = (request.nextUrl.searchParams.get("id") || "").trim().toUpperCase();
  if (!/^NA-\d{4}-[A-Z2-9]{6}$/.test(id)) {
    return NextResponse.json({ error: "Invalid registration ID" }, { status: 404 });
  }

  try {
    const application = await prisma.application.findUnique({
      where: { referenceId: id },
      select: {
        referenceId: true,
        fullName: true,
        status: true,
        paidAt: true,
        course: { select: { title: true, price: true, discountPrice: true } },
        schedule: {
          select: {
            group: true,
            session: true,
            days: true,
            startTime: true,
            endTime: true,
            startDate: true,
          },
        },
        payment: {
          select: {
            amount: true,
            currency: true,
            status: true,
            merchantReference: true,
            chapaReference: true,
            paidAt: true,
          },
        },
      },
    });

    if (!application) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    const paid =
      application.status === "PAID" ||
      application.status === "CONFIRMED" ||
      application.payment?.status === "SUCCESS";

    if (!paid) {
      return NextResponse.json(
        { error: "This registration is not paid yet." },
        { status: 409 }
      );
    }

    const course = application.course;
    const amount =
      application.payment?.amount ??
      (course ? course.discountPrice ?? course.price : null);

    const pdf = await buildReceiptPdf({
      referenceId: application.referenceId,
      fullName: application.fullName,
      courseTitle: course?.title ?? null,
      scheduleDays: application.schedule?.days ?? null,
      scheduleGroup: application.schedule?.group ?? null,
      scheduleSession: application.schedule?.session ?? null,
      startTime: application.schedule?.startTime ?? null,
      endTime: application.schedule?.endTime ?? null,
      startDate: application.schedule?.startDate
        ? application.schedule.startDate.toISOString()
        : null,
      amount,
      currency: application.payment?.currency ?? "ETB",
      paymentStatus: "SUCCESS",
      merchantReference: application.payment?.merchantReference ?? null,
      chapaReference: application.payment?.chapaReference ?? null,
      paidAt: (application.payment?.paidAt ?? application.paidAt)?.toISOString() ?? null,
    });

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="nalik-receipt-${application.referenceId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Receipt generation error:", error);
    return NextResponse.json({ error: "Failed to generate receipt" }, { status: 500 });
  }
}
