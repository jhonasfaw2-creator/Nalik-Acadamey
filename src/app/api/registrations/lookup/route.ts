import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAndIncrement } from "@/lib/rateLimit";
import { createDownloadTokenOrNull } from "@/lib/downloadToken";
import { isPaymentProofWindowOpen } from "@/lib/paymentDeadline";

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
    const registration = await prisma.registration.findUnique({
      where: { referenceId: id },
      select: {
        referenceId: true,
        fullName: true,
        status: true,
        paymentProofStatus: true,
        paymentProofNote: true,
        proofDeadlineAt: true,
        expiredAt: true,
        payments: { where: { status: "SUCCESS" }, select: { id: true } },
        course: {
          select: {
            id: true,
            title: true,
          },
        },
        schedule: {
          select: { group: true, session: true, days: true, startTime: true, endTime: true, startDate: true },
        },
      },
    });

    if (!registration) {
      return NextResponse.json(
        { found: false, error: "We couldn't find a registration with that ID. Double-check it, or contact us if you think this is a mistake." },
        { status: 404 }
      );
    }

    const now = new Date();
    const windowClosed =
      !!registration.proofDeadlineAt &&
      registration.proofDeadlineAt.getTime() <= now.getTime();
    const hasVerifiedPayment = registration.payments.length > 0;
    // Reflect the deadline immediately, even before the expiration sweep runs.
    const isExpired =
      registration.status === "EXPIRED" ||
      (registration.status === "PENDING" &&
        windowClosed &&
        registration.paymentProofStatus === "NOT_SUBMITTED" &&
        !hasVerifiedPayment);
    const registrationStatus = isExpired ? "EXPIRED" : registration.status;
    const enrolled =
      registrationStatus === "PAID" || registrationStatus === "CONFIRMED";
    const canSubmitPaymentProof =
      registrationStatus === "PENDING" &&
      (registration.paymentProofStatus === "NOT_SUBMITTED" ||
        registration.paymentProofStatus === "REJECTED") &&
      !hasVerifiedPayment &&
      isPaymentProofWindowOpen(registration.proofDeadlineAt, now);
    // Never let a missing signing secret turn an enrolled lookup into a 500.
    const downloadToken = enrolled
      ? createDownloadTokenOrNull(registration.referenceId)
      : null;

    return NextResponse.json({
      found: true,
      registration: {
        referenceId: registration.referenceId,
        fullName: registration.fullName,
        course: registration.course?.title || null,
        courseId: registration.course?.id || null,
        ...(downloadToken ? { downloadToken } : {}),
        schedule: registration.schedule
          ? {
              days: registration.schedule.days,
              session: registration.schedule.session,
              group: registration.schedule.group,
              startTime: registration.schedule.startTime,
              endTime: registration.schedule.endTime,
              startDate: registration.schedule.startDate
                ? registration.schedule.startDate.toISOString()
                : null,
            }
          : null,
        registrationStatus,
        paymentProofStatus: registration.paymentProofStatus ?? null,
        paymentProofNote: registration.paymentProofNote ?? null,
        proofDeadlineAt: registration.proofDeadlineAt
          ? registration.proofDeadlineAt.toISOString()
          : null,
        expiredAt: registration.expiredAt ? registration.expiredAt.toISOString() : null,
        canSubmitPaymentProof,
      },
    });
  } catch (error) {
    console.error("Registration lookup error:", error);
    return NextResponse.json({ error: "Failed to look up registration" }, { status: 500 });
  }
}