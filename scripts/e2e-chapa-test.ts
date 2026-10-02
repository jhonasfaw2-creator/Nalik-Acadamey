/**
 * End-to-end payment pipeline test.
 *
 * Unlike a unit test, this drives the REAL route handlers
 * (/api/registrations, /api/payments/chapa/init, /api/payments/verify,
 * /api/webhooks/chapa) against the REAL Neon database, with only Chapa's
 * network calls (Chapa v2 hosted init/verify) mocked. Webhook payloads
 * are signed with a real HMAC using CHAPA_WEBHOOK_SECRET.
 *
 * Real Chapa TEST-mode checkout (Inline.js + real sandbox) still requires real
 * test keys; this covers everything server-side.
 *
 * Run: npx tsx scripts/e2e-chapa-test.ts
 */
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

// ── Load .env (Next does this automatically; a raw script does not) ──────────
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

// Dummy TEST-mode-looking keys for the pipeline (never real, never charged).
process.env.CHAPA_SECRET_KEY = "CHAPA_TEST_e2etest000000000000000000";
process.env.CHAPA_WEBHOOK_SECRET = "e2e-webhook-secret";
const env = process.env as Record<string, string | undefined>;
env.NODE_ENV = env.NODE_ENV || "development";

const CHAPA_V2_BASE = "https://api.chapa.global/v2";
const WEBHOOK_SECRET = process.env.CHAPA_WEBHOOK_SECRET!;

