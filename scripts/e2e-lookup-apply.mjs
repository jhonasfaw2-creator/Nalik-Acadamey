/**
 * Applies a verified SUCCESS payment for a registration through the EXACT
 * production code path (applyChapaPaymentResult) — the same function the
 * Chapa webhook and /api/payments/verify call. Run with tsx.
 * Usage: npx tsx scripts/e2e-lookup-apply.mjs NA-2026-XXXXXX
 */
import { PrismaClient } from "@prisma/client";

const ref = process.argv[2];
if (!ref) { console.error("usage: tsx scripts/e2e-lookup-apply.mjs <referenceId>"); process.exit(1); }

const prisma = new PrismaClient();
const app = await prisma.application.findUnique({ where: { referenceId: ref }, include: { payment: true } });
if (!app || !app.payment) { console.error("registration/payment not found"); process.exit(1); }

const { applyChapaPaymentResult } = await import("../src/lib/payments/apply.js");
const result = await applyChapaPaymentResult(app.payment.id, {
  status: "SUCCESS",
  chapaReference: "e2e-test-reference",
  txRef: app.payment.txRef,
  amount: app.payment.amount,
  currency: app.payment.currency,
  method: "telebirr",
  raw: { event: "e2e-test" },
});
console.log("applied:", JSON.stringify(result));
await prisma.$disconnect();
if (!result?.paid) process.exit(1);
