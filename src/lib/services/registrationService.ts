
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function handleProofDecision(id: string, status: "APPROVED" | "REJECTED", note: string | null) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const registration = await tx.registration.findUnique({
            where: { id },
            select: {
                id: true,
                status: true,
                scheduleId: true,
                paymentProofPath: true,
                paymentProofStatus: true,
            },
        });

        if (!registration) throw new Error("NOT_FOUND");
        if (!registration.paymentProofPath) throw new Error("NO_PROOF");
        if (registration.paymentProofStatus !== "PENDING_REVIEW") throw new Error("NOT_PENDING");

        if (status === "REJECTED") {
            const updated = await tx.registration.updateMany({
                where: { id, paymentProofStatus: "PENDING_REVIEW", paymentProofPath: { not: null } },
                data: {
                    paymentProofStatus: "REJECTED",
                    paymentProofReviewedAt: new Date(),
                    paymentProofNote: note,
                },
            });
            if (updated.count !== 1) throw new Error("NOT_PENDING");
            return tx.registration.findUniqueOrThrow({ where: { id } });
        }

        const alreadyHoldsSeat =
            registration.status === "PAID" || registration.status === "CONFIRMED";

        const reviewedAt = new Date();

        if (!alreadyHoldsSeat) {
            if (!registration.scheduleId) throw new Error("SCHEDULE_REQUIRED");

            const schedule = await tx.schedule.findUnique({
                where: { id: registration.scheduleId },
                select: {
                    id: true,
                    active: true,
                    enrolled: true,
                    maxSeats: true,
                    availabilityOverride: true,
                },
            });

            if (!schedule) throw new Error("SCHEDULE_NOT_FOUND");
            if (!schedule.active || (schedule.availabilityOverride === false)) {
                throw new Error("SCHEDULE_UNAVAILABLE");
            }

            const actualEnrolled = await tx.registration.count({
                where: {
                    scheduleId: schedule.id,
                    status: { in: ["PAID", "CONFIRMED"] },
                },
            });

            if (actualEnrolled >= schedule.maxSeats) throw new Error("SCHEDULE_FULL");

            const seat = await tx.schedule.updateMany({
                where: {
                    id: schedule.id,
                    enrolled: { lt: schedule.maxSeats },
                    active: true,
                    OR: [ { availabilityOverride: null }, { availabilityOverride: true } ],
                },
                data: { enrolled: { increment: 1 } },
            });
            if (seat.count !== 1) throw new Error("SCHEDULE_FULL");
        }

        // An approved bank-transfer proof is the authoritative confirmation
        // that the pending payment was received. Keep the payment ledger in
        // sync with the registration and proof-review statuses.
        const latestPendingPayment = await tx.payment.findFirst({
            where: { registrationId: id, status: "PENDING" },
            orderBy: { createdAt: "desc" },
            select: { id: true },
        });

        if (latestPendingPayment) {
            await tx.payment.updateMany({
                where: {
                    registrationId: id,
                    status: "PENDING",
                    id: { not: latestPendingPayment.id },
                },
                data: { status: "CANCELLED" },
            });
            await tx.payment.update({
                where: { id: latestPendingPayment.id },
                data: { status: "SUCCESS", verifiedAt: reviewedAt },
            });
        }

        const updated = await tx.registration.updateMany({
            where: { id, paymentProofStatus: "PENDING_REVIEW", paymentProofPath: { not: null } },
            data: {
                status: "CONFIRMED",
                paidAt: reviewedAt,
                paymentProofStatus: "APPROVED",
                paymentProofReviewedAt: reviewedAt,
                paymentProofNote: note,
            },
        });
        if (updated.count !== 1) throw new Error("NOT_PENDING");
        return tx.registration.findUniqueOrThrow({ where: { id } });
    });
}
