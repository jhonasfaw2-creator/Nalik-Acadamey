import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAndIncrement } from "@/lib/rateLimit";
import { buildReceiptPdf } from "@/lib/receipt";
import { verifyDownloadToken } from "@/lib/downloadToken";

export const dynamic = "force-dynamic";

// GET /api/registrations/receipt?id=NA-2026-XXXXXX — downloadable PDF receipt.
//
// Downloads accept either a signed entitlement token or the legacy registration
// reference. The request is rate-limited and the PDF is generated server-side.
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

  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  const id = token
    ? verifyDownloadToken(token)
    : (request.nextUrl.searchParams.get("id") || "").trim().toUpperCase();
  if (!id || !/^NA-\d{4}-[A-Z2-9]{6}$/.test(id)) {
    return NextResponse.json({ error: "Invalid registration ID or download token" }, { status: 404 });
  }

  try {
    const registration = await prisma.registration.findUnique({
      where: { referenceId: id },
      select: {
        id: true,
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
      },
    });

    if (!registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    const paid =
      registration.status === "PAID" || registration.status === "CONFIRMED";

    if (!paid) {
      return NextResponse.json(
        { error: "This registration is not paid yet." },
        { status: 409 }
      );
    }

    const [course, successfulTransaction] = await Promise.all([
      registration.course,
      prisma.transaction.findFirst({
        where: { registrationId: registration.id, status: "SUCCESS" },
        orderBy: { paidAt: "desc" },
        select: { amount: true, currency: true, txRef: true, chapaReference: true },
      }),
    ]);
    const amount = successfulTransaction?.amount ?? (course ? course.discountPrice ?? course.price : null);

    const pdf = await buildReceiptPdf({
      referenceId: registration.referenceId,
      fullName: registration.fullName,
      courseTitle: course?.title ?? null,
      scheduleDays: registration.schedule?.days ?? null,
      scheduleGroup: registration.schedule?.group ?? null,
      scheduleSession: registration.schedule?.session ?? null,
      startTime: registration.schedule?.startTime ?? null,
      endTime: registration.schedule?.endTime ?? null,
      startDate: registration.schedule?.startDate
        ? registration.schedule.startDate.toISOString()
        : null,
      amount,
      currency: successfulTransaction?.currency ?? "ETB",
      paymentStatus: "SUCCESS",
      paidAt: registration.paidAt?.toISOString() ?? null,
    });

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="nalik-receipt-${registration.referenceId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Receipt generation error:", error);
    return NextResponse.json({ error: "Failed to generate receipt" }, { status: 500 });
  }
}