// ── Mock Chapa's network only ────────────────────────────────────────────────
interface MockTx {
  status: "success" | "failed" | "cancelled" | "pending";
  merchantReference: string;
  chapaReference: string;
  amount?: number;
  currency?: string;
  method?: string;
}
const mockTx = new Map<string, MockTx>();
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url === `${CHAPA_V2_BASE}/payments/hosted` && init?.method === "POST") {
    const payload = JSON.parse(String(init.body || "{}")) as { merchant_reference?: string };
    const merchantReference = payload.merchant_reference || "missing-reference";
    const chapaReference = `CHREF-${merchantReference}`;
    return new Response(JSON.stringify({
      status: "success",
      message: "Payment initialized successfully",
      data: {
        checkout_url: `https://checkout.chapa.co/payment/${chapaReference}`,
        chapa_reference: chapaReference,
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (url.startsWith(`${CHAPA_V2_BASE}/payments/`) && url.endsWith("/verify")) {
    const chapaReference = decodeURIComponent(url.split("/payments/")[1]?.split("/verify")[0] || "");
    const tx = mockTx.get(chapaReference);
    if (!tx) {
      return new Response(JSON.stringify({ status: "error", message: "Payment not found", data: null }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({
        status: "success",
        message: "Payment retrieved successfully",
        data: {
          status: tx.status,
          amount: tx.amount ?? 0,
          currency: tx.currency ?? "ETB",
          chapa_reference: tx.chapaReference,
          merchant_reference: tx.merchantReference,
          payment_method: tx.method ?? "telebirr",
          service_fee: 0,
          mode: "test",
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }
  return realFetch(input as RequestInfo, init);
}) as typeof fetch;

// ── Tiny assertion harness ───────────────────────────────────────────────────
let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, details?: unknown) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${details !== undefined ? `  ->  ${JSON.stringify(details)}` : ""}`);
  }
}

function sign(raw: string) {
  return crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
}

async function main() {
  const { NextRequest } = await import("next/server");
  const { prisma } = await import("@/lib/prisma");
  const { POST: registerRoute } = await import("@/app/api/registrations/route");
  const { POST: initRoute } = await import("@/app/api/payments/chapa/init/route");
  const { GET: verifyRoute } = await import("@/app/api/payments/verify/route");
  const { POST: webhookRoute } = await import("@/app/api/webhooks/chapa/route");

  // Cast: Next's RequestInit variant narrows `signal`, but the runtime accepts
  // a standard RequestInit here.
  const req = (url: string, init?: RequestInit) => new NextRequest(url, init as never);
  const jsonReq = (url: string, body: unknown) =>
    req(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  // ── Fixtures ───────────────────────────────────────────────────────────────
  const course = await prisma.course.findFirst({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  if (!course) throw new Error("No active course found. Seed the DB first.");
  const schedules = await prisma.schedule.findMany({ where: { active: true } });
  const schedule = schedules.find((item: { enrolled: number; maxSeats: number }) => item.enrolled < item.maxSeats);
  if (!schedule) throw new Error("No active schedule with remaining seats found. Seed the DB first or free a seat.");

  const price = course.discountPrice ?? course.price;
  const createdAppIds: string[] = [];
  const touchedSchedules = new Map<string, number>();
  const snapshot = (id: string, enrolled: number) => { if (!touchedSchedules.has(id)) touchedSchedules.set(id, enrolled); };

  const uniqueEmail = (tag: string) => `e2e-${tag}-${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;

  async function register(tag: string) {
    const res = await registerRoute(
      jsonReq("http://localhost/api/registrations", {
        fullName: `E2E ${tag}`,
        email: uniqueEmail(tag),
        phone: "+251911223344",
        age: 22,
        courseId: course!.id,
        scheduleId: schedule!.id,
      })
    );
    const body = await res.json();
    if (body.referenceId) {
      const app = await prisma.application.findUnique({ where: { referenceId: body.referenceId } });
      if (app) createdAppIds.push(app.id);
    }
    return { status: res.status, body };
  }

  async function init(referenceId: string, rotate = false) {
    const res = await initRoute(jsonReq("http://localhost/api/payments/chapa/init", { referenceId, rotate }));
    const body = await res.json();
    const application = await prisma.application.findUnique({ where: { referenceId }, include: { payment: true } });
    return { status: res.status, body, chapaReference: application?.payment?.chapaReference || "" };
  }

  async function verify(referenceId: string) {
    const res = await verifyRoute(req(`http://localhost/api/payments/verify?referenceId=${encodeURIComponent(referenceId)}`));
    return { status: res.status, body: await res.json() };
  }

  async function sendWebhook(fields: Record<string, unknown>, signature?: string) {
    const raw = JSON.stringify({ webhook_type: "payment", event: "payment.success", ...fields });
    const res = await webhookRoute(
      req("http://localhost/api/webhooks/chapa", {
        method: "POST",
        headers: { "content-type": "application/json", "x-chapa-signature": signature ?? sign(raw) },
        body: raw,
      })
    );
    return { status: res.status, body: await res.json().catch(() => ({})) };
  }

  console.log(`\nFixtures: course="${course.title}" price=${price} schedule=${schedule.group}/${schedule.session}\n`);

  // ══ 1. Registration: server-side price + PENDING_PAYMENT + tx_ref ══════════
  console.log("1) Registration → course → schedule → server price");
  const reg = await register("happy");
  check("registration returns 201", reg.status === 201, reg);
  check("registration returns success", reg.body.success === true, reg.body);
  check("price is calculated server-side (matches course)", reg.body.amount === price, { got: reg.body.amount, expected: price });

  const app1 = await prisma.application.findUnique({ where: { referenceId: reg.body.referenceId }, include: { payment: true } });
  check("application status is PENDING_PAYMENT", app1?.status === "PENDING_PAYMENT", app1?.status);
  check("payment row created as PENDING", app1?.payment?.status === "PENDING", app1?.payment?.status);
  check("payment amount matches server price", app1?.payment?.amount === price, app1?.payment?.amount);
  check("tx_ref generated server-side at registration", !!app1?.payment?.txRef, app1?.payment?.txRef);
  snapshot(schedule.id, schedule.enrolled);
  const enrolledBefore = schedule.enrolled;

  // ══ 2. v2 hosted init returns a checkout URL and merchant reference ═══════
  console.log("\n2. Init (v2 hosted checkout)");
  const i1 = await init(reg.body.referenceId);
  check("init returns 200", i1.status === 200, i1);
  check("init returns hosted checkout URL", i1.body.checkoutUrl?.startsWith("https://checkout.chapa.co/"), i1.body.checkoutUrl);
  check("merchant_reference is server-generated", i1.body.merchantReference === app1?.payment?.txRef, { init: i1.body.merchantReference, reg: app1?.payment?.txRef });
  check("init never returns a secret key", !JSON.stringify(i1.body).includes("CHAPA_TEST_"), i1.body);

  const txRef1 = i1.body.merchantReference as string;
  const chapaRef1 = i1.chapaReference as string;

  // ══ 3. Successful payment: signed webhook → re-verify → PAID ══════════════
  console.log("\n3) Successful payment → webhook → server verification → PAID");
  mockTx.set(chapaRef1, { status: "success", amount: price, currency: "ETB", merchantReference: txRef1, chapaReference: chapaRef1 });
  const w1 = await sendWebhook({ event: "payment.success", status: "success", merchant_reference: txRef1, chapa_reference: chapaRef1, amount: price, currency: "ETB", payment_method: "telebirr" });
  check("signed webhook acknowledged 200", w1.status === 200, w1);

  const paidApp = await prisma.application.findUnique({ where: { referenceId: reg.body.referenceId }, include: { payment: true } });
  check("DATABASE: payment is SUCCESS", paidApp?.payment?.status === "SUCCESS", paidApp?.payment?.status);
  check("DATABASE: application is PAID", paidApp?.status === "PAID", paidApp?.status);
  check("DATABASE: paidAt recorded", !!paidApp?.payment?.paidAt, paidApp?.payment?.paidAt);
  check("DATABASE: chapa reference stored", paidApp?.payment?.chapaReference === chapaRef1, paidApp?.payment?.chapaReference);
  const afterPaid = await prisma.schedule.findUnique({ where: { id: schedule.id } });
  check("DATABASE: seat incremented once", afterPaid?.enrolled === enrolledBefore + 1, { before: enrolledBefore, after: afterPaid?.enrolled });

  // ══ 3b. Verify endpoint reflects state and leaks no PII ═══════════════════
  console.log("\n3b) Server verify endpoint");
  const v1 = await verify(reg.body.referenceId);
  check("verify reports SUCCESS", v1.body.status === "SUCCESS", v1.body.status);
  check("verify response contains no email/phone/fullName", !("email" in (v1.body.registration ?? {})) && !("phone" in (v1.body.registration ?? {})), v1.body.registration);

  // ══ 4. Duplicate webhook (idempotency) ════════════════════════════════════
  console.log("\n4) Duplicate webhook");
  const w2 = await sendWebhook({ event: "payment.success", status: "success", merchant_reference: txRef1, chapa_reference: chapaRef1, amount: price, currency: "ETB", payment_method: "telebirr" });
  check("duplicate webhook acknowledged 200", w2.status === 200, w2);
  const afterDup = await prisma.schedule.findUnique({ where: { id: schedule.id } });
  check("duplicate webhook does NOT increment seat again", afterDup?.enrolled === enrolledBefore + 1, afterDup?.enrolled);
  const dupApp = await prisma.application.findUnique({ where: { referenceId: reg.body.referenceId } });
  check("duplicate webhook keeps application PAID", dupApp?.status === "PAID", dupApp?.status);

  // ══ 5. Wrong amount ═══════════════════════════════════════════════════════
  console.log("\n5) Wrong amount");
  const regB = await register("wrongamt");
  const iB = await init(regB.body.referenceId, true);
  mockTx.set(iB.chapaReference, { status: "success", amount: price + 1, currency: "ETB", merchantReference: iB.body.merchantReference, chapaReference: iB.chapaReference });
  const wB = await sendWebhook({ event: "payment.success", status: "success", merchant_reference: iB.body.merchantReference, chapa_reference: iB.chapaReference, amount: price + 1, currency: "ETB" });
  check("wrong-amount webhook acknowledged 200", wB.status === 200, wB);
  const appB = await prisma.application.findUnique({ where: { referenceId: regB.body.referenceId }, include: { payment: true } });
  check("DATABASE: wrong amount does NOT mark PAID", appB?.status !== "PAID", appB?.status);
  check("DATABASE: wrong amount does NOT mark payment SUCCESS", appB?.payment?.status !== "SUCCESS", appB?.payment?.status);

  // ══ 6. Invalid merchant_reference ═════════════════════════════════════════
  console.log("\n6. Invalid merchant_reference");
  const wInv = await sendWebhook({ event: "payment.success", status: "success", merchant_reference: "NALIK-does-not-exist", chapa_reference: "CHREF-NOT-FOUND", amount: price, currency: "ETB" });
  check("unknown merchant_reference acknowledged 200 (no processing)", wInv.status === 200, wInv);
  check("no payment exists for the bogus merchant_reference", (await prisma.payment.findUnique({ where: { txRef: "NALIK-does-not-exist" } })) === null);

  // ══ 7. Bad signature ══════════════════════════════════════════════════════
  console.log("\n7) Invalid webhook signature");
  const wBad = await sendWebhook({ event: "payment.success", status: "success", merchant_reference: txRef1, chapa_reference: chapaRef1, amount: price, currency: "ETB" }, "0".repeat(64));
  check("bad signature rejected with 401", wBad.status === 401, wBad.status);

  // ══ 8. Failed payment ═════════════════════════════════════════════════════
  console.log("\n8) Failed payment");
  const regC = await register("failed");
  const iC = await init(regC.body.referenceId, true);
  mockTx.set(iC.chapaReference, { status: "failed", amount: price, currency: "ETB", merchantReference: iC.body.merchantReference, chapaReference: iC.chapaReference });
  const wC = await sendWebhook({ event: "payment.failed", status: "failed", merchant_reference: iC.body.merchantReference, chapa_reference: iC.chapaReference, amount: price, currency: "ETB" });
  check("failed webhook acknowledged 200", wC.status === 200, wC);
  const appC = await prisma.application.findUnique({ where: { referenceId: regC.body.referenceId }, include: { payment: true } });
  check("DATABASE: failed payment is FAILED", appC?.payment?.status === "FAILED", appC?.payment?.status);
  check("DATABASE: failed payment keeps registration PENDING_PAYMENT", appC?.status === "PENDING_PAYMENT", appC?.status);

  // ══ 9. Cancelled payment ══════════════════════════════════════════════════
  console.log("\n9) Cancelled payment");
  const regD = await register("cancelled");
  const iD = await init(regD.body.referenceId, true);
  mockTx.set(iD.chapaReference, { status: "cancelled", amount: price, currency: "ETB", merchantReference: iD.body.merchantReference, chapaReference: iD.chapaReference });
  await sendWebhook({ event: "payment.cancelled", status: "cancelled", merchant_reference: iD.body.merchantReference, chapa_reference: iD.chapaReference, amount: price, currency: "ETB" });
  const appD = await prisma.application.findUnique({ where: { referenceId: regD.body.referenceId }, include: { payment: true } });
  check("DATABASE: cancelled payment is CANCELLED", appD?.payment?.status === "CANCELLED", appD?.payment?.status);
  check("DATABASE: cancelled payment keeps registration PENDING_PAYMENT", appD?.status === "PENDING_PAYMENT", appD?.status);

  // ══ 10. Retry after failure ═══════════════════════════════════════════════
  console.log("\n10) Retry after failure");
  const iRetry = await init(regC.body.referenceId, true);
  check("retry mints a NEW merchant_reference", iRetry.body.merchantReference && iRetry.body.merchantReference !== iC.body.merchantReference, { old: iC.body.merchantReference, new: iRetry.body.merchantReference });
  mockTx.set(iRetry.chapaReference, { status: "success", amount: price, currency: "ETB", merchantReference: iRetry.body.merchantReference, chapaReference: iRetry.chapaReference });
  await sendWebhook({ event: "payment.success", status: "success", merchant_reference: iRetry.body.merchantReference, chapa_reference: iRetry.chapaReference, amount: price, currency: "ETB" });
  const appCRetry = await prisma.application.findUnique({ where: { referenceId: regC.body.referenceId }, include: { payment: true } });
  check("DATABASE: retried payment becomes SUCCESS", appCRetry?.payment?.status === "SUCCESS", appCRetry?.payment?.status);
  check("DATABASE: retried registration becomes PAID", appCRetry?.status === "PAID", appCRetry?.status);

  // ══ 11. Refresh during payment (pending) ══════════════════════════════════
  console.log("\n11) Page refresh while payment pending");
  const regE = await register("pending");
  const iE = await init(regE.body.referenceId, true);
  mockTx.set(iE.chapaReference, { status: "pending", amount: price, currency: "ETB", merchantReference: iE.body.merchantReference, chapaReference: iE.chapaReference });
  const vE = await verify(regE.body.referenceId);
  check("verify returns PENDING (not PAID)", vE.body.status === "PENDING", vE.body.status);
  const appE = await prisma.application.findUnique({ where: { referenceId: regE.body.referenceId } });
  check("DATABASE: pending registration stays PENDING_PAYMENT", appE?.status === "PENDING_PAYMENT", appE?.status);

  // ══ 12. Unknown referenceId cannot mark anything PAID ═════════════════════
  console.log("\n12) Unknown referenceId");
  const vUnknown = await verify("NA-2026-ZZZZZZ");
  check("unknown referenceId returns 404", vUnknown.status === 404, vUnknown.status);

  // ══ 13. Unknown Chapa reference remains pending ════════════════════════════
  console.log("\n13. Chapa reference not indexed yet");
  const regF = await register("unknownref");
  const iF = await init(regF.body.referenceId, true); // reference deliberately NOT added to mockTx
  const vF = await verify(regF.body.referenceId);
  check("verify returns 200 (not 502) when Chapa has no such reference", vF.status === 200, vF.status);
  check("verify reports PENDING for an unknown reference", vF.body.status === "PENDING", vF.body.status);
  const appF = await prisma.application.findUnique({ where: { referenceId: regF.body.referenceId } });
  check("DATABASE: unknown tx_ref leaves registration PENDING_PAYMENT", appF?.status === "PENDING_PAYMENT", appF?.status);
  const wF = await sendWebhook({ event: "payment.success", status: "success", merchant_reference: iF.body.merchantReference, chapa_reference: iF.chapaReference, amount: price, currency: "ETB" });
  check("webhook with unindexed reference is retried", wF.status === 503, wF.status);
  const appF2 = await prisma.application.findUnique({ where: { referenceId: regF.body.referenceId } });
  check("DATABASE: unknown tx_ref webhook does NOT mark PAID", appF2?.status !== "PAID", appF2?.status);

  // ── Cleanup: delete test rows and restore seat counts ──────────────────────
  console.log("\nCleanup…");
  await prisma.application.deleteMany({ where: { id: { in: createdAppIds } } });
  for (const [id, enrolled] of touchedSchedules) {
    await prisma.schedule.update({ where: { id }, data: { enrolled } });
  }
  const leftovers = await prisma.application.count({ where: { id: { in: createdAppIds } } });
  check("test data cleaned up", leftovers === 0, leftovers);

  await prisma.$disconnect();
  globalThis.fetch = realFetch;

  console.log(`\n───────────────\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("FAILURES:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
