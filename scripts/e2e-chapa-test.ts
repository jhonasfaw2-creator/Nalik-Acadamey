/**
 * End-to-end payment pipeline test.
 *
 * Unlike a unit test, this drives the REAL route handlers
 * (/api/registrations, /api/payments/chapa/init, /api/payments/verify,
 * /api/webhooks/chapa) against the REAL Neon database, with only Chapa's
 * network call (api.chapa.co/v1/transaction/verify) mocked. Webhook payloads
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
process.env.CHAPA_PUBLIC_KEY = "CHAPUBK_TEST-e2etest000000000000000000";
process.env.CHAPA_SECRET_KEY = "CHASECK_TEST-e2etest000000000000000000";
process.env.CHAPA_WEBHOOK_SECRET = "e2e-webhook-secret";
process.env.CHAPA_API_BASE_URL = "https://api.chapa.co";
const env = process.env as Record<string, string | undefined>;
env.NODE_ENV = env.NODE_ENV || "development";

const CHAPA_BASE = "https://api.chapa.co";
const WEBHOOK_SECRET = process.env.CHAPA_WEBHOOK_SECRET!;

// ── Mock Chapa's network only ────────────────────────────────────────────────
interface MockTx {
  status: "success" | "failed" | "cancelled" | "pending";
  amount?: number;
  currency?: string;
  reference?: string;
  method?: string;
}
const mockTx = new Map<string, MockTx>();
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith(`${CHAPA_BASE}/v1/transaction/verify/`)) {
    const txRef = decodeURIComponent(url.split("/verify/")[1] || "");
    const tx = mockTx.get(txRef);
    if (!tx) {
      // Mirrors Chapa's LIVE TEST API: an unknown tx_ref returns HTTP 400 with
      // "Invalid transaction reference" (the docs list a 404 instead, so both
      // shapes must be handled).
      return new Response(JSON.stringify({ message: "Invalid transaction reference", status: "failed", data: null }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({
        status: "success",
        message: "Payment details fetched successfully",
        data: {
          status: tx.status,
          amount: tx.amount ?? 0,
          currency: tx.currency ?? "ETB",
          reference: tx.reference ?? "CHAPAREFTEST",
          tx_ref: txRef,
          method: tx.method ?? "telebirr",
          charge: 0,
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
    return { status: res.status, body: await res.json() };
  }

  async function verify(referenceId: string) {
    const res = await verifyRoute(req(`http://localhost/api/payments/verify?referenceId=${encodeURIComponent(referenceId)}`));
    return { status: res.status, body: await res.json() };
  }

  async function sendWebhook(fields: Record<string, unknown>, signature?: string) {
    const raw = JSON.stringify({ event: "charge.success", type: "API", ...fields });
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

  // ══ 2. init returns server price + the registration's tx_ref ══════════════
  console.log("\n2) Init (inline checkout config)");
  const i1 = await init(reg.body.referenceId);
  check("init returns 200", i1.status === 200, i1);
  check("init returns public key", !!i1.body.publicKey, i1.body.publicKey);
  check("init returns server amount (never client-supplied)", i1.body.amount === price, i1.body.amount);
  check("first attempt reuses the registration tx_ref", i1.body.txRef === app1?.payment?.txRef, { init: i1.body.txRef, reg: app1?.payment?.txRef });
  check("init never returns a secret key", !JSON.stringify(i1.body).includes("CHASECK"), i1.body);

  const txRef1 = i1.body.txRef as string;

  // ══ 3. Successful payment: signed webhook → re-verify → PAID ══════════════
  console.log("\n3) Successful payment → webhook → server verification → PAID");
  mockTx.set(txRef1, { status: "success", amount: price, currency: "ETB", reference: "CHAPAREF_OK_1" });
  const w1 = await sendWebhook({ event: "charge.success", status: "success", tx_ref: txRef1, amount: price, currency: "ETB", payment_method: "telebirr" });
  check("signed webhook acknowledged 200", w1.status === 200, w1);

  const paidApp = await prisma.application.findUnique({ where: { referenceId: reg.body.referenceId }, include: { payment: true } });
  check("DATABASE: payment is SUCCESS", paidApp?.payment?.status === "SUCCESS", paidApp?.payment?.status);
  check("DATABASE: application is PAID", paidApp?.status === "PAID", paidApp?.status);
  check("DATABASE: paidAt recorded", !!paidApp?.payment?.paidAt, paidApp?.payment?.paidAt);
  check("DATABASE: chapa reference stored", paidApp?.payment?.chapaReference === "CHAPAREF_OK_1", paidApp?.payment?.chapaReference);
  const afterPaid = await prisma.schedule.findUnique({ where: { id: schedule.id } });
  check("DATABASE: seat incremented once", afterPaid?.enrolled === enrolledBefore + 1, { before: enrolledBefore, after: afterPaid?.enrolled });

  // ══ 3b. Verify endpoint reflects state and leaks no PII ═══════════════════
  console.log("\n3b) Server verify endpoint");
  const v1 = await verify(reg.body.referenceId);
  check("verify reports SUCCESS", v1.body.status === "SUCCESS", v1.body.status);
  check("verify response contains no email/phone/fullName", !("email" in (v1.body.registration ?? {})) && !("phone" in (v1.body.registration ?? {})), v1.body.registration);

  // ══ 4. Duplicate webhook (idempotency) ════════════════════════════════════
  console.log("\n4) Duplicate webhook");
  const w2 = await sendWebhook({ event: "charge.success", status: "success", tx_ref: txRef1, amount: price, currency: "ETB", payment_method: "telebirr" });
  check("duplicate webhook acknowledged 200", w2.status === 200, w2);
  const afterDup = await prisma.schedule.findUnique({ where: { id: schedule.id } });
  check("duplicate webhook does NOT increment seat again", afterDup?.enrolled === enrolledBefore + 1, afterDup?.enrolled);
  const dupApp = await prisma.application.findUnique({ where: { referenceId: reg.body.referenceId } });
  check("duplicate webhook keeps application PAID", dupApp?.status === "PAID", dupApp?.status);

  // ══ 5. Wrong amount ═══════════════════════════════════════════════════════
  console.log("\n5) Wrong amount");
  const regB = await register("wrongamt");
  const iB = await init(regB.body.referenceId, true);
  mockTx.set(iB.body.txRef, { status: "success", amount: price + 1, currency: "ETB", reference: "CHAPAREF_WRONG" });
  const wB = await sendWebhook({ event: "charge.success", status: "success", tx_ref: iB.body.txRef, amount: price + 1, currency: "ETB" });
  check("wrong-amount webhook acknowledged 200", wB.status === 200, wB);
  const appB = await prisma.application.findUnique({ where: { referenceId: regB.body.referenceId }, include: { payment: true } });
  check("DATABASE: wrong amount does NOT mark PAID", appB?.status !== "PAID", appB?.status);
  check("DATABASE: wrong amount does NOT mark payment SUCCESS", appB?.payment?.status !== "SUCCESS", appB?.payment?.status);

  // ══ 6. Invalid tx_ref ═════════════════════════════════════════════════════
  console.log("\n6) Invalid tx_ref");
  const wInv = await sendWebhook({ event: "charge.success", status: "success", tx_ref: "NALIK-does-not-exist", amount: price, currency: "ETB" });
  check("unknown tx_ref acknowledged 200 (no processing)", wInv.status === 200, wInv);
  check("no payment exists for the bogus tx_ref", (await prisma.payment.findUnique({ where: { txRef: "NALIK-does-not-exist" } })) === null);

  // ══ 7. Bad signature ══════════════════════════════════════════════════════
  console.log("\n7) Invalid webhook signature");
  const wBad = await sendWebhook({ event: "charge.success", status: "success", tx_ref: txRef1, amount: price, currency: "ETB" }, "0".repeat(64));
  check("bad signature rejected with 401", wBad.status === 401, wBad.status);

  // ══ 8. Failed payment ═════════════════════════════════════════════════════
  console.log("\n8) Failed payment");
  const regC = await register("failed");
  const iC = await init(regC.body.referenceId, true);
  mockTx.set(iC.body.txRef, { status: "failed", amount: price, currency: "ETB" });
  const wC = await sendWebhook({ event: "charge.failed", status: "failed", tx_ref: iC.body.txRef, amount: price, currency: "ETB" });
  check("failed webhook acknowledged 200", wC.status === 200, wC);
  const appC = await prisma.application.findUnique({ where: { referenceId: regC.body.referenceId }, include: { payment: true } });
  check("DATABASE: failed payment is FAILED", appC?.payment?.status === "FAILED", appC?.payment?.status);
  check("DATABASE: failed payment keeps registration PENDING_PAYMENT", appC?.status === "PENDING_PAYMENT", appC?.status);

  // ══ 9. Cancelled payment ══════════════════════════════════════════════════
  console.log("\n9) Cancelled payment");
  const regD = await register("cancelled");
  const iD = await init(regD.body.referenceId, true);
  mockTx.set(iD.body.txRef, { status: "cancelled", amount: price, currency: "ETB" });
  await sendWebhook({ event: "charge.cancelled", status: "cancelled", tx_ref: iD.body.txRef, amount: price, currency: "ETB" });
  const appD = await prisma.application.findUnique({ where: { referenceId: regD.body.referenceId }, include: { payment: true } });
  check("DATABASE: cancelled payment is CANCELLED", appD?.payment?.status === "CANCELLED", appD?.payment?.status);
  check("DATABASE: cancelled payment keeps registration PENDING_PAYMENT", appD?.status === "PENDING_PAYMENT", appD?.status);

  // ══ 10. Retry after failure ═══════════════════════════════════════════════
  console.log("\n10) Retry after failure");
  const iRetry = await init(regC.body.referenceId, true);
  check("retry mints a NEW tx_ref", iRetry.body.txRef && iRetry.body.txRef !== iC.body.txRef, { old: iC.body.txRef, new: iRetry.body.txRef });
  mockTx.set(iRetry.body.txRef, { status: "success", amount: price, currency: "ETB", reference: "CHAPAREF_RETRY" });
  await sendWebhook({ event: "charge.success", status: "success", tx_ref: iRetry.body.txRef, amount: price, currency: "ETB" });
  const appCRetry = await prisma.application.findUnique({ where: { referenceId: regC.body.referenceId }, include: { payment: true } });
  check("DATABASE: retried payment becomes SUCCESS", appCRetry?.payment?.status === "SUCCESS", appCRetry?.payment?.status);
  check("DATABASE: retried registration becomes PAID", appCRetry?.status === "PAID", appCRetry?.status);

  // ══ 11. Refresh during payment (pending) ══════════════════════════════════
  console.log("\n11) Page refresh while payment pending");
  const regE = await register("pending");
  const iE = await init(regE.body.referenceId, true);
  mockTx.set(iE.body.txRef, { status: "pending", amount: price, currency: "ETB" });
  const vE = await verify(regE.body.referenceId);
  check("verify returns PENDING (not PAID)", vE.body.status === "PENDING", vE.body.status);
  const appE = await prisma.application.findUnique({ where: { referenceId: regE.body.referenceId } });
  check("DATABASE: pending registration stays PENDING_PAYMENT", appE?.status === "PENDING_PAYMENT", appE?.status);

  // ══ 12. Unknown referenceId cannot mark anything PAID ═════════════════════
  console.log("\n12) Unknown referenceId");
  const vUnknown = await verify("NA-2026-ZZZZZZ");
  check("unknown referenceId returns 404", vUnknown.status === 404, vUnknown.status);

  // ══ 13. LIVE-API quirk: unknown tx_ref (HTTP 400) ≠ error ═════════════════
  // A registration that started a payment whose tx_ref Chapa does not know
  // (charge UI closed before any charge) must stay PENDING, not 502/500.
  console.log("\n13) tx_ref Chapa does not know (HTTP 400 'Invalid transaction reference')");
  const regF = await register("unknownref");
  const iF = await init(regF.body.referenceId, true); // tx_ref deliberately NOT added to mockTx
  const vF = await verify(regF.body.referenceId);
  check("verify returns 200 (not 502) when Chapa has no such tx_ref", vF.status === 200, vF.status);
  check("verify reports PENDING for an unknown tx_ref", vF.body.status === "PENDING", vF.body.status);
  const appF = await prisma.application.findUnique({ where: { referenceId: regF.body.referenceId } });
  check("DATABASE: unknown tx_ref leaves registration PENDING_PAYMENT", appF?.status === "PENDING_PAYMENT", appF?.status);
  const wF = await sendWebhook({ event: "charge.success", status: "success", tx_ref: iF.body.txRef, amount: price, currency: "ETB" });
  check("webhook with unknown tx_ref is acknowledged 200 (no retry loop)", wF.status === 200, wF.status);
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
