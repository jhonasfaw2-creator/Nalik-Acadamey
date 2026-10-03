import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const byStatus = await prisma.payment.groupBy({ by: ["status"], _count: { _all: true } });
  console.log("by status:", JSON.stringify(byStatus));
  const paid = await prisma.payment.findMany({
    where: { status: "SUCCESS" },
    orderBy: { paidAt: "desc" },
    take: 10,
    select: {
      status: true, merchantReference: true, chapaReference: true, paymentMethod: true,
      serviceFee: true, paidAt: true, updatedAt: true, rawWebhook: true,
      application: { select: { referenceId: true } },
    },
  });
  console.log("SUCCESS rows:", paid.length);
  for (const p of paid) console.log(JSON.stringify(p));
  const nonPending = await prisma.payment.findMany({
    where: { NOT: { status: "PENDING" } },
    select: { status: true, merchantReference: true, chapaReference: true, application: { select: { referenceId: true } } },
    take: 20,
  });
  console.log("non-PENDING total sample:", JSON.stringify(nonPending));
}
main().catch((e) => console.error("ERR", e.message)).finally(() => prisma.$disconnect());
