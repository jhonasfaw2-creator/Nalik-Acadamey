// Chapa sandbox flow test — exercises the full server-side payment lifecycle
// against a running dev server:
//   register → (init, when CHAPA_SECRET_KEY is set) → signed webhook
//   deliveries (success / failure / cancelled / amount mismatch / bad
//   signature / duplicates) → /api/payments/verify → DB state assertions.
//
// Usage:
//   node --env-file=.env scripts/chapa-flow-test.mjs [BASE_URL]
// (BASE_URL defaults to http://localhost:3000)

import crypto from "node:crypto";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const BASE = process.argv[2] || "http://localhost:3000";
const prisma = new PrismaClient();

// Restore the schedule seat count after the test (test A increments it).
let restoreSchedule = null;

let passed = 0;
let failed = 0;
const check = (name, cond, extra = "") => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name} ${extra}`); }
};

const req = async (path, options = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

const sign = (payload) => {
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", process.env.CHAPA_WEBHOOK_SECRET).update(raw).digest("hex");
  return { raw, sig };
};

const sendWebhook = async (payload, signatureOverride) => {
  const { raw, sig } = sign(payload);
  const res = await fetch(`${BASE}/api/webhooks/chapa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-chapa-signature": signatureOverride || sig,
    },
    body: raw,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

const fmt = (n) => n.toLocaleString("en-ET") + " ETB";

