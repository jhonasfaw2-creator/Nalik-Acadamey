import { prisma } from "@/lib/prisma";

// Soft-expire registrations whose 24-hour payment-proof window closed without
// a submission. Called from the Vercel Cron endpoint (the reliable trigger) and
// when the admin registrations list is loaded.
//
// Rules:
// - Only PENDING registrations with no proof ever submitted expire.
// - Submitted proofs (pending review) and approved/verified payments never expire.
// - Rows are marked EXPIRED with expiredAt; personal and payment records are kept.
export async function expireOverdueRegistrations(now: Date = new Date()): Promise<number> {
  const overdue = await prisma.registration.findMany({
    where: {
      status: "PENDING",
      paymentProofStatus: "NOT_SUBMITTED",
      proofDeadlineAt: { not: null, lte: now },
      payments: { none: { status: "SUCCESS" } },
    },
    select: { id: true },
  });

  if (overdue.length === 0) return 0;

  // Re-check the same conditions in the write so a proof submitted between the
  // read and the update is never expired.
  const result = await prisma.registration.updateMany({
    where: {
      id: { in: overdue.map((row) => row.id) },
      status: "PENDING",
      paymentProofStatus: "NOT_SUBMITTED",
      proofDeadlineAt: { not: null, lte: now },
    },
    data: { status: "EXPIRED", expiredAt: now },
  });

  return result.count;
}
