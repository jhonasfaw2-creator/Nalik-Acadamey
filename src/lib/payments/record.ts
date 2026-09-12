import { prisma } from "@/lib/prisma";
import { generateTxRef } from "@/lib/payments/chapa";

/**
 * Registrations created before online payments existed have no Payment record,
 * so starting a payment for them would fail with "Payment record not found".
 *
 * Self-heal: whenever a student actively starts a payment (or checks status)
 * for a registration that has none, create the missing PENDING payment on the
 * spot, priced from the course row in the DB (never from the browser — same
 * rule as registration). Safe under concurrency: if two requests race, the
 * loser just returns the row the winner created (unique applicationId).
 */
export async function ensurePaymentForApplication(applicationId: string) {
  const existing = await prisma.payment.findUnique({ where: { applicationId } });
  if (existing) return existing;

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      course: { select: { price: true, discountPrice: true } },
    },
  });
  if (!application) return null;

  try {
    return await prisma.payment.create({
      data: {
        applicationId,
        amount: application.course.discountPrice ?? application.course.price,
        currency: "ETB",
        status: "PENDING",
        // Mint the tx_ref up front, same as new registrations.
        txRef: generateTxRef(application.id),
      },
    });
  } catch (error) {
    // Unique violation on applicationId → a concurrent request created it first.
    if ((error as { code?: string }).code === "P2002") {
      return prisma.payment.findUnique({ where: { applicationId } });
    }
    throw error;
  }
}
