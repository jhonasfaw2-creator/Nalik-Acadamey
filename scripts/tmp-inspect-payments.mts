import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      merchantReference: true,
      chapaReference: true,
      paymentMethod: true,
      serviceFee: true,
      paidAt: true,
      createdAt: true,
      updatedAt: true,
      application: { select: { referenceId: true, status: true, fullName: true } },
    },
  });
  console.log("payments:", payments.length);
  for (const p of payments) {
    console.log(JSON.stringify(p));
  }
}

main().catch((e) => { console.error("ERR", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
