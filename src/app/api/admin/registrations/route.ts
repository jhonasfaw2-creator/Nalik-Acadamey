import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { derivePayment } from "@/lib/registration";

// GET /api/admin/registrations — list all registrations
export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search") || "";
    const status = request.nextUrl.searchParams.get("status") || "";
    const courseId = request.nextUrl.searchParams.get("courseId") || "";

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (courseId) where.courseId = courseId;

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { referenceId: { contains: search } },
      ];
    }

    // The status tallies must reflect every status (so each filter chip shows
    // the true count), so they are computed from the search/course filters
    // only — never the selected status itself.
    const countsWhere: Record<string, unknown> = { ...where };
    delete countsWhere.status;

    const skip = Math.max(0, parseInt(request.nextUrl.searchParams.get("skip") || "0", 10) || 0);
    const take = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get("take") || "100", 10) || 100));

    const [applications, counts] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          course: { select: { id: true, title: true, price: true, discountPrice: true } },
          schedule: {
            select: { id: true, group: true, session: true, days: true, startTime: true, endTime: true },
          },
          payment: {
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              paymentMethod: true,
              merchantReference: true,
              chapaReference: true,
              paidAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.application.groupBy({ by: ["status"], _count: true, where: countsWhere }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const c of counts) statusCounts[c.status] = c._count;

    // Merge the real Chapa Payment row (when one exists) with the payment-shaped
    // view derived from the registration status. The derived view stays
    // authoritative for the paid/unpaid flag (an admin can mark a registration
    // PAID without a Chapa transaction), while the Payment row supplies the
    // reconciliation details — transaction reference, Chapa reference, method,
    // and amount actually charged — that the admin list previously dropped.
    const toIso = (value: Date | null | undefined): string | null =>
      value ? value.toISOString() : null;

    const withPayment = applications.map(({ course, paidAt, payment, ...application }) => {
      const derived = derivePayment({
        registrationStatus: application.status,
        paidAt,
        course,
      });
      const paid = derived.status === "SUCCESS" || payment?.status === "SUCCESS";

      return {
        ...application,
        payment: {
          amount: payment?.amount ?? derived.amount,
          currency: payment?.currency ?? derived.currency,
          // A settled registration never reads as pending, even when the
          // Payment row is missing or stale.
          status: paid ? "SUCCESS" : payment?.status ?? derived.status,
          method: payment?.paymentMethod ?? null,
          txRef: payment?.merchantReference ?? null,
          chapaReference: payment?.chapaReference ?? null,
          paidAt: toIso(payment?.paidAt ?? paidAt),
        },
      };
    });

    return NextResponse.json({ applications: withPayment, statusCounts });
  } catch (error) {
    console.error("Admin registrations fetch error:", error);
    return NextResponse.json({ error: "Failed to load registrations" }, { status: 500 });
  }
}