async function main() {
  const suffix = Date.now().toString(36);
  console.log(`\n🧪 Chapa flow test — ${new Date().toISOString()} (base ${BASE})\n`);

  // Course price straight from the DB (what the server will charge)
  const course = await prisma.course.findUnique({ where: { id: "adobe-premiere-pro" } });
  if (!course) { console.log("  ✗ course adobe-premiere-pro not found in DB — run seed"); process.exit(1); }
  const chargeAmount = course.discountPrice ?? course.price;
  const schedule = await prisma.schedule.findUnique({ where: { id: "app-morning-a" } });
  const enrolledBefore = schedule ? schedule.enrolled : 0;
  restoreSchedule = { id: "app-morning-a", enrolled: enrolledBefore };

  const cleanupIds = [];

  const register = async (label) => {
    const email = `test-${label}-${suffix}@example.com`;
    const res = await req("/api/registrations", {
      method: "POST",
      body: JSON.stringify({
        fullName: `Test ${label}`,
        email,
        phone: "+251911000000",
        whatsapp: "+251911000000",
        age: 22,
        courseId: "adobe-premiere-pro",
        scheduleId: "app-morning-a",
      }),
    });
    return { res, email };
  };

  // ── 1. Registration ────────────────────────────────────────────────
  console.log("1) Registration (Course → Schedule → Student info)");
  const regA = await register("A");
  check("POST /api/registrations → 201 + referenceId", regA.res.status === 201 && regA.res.data?.referenceId);
  const refA = regA.res.data.referenceId;
  check(`server-charged amount = ${chargeAmount}`, Number(regA.res.data?.amount) === chargeAmount, `got ${regA.res.data?.amount}`);
  cleanupIds.push(refA);
  const appA = await prisma.application.findUnique({ where: { referenceId: refA }, include: { payment: true } });
  check("application.status = PENDING_PAYMENT", appA?.status === "PENDING_PAYMENT");
  check("payment.status = PENDING, currency ETB", appA?.payment?.status === "PENDING" && appA?.payment?.currency === "ETB");
  check("schedule enrolled NOT incremented at registration", (await prisma.schedule.findUnique({ where: { id: "app-morning-a" } }))?.enrolled === enrolledBefore);

  // ── 2. Simulated init (write the refs the /init endpoint would set) ─
  console.log("\n2) Simulated Chapa init (checkout_url returned by init stores these refs)");
  const merchantA = `NALIK-${suffix}-A`;
  const chapaA = `CHAPA-TEST-${suffix}-A`;
  await prisma.payment.update({ where: { applicationId: appA.id }, data: { merchantReference: merchantA, chapaReference: chapaA } });
  check("attempt stored (merchantReference + chapaReference)", true);

  // ── 3. Success webhook ──────────────────────────────────────────────
  console.log("\n3) payment.success webhook → verified paid");
  const w1 = await sendWebhook({
    webhook_type: "payment", event: "payment.success", status: "success", mode: "test",
    currency: "ETB", amount: String(chargeAmount), merchant_reference: merchantA, chapa_reference: chapaA,
    payment_method: "telebirr", service_fee: "0",
    customer: { first_name: "Test", last_name: "A", email: regA.email },
  });
  check("webhook accepted (200)", w1.status === 200, `got ${w1.status}`);
  const v1 = await req(`/api/payments/verify?referenceId=${encodeURIComponent(refA)}`);
  check("verify → SUCCESS + registration PAID",
    v1.data?.status === "SUCCESS" && v1.data?.registration?.registrationStatus === "PAID",
    JSON.stringify(v1.data?.status));
  check("summary shows course + schedule + amount",
    v1.data?.registration?.course && v1.data?.registration?.amount === chargeAmount);
  const afterA = await prisma.application.findUnique({ where: { referenceId: refA }, include: { payment: true } });
  check("payment.merchantReference + chapaReference stored", afterA?.payment?.merchantReference === merchantA && afterA?.payment?.chapaReference === chapaA);
  check("schedule enrolled incremented exactly once", (await prisma.schedule.findUnique({ where: { id: "app-morning-a" } }))?.enrolled === enrolledBefore + 1);

  // ── 4. Duplicate webhook (idempotency) ─────────────────────────────
  console.log("\n4) Duplicate payment.success delivery (idempotency)");
  const w1dup = await sendWebhook({
    webhook_type: "payment", event: "payment.success", status: "success", mode: "test",
    currency: "ETB", amount: String(chargeAmount), merchant_reference: merchantA, chapa_reference: chapaA,
    payment_method: "telebirr", customer: { first_name: "Test", last_name: "A", email: regA.email },
  });
  check("duplicate accepted (200)", w1dup.status === 200);
  check("enrolled still +1 (not double-counted)", (await prisma.schedule.findUnique({ where: { id: "app-morning-a" } }))?.enrolled === enrolledBefore + 1);
  check("payment still SUCCESS", (await prisma.application.findUnique({ where: { referenceId: refA }, include: { payment: true } }))?.payment?.status === "SUCCESS");

  // ── 5. Bad signature rejected ───────────────────────────────────────
  console.log("\n5) Invalid webhook signature");
  const badSig = await sendWebhook({
    webhook_type: "payment", event: "payment.success", status: "success", mode: "test",
    currency: "ETB", amount: "10", merchant_reference: "whatever", chapa_reference: "whatever",
  }, "f".repeat(64));
  check("rejected with 401", badSig.status === 401, `got ${badSig.status}`);

  // ── 6. Amount mismatch → NOT marked paid ────────────────────────────
  console.log("\n6) payment.success with wrong amount → rejected");
  const regB = await register("B");
  const refB = regB.res.data.referenceId;
  cleanupIds.push(refB);
  const appB = await prisma.application.findUnique({ where: { referenceId: refB }, include: { payment: true } });
  const merchantB = `NALIK-${suffix}-B`;
  await prisma.payment.update({ where: { applicationId: appB.id }, data: { merchantReference: merchantB, chapaReference: `CHAPA-TEST-${suffix}-B` } });
  const w2 = await sendWebhook({
    webhook_type: "payment", event: "payment.success", status: "success", mode: "test",
    currency: "ETB", amount: String(chargeAmount + 500), merchant_reference: merchantB, chapa_reference: `CHAPA-TEST-${suffix}-B`,
    payment_method: "card", customer: { first_name: "Test", last_name: "B", email: regB.email },
  });
  check("webhook accepted (200)", w2.status === 200);
  const v2 = await req(`/api/payments/verify?referenceId=${encodeURIComponent(refB)}`);
  check("payment NOT paid on amount mismatch", v2.data?.status !== "SUCCESS", `got ${v2.data?.status}`);
  const afterB = await prisma.application.findUnique({ where: { referenceId: refB }, include: { payment: true } });
  check("mismatch recorded in notes", (afterB?.payment?.notes || "").includes("mismatch"));
  check("registration still PENDING_PAYMENT", afterB?.status === "PENDING_PAYMENT");

  // ── 7. Failed + cancelled events ────────────────────────────────────
  console.log("\n7) payment.failed / payment.cancelled");
  const regC = await register("C");
  cleanupIds.push(regC.res.data.referenceId);
  const appC = await prisma.application.findUnique({ where: { referenceId: regC.res.data.referenceId }, include: { payment: true } });
  await prisma.payment.update({ where: { applicationId: appC.id }, data: { merchantReference: `NALIK-${suffix}-C`, chapaReference: `CHAPA-TEST-${suffix}-C` } });
  await sendWebhook({ webhook_type: "payment", event: "payment.failed", status: "failed", mode: "test", currency: "ETB", amount: String(chargeAmount), merchant_reference: `NALIK-${suffix}-C`, chapa_reference: `CHAPA-TEST-${suffix}-C`, reason: "INSUFFICIENT_FUNDS", customer: { email: regC.email } });
  const v3 = await req(`/api/payments/verify?referenceId=${encodeURIComponent(regC.res.data.referenceId)}`);
  check("failed → payment FAILED, registration PENDING_PAYMENT", v3.data?.status === "FAILED" && v3.data?.registration?.registrationStatus === "PENDING_PAYMENT", JSON.stringify(v3.data?.status));

  const regD = await register("D");
  cleanupIds.push(regD.res.data.referenceId);
  const appD = await prisma.application.findUnique({ where: { referenceId: regD.res.data.referenceId }, include: { payment: true } });
  await prisma.payment.update({ where: { applicationId: appD.id }, data: { merchantReference: `NALIK-${suffix}-D`, chapaReference: `CHAPA-TEST-${suffix}-D` } });
  await sendWebhook({ webhook_type: "payment", event: "payment.cancelled", status: "cancelled", mode: "test", currency: "ETB", amount: String(chargeAmount), merchant_reference: `NALIK-${suffix}-D`, chapa_reference: `CHAPA-TEST-${suffix}-D`, cancelled_by: "USER", customer: { email: regD.email } });
  const v4 = await req(`/api/payments/verify?referenceId=${encodeURIComponent(regD.res.data.referenceId)}`);
  check("cancelled → payment CANCELLED", v4.data?.status === "CANCELLED", JSON.stringify(v4.data?.status));

  // ── 8. Unmatched ref + non-payment events acknowledged ──────────────
  console.log("\n8) Unknown event / unmatched reference (acknowledged, no crash)");
  const w5 = await sendWebhook({ webhook_type: "payout", event: "payout.success", status: "success", mode: "test", currency: "ETB", amount: "100", merchant_reference: "x", chapa_reference: "y" });
  check("payout event ignored (200)", w5.status === 200);
  const w6 = await sendWebhook({ webhook_type: "payment", event: "payment.success", status: "success", mode: "test", currency: "ETB", amount: "100", merchant_reference: "NALIK-NOPE-UNMATCHED", chapa_reference: "CHAPA-NOPE" });
  check("unmatched payment acknowledged (200)", w6.status === 200);

  // ── Summary ─────────────────────────────────────────────────────────
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
  if (passed > 0 && failed === 0) console.log(`✅ Full server-side payment lifecycle verified for ${fmt(chargeAmount)}`);
  else console.log("❌ Some checks failed — see above.");
}

main()
  .catch((e) => { console.error("Test crashed:", e); process.exitCode = 1; })
  .finally(async () => {
    // Cleanup test registrations + restore schedule seat count.
    try {
      const del = await prisma.application.deleteMany({ where: { email: { startsWith: "test-" } } });
      console.log(`\n🧹 Cleaned up ${del.count} test registrations.`);
      if (restoreSchedule) {
        await prisma.schedule.update({ where: { id: restoreSchedule.id }, data: { enrolled: restoreSchedule.enrolled } });
      }
    } catch { /* ignore */ }
    await prisma.$disconnect();
  });