/**
 * FULL LIVE end-to-end test against Chapa's TEST environment and the real
 * Neon database, through the real HTTP application (no route imports, no mocks
 * for the app path).
 *
 * Chain exercised:
 *   Registration (HTTP POST /api/registrations)
 *     → server-side price + tx_ref + PENDING_PAYMENT
 *     → Chapa TEST checkout opened in real Chrome and PAID with Chapa's
 *       documented test phone number (no real money)
 *     → redirect to /payment/return → /api/payments/verify (server-side verify
 *       against api.chapa.co)
 *     → Neon: Payment SUCCESS + Application PAID + seat booked
 *     → signed webhook delivery: idempotent (no double booking)
 *     → failure + cancel paths stay PENDING_PAYMENT (never PAID)
 *
 * Chapa's own webhook cannot reach localhost, so the delivery is simulated by
 * POSTing a correctly HMAC-signed event to the local endpoint — the signature
 * IS verified by the running app, and the handler then re-verifies with Chapa.
 *
 * Run: npx tsx scripts/chapa-live-e2e.ts
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { loadEnv, requireTestSecretKey } from "./lib/env";
import { Cdp } from "./lib/cdp";

const PORT = Number(process.env.E2E_PORT || 3111);
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME_PORT = Number(process.env.E2E_CHROME_PORT || 9334);
const SUCCESS_PHONE = "0900123456"; // Chapa documented test-mode success number
const FAILURE_PHONE = "0900000000"; // any other number returns failed

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
function skip(name: string, why: string) {
  console.log(`  SKIP  ${name} (${why})`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  loadEnv();
  const secret = requireTestSecretKey();
  const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET || "";
  const { prisma } = await import("@/lib/prisma");

  console.log(`Using TEST credentials: ${secret.slice(0, 14)}…`);
  if (!process.env.CHAPA_PUBLIC_KEY) {
    console.warn("! CHAPA_PUBLIC_KEY is not set — Inline.js itself cannot render (checkout exercised via Chapa's hosted page).");
  }
  if (!webhookSecret) console.warn("! CHAPA_WEBHOOK_SECRET is not set");

  const course = await prisma.course.findFirst({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  const schedule = await prisma.schedule.findFirst({ where: { active: true } });
  if (!course || !schedule) throw new Error("No active course/schedule — seed the DB first.");
  const price = course.discountPrice ?? course.price;
  const enrolledBefore = schedule.enrolled;
  const emails: string[] = [];

  // ── Start the real app server with the .env payment config ────────────────
  console.log(`\nStarting app on ${BASE} (next start)…`);
  const server = spawn("bash", ["-lc", `set -a; . ./.env; set +a; npx next start -p ${PORT}`], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  server.stdout?.on("data", (d) => process.stdout.write(`[app] ${d}`));
  server.stderr?.on("data", (d) => process.stderr.write(`[app] ${d}`));

  let chrome: Cdp | undefined;
  let cdp: Cdp | undefined;

  const register = async (tag: string) => {
    const email = `live-e2e-${tag}-${Date.now()}@gmail.com`;
    emails.push(email);
    const res = await fetch(`${BASE}/api/registrations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: `Live E2E ${tag}`,
        email,
        phone: "+251911223344",
        age: 23,
        courseId: course.id,
        scheduleId: schedule.id,
      }),
    });
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };

  const verifyApp = async (referenceId: string) => {
    const res = await fetch(`${BASE}/api/payments/verify?referenceId=${encodeURIComponent(referenceId)}`, {
      cache: "no-store",
    });
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };

  /** Creates a payable TEST transaction for an existing registration tx_ref. */
  const createChapaTransaction = async (txRef: string, referenceId: string, email: string) => {
    const res = await fetch("https://api.chapa.co/v1/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: String(price),
        currency: "ETB",
        email,
        first_name: "Live",
        last_name: "E2E",
        phone: SUCCESS_PHONE,
        tx_ref: txRef,
        callback_url: `${BASE}/api/webhooks/chapa`,
        return_url: `${BASE}/payment/return?referenceId=${referenceId}`,
      }),
    });
    const body = (await res.json()) as Record<string, any>;
    return { status: res.status, body, checkoutUrl: body?.data?.checkout_url as string | undefined };
  };

  const rawVerify = async (txRef: string) => {
    const res = await fetch(`https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(txRef)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, any> | null };
  };

  /** Drives Chapa's TEST checkout in a real browser. Returns the settled state. */
  const payInBrowser = async (checkoutUrl: string, phone: string, useCard: boolean = false) => {
    cdp = await Cdp.openTab(CHROME_PORT);
    await cdp.navigate(checkoutUrl);
    
    // Accept cookies if present
    await cdp.clickText("Accept");
    await sleep(500);
    
    if (useCard) {
      // Card payment flow - simpler test credentials
      await cdp.clickText("Test Card Payment");
      await sleep(1000);
      
      // Fill card details (Chapa test card: 4242 4242 4242 4242)
      await cdp.setInput("input[name='card_number']", "4242424242424242");
      await cdp.setInput("input[name='expiry']", "12/27");
      await cdp.setInput("input[name='cvc']", "123");
      await cdp.setInput("input[name='card_holder_name']", "Test User");
      await sleep(500);
      
      // Click pay button
      const clicked = await cdp.clickText("Pay");
      if (!clicked) return { ok: false, reason: "Card pay button not found" };
    } else {
      // Mobile money / bank payment flow
      const ready = await cdp.waitFor("document.querySelector('#test-number')", 30_000);
      if (!ready) return { ok: false, reason: "checkout form never rendered" };
      
      await cdp.setInput("#test-number", phone);
      await sleep(500);
      
      // Select payment method if prompted
      await cdp.clickText("Test Bank Payment");
      await sleep(1000);
      
      // Click the pay button
      const clicked = await cdp.clickText("Pay using Test Mode");
      if (!clicked) {
        await cdp.clickText("Pay");
      }
      if (!clicked) return { ok: false, reason: "'Pay' button not found" };
      
      // Wait for OTP if required
      const otpReady = await cdp.waitFor("document.querySelector('input[type=number]')", 10_000);
      if (otpReady) {
        await cdp.setInput("input[type=number]", "12345"); // Test OTP
        await sleep(500);
        await cdp.clickText("Verify");
        await sleep(500);
        await cdp.clickText("Confirm");
      }
    }
    
    await sleep(5000);
    return { ok: true, reason: "" };
  };

  try {
    // ── Wait for the server ─────────────────────────────────────────────────
    const deadline = Date.now() + 60_000;
    let up = false;
    while (Date.now() < deadline) {
      try {
        const r = await fetch(`${BASE}/api/courses`);
        if (r.ok) {
          up = true;
          break;
        }
      } catch {
        /* not up yet */
      }
      await sleep(500);
    }
    check("app server is up", up, BASE);
    if (!up) throw new Error("app server did not start");

    // ══ 1. Registration over the real HTTP API ═════════════════════════════
    console.log("\n1) Registration → course → schedule → server-side price");
    const reg = await register("happy");
    check("POST /api/registrations → 201", reg.status === 201, reg);
    check("price computed server-side", reg.body.amount === price, { got: reg.body.amount, expected: price });

    const app1 = await prisma.application.findUnique({
      where: { referenceId: reg.body.referenceId },
      include: { payment: true },
    });
    check("DATABASE: Application PENDING_PAYMENT", app1?.status === "PENDING_PAYMENT", app1?.status);
    check(
      "DATABASE: Payment PENDING with server price",
      app1?.payment?.status === "PENDING" && app1?.payment?.amount === price,
      app1?.payment
    );
    const txRef = app1!.payment!.txRef!;
    check("DATABASE: server-generated tx_ref", /^NALIK-/.test(txRef), txRef);

    // ══ 2. init ════════════════════════════════════════════════════════════
    console.log("\n2) POST /api/payments/chapa/init");
    const initRes = await fetch(`${BASE}/api/payments/chapa/init`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ referenceId: reg.body.referenceId }),
    });
    const init = (await initRes.json()) as Record<string, any>;
    check("init never leaks the secret key", !JSON.stringify(init).includes(secret.slice(0, 20)), "leaked");
    if (process.env.CHAPA_PUBLIC_KEY) {
      check("init 200", initRes.status === 200, init);
      check("init amount is the DB amount", init.amount === price, init.amount);
      check("init reuses the registration tx_ref", init.txRef === txRef, { init: init.txRef, reg: txRef });
    } else {
      skip("init 200 / amount / tx_ref", "CHAPA_PUBLIC_KEY not configured");
      check("init fails safely (503) without the public key", initRes.status === 503, { status: initRes.status, init });
    }

    // ══ 3. Real TEST transaction ═══════════════════════════════════════════
    console.log("\n3) Chapa TEST transaction (real api.chapa.co — no money)");
    const tx = await createChapaTransaction(txRef, reg.body.referenceId, emails[0]);
    check("transaction created", tx.status === 200 && !!tx.checkoutUrl, tx.body);
    const before = await rawVerify(txRef);
    check("Chapa reports it as test mode", before.body?.data?.mode === "test", before.body?.data?.mode);
    check("Chapa reports it unpaid", ["pending", "failed"].includes(before.body?.data?.status ?? ""), before.body?.data?.status);

    // ══ 4. Pay it in a real browser ════════════════════════════════════════
    console.log("\n4) Paying the TEST checkout in Chrome (redirects to /payment/return)");
    await Cdp.launch("/usr/bin/google-chrome", CHROME_PORT);
    const pay = await payInBrowser(tx.checkoutUrl!, SUCCESS_PHONE, true); // Use card payment
    check("checkout submitted", pay.ok, pay.reason);

    // The student lands back on our return page, which polls server verify.
    const returned = await cdp!.waitFor(`location.pathname.startsWith('/payment/return')`, 45_000);
    check("browser redirected to /payment/return", returned, await cdp!.url());
    const shownSuccess = await cdp!.waitFor(`document.body.innerText.includes('Payment Successful')`, 45_000);
    check("return page shows 'Payment Successful' (server-verified)", shownSuccess, (await cdp!.pageText()).slice(0, 160));

    // ══ 5. Neon reflects PAID ══════════════════════════════════════════════
    console.log("\n5) Neon DB final state");
    const chapaState = await rawVerify(txRef);
    check("Chapa says the payment succeeded", chapaState.body?.data?.status === "success", chapaState.body?.data?.status);

    const paidApp = await prisma.application.findUnique({
      where: { referenceId: reg.body.referenceId },
      include: { payment: true },
    });
    check("DATABASE: Payment SUCCESS", paidApp?.payment?.status === "SUCCESS", paidApp?.payment?.status);
    check("DATABASE: Application PAID", paidApp?.status === "PAID", paidApp?.status);
    check("DATABASE: paidAt recorded", Boolean(paidApp?.payment?.paidAt), paidApp?.payment?.paidAt);
    check("DATABASE: Chapa reference stored", Boolean(paidApp?.payment?.chapaReference), paidApp?.payment?.chapaReference);
    const sched1 = await prisma.schedule.findUnique({ where: { id: schedule.id } });
    check("DATABASE: seat booked exactly once", sched1?.enrolled === enrolledBefore + 1, {
      before: enrolledBefore,
      after: sched1?.enrolled,
    });

    // ══ 6. Signed webhook delivery is idempotent ══════════════════════════
    console.log("\n6) Signed webhook → re-verify → idempotent");
    if (!webhookSecret) {
      skip("webhook signature path", "CHAPA_WEBHOOK_SECRET not configured");
    } else {
      const payload = JSON.stringify({
        event: "charge.success",
        type: "API",
        status: "success",
        tx_ref: txRef,
        amount: price,
        currency: "ETB",
        reference: chapaState.body?.data?.reference,
      });
      const signature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");
      const whRes = await fetch(`${BASE}/api/webhooks/chapa`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-chapa-signature": signature },
        body: payload,
      });
      check("webhook acknowledged 200", whRes.status === 200, whRes.status);

      const sched2 = await prisma.schedule.findUnique({ where: { id: schedule.id } });
      check("webhook does NOT double-book the seat", sched2?.enrolled === enrolledBefore + 1, sched2?.enrolled);
      const after = await prisma.application.findUnique({ where: { referenceId: reg.body.referenceId } });
      check("webhook keeps Application PAID", after?.status === "PAID", after?.status);

      const badRes = await fetch(`${BASE}/api/webhooks/chapa`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-chapa-signature": "0".repeat(64) },
        body: payload,
      });
      check("unsigned/forged webhook rejected 401", badRes.status === 401, badRes.status);
    }

    // ══ 7. LIVE failed payment stays unpaid ═══════════════════════════════
    console.log("\n7) LIVE failed payment (test number that Chapa always fails)");
    const regFail = await register("failed");
    const appFail = await prisma.application.findUnique({
      where: { referenceId: regFail.body.referenceId },
      include: { payment: true },
    });
    const txFail = await createChapaTransaction(appFail!.payment!.txRef!, regFail.body.referenceId, emails[1]);
    check("failed-path transaction created", !!txFail.checkoutUrl, txFail.body);
    await cdp!.navigate(txFail.checkoutUrl!);
    await cdp!.waitFor("document.querySelector('#test-number')", 30_000);
    await cdp!.clickText("Accept");
    await cdp!.setInput("#test-number", FAILURE_PHONE);
    await sleep(500);
    await cdp!.clickText("Pay using Test Mode");

    let failState: string | undefined;
    const failDeadline = Date.now() + 60_000;
    while (Date.now() < failDeadline) {
      await sleep(3000);
      const r = await rawVerify(appFail!.payment!.txRef!);
      failState = r.body?.data?.status;
      if (failState === "failed" || failState === "success") break;
    }
    check("Chapa reports the payment as failed", failState === "failed", failState ?? "timed out");

    await verifyApp(regFail.body.referenceId);
    const appFailAfter = await prisma.application.findUnique({
      where: { referenceId: regFail.body.referenceId },
      include: { payment: true },
    });
    check("DATABASE: failed payment is FAILED", appFailAfter?.payment?.status === "FAILED", appFailAfter?.payment?.status);
    check("DATABASE: failed registration stays PENDING_PAYMENT", appFailAfter?.status === "PENDING_PAYMENT", appFailAfter?.status);
    const sched3 = await prisma.schedule.findUnique({ where: { id: schedule.id } });
    check("DATABASE: failed payment books no seat", sched3?.enrolled === enrolledBefore + 1, sched3?.enrolled);

    // ══ 8. LIVE abandoned checkout stays unpaid ═══════════════════════════
    console.log("\n8) Abandoned checkout (student closes/leaves without paying)");
    const regQuit = await register("abandoned");
    const appQuit = await prisma.application.findUnique({
      where: { referenceId: regQuit.body.referenceId },
      include: { payment: true },
    });
    const txQuit = await createChapaTransaction(appQuit!.payment!.txRef!, regQuit.body.referenceId, emails[2]);
    await cdp!.navigate(txQuit.checkoutUrl!); // opens checkout, never pays
    await cdp!.waitFor("document.querySelector('#test-number')", 30_000);
    await cdp!.navigate(`${BASE}/`); // student leaves
    await verifyApp(regQuit.body.referenceId);
    const appQuitAfter = await prisma.application.findUnique({
      where: { referenceId: regQuit.body.referenceId },
      include: { payment: true },
    });
    check("DATABASE: abandoned checkout is not SUCCESS", appQuitAfter?.payment?.status !== "SUCCESS", appQuitAfter?.payment?.status);
    check("DATABASE: abandoned registration stays PENDING_PAYMENT", appQuitAfter?.status === "PENDING_PAYMENT", appQuitAfter?.status);
    check("DATABASE: abandoned checkout books no seat", (await prisma.schedule.findUnique({ where: { id: schedule.id } }))?.enrolled === enrolledBefore + 1);

    // ══ 9. Retry reuses the same registration ═════════════════════════════
    console.log("\n9) Retry after failure reuses the registration (no duplicate)");
    const retryRes = await fetch(`${BASE}/api/payments/chapa/init`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ referenceId: regFail.body.referenceId, rotate: true }),
    });
    const retry = (await retryRes.json()) as Record<string, any>;
    if (process.env.CHAPA_PUBLIC_KEY) {
      check("retry mints a fresh tx_ref", retry.txRef && retry.txRef !== appFail!.payment!.txRef, retry.txRef);
    } else {
      skip("retry tx_ref rotation", "CHAPA_PUBLIC_KEY not configured");
    }
    const dupRes = await fetch(`${BASE}/api/registrations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Live E2E duplicate",
        email: emails[1],
        phone: "+251911223344",
        age: 23,
        courseId: course.id,
        scheduleId: schedule.id,
      }),
    });
    const dup = (await dupRes.json()) as Record<string, any>;
    check("re-registering the same student/course → 409", dupRes.status === 409, { status: dupRes.status, dup });
    check("409 returns the existing referenceId", dup.referenceId === regFail.body.referenceId, dup.referenceId);
    const appCount = await prisma.application.count({ where: { email: emails[1] } });
    check("DATABASE: exactly one registration for the retrying student", appCount === 1, appCount);
  } finally {
    console.log("\nCleanup…");
    try {
      await cdp?.close();
    } catch {
      /* ignore */
    }
    if (emails.length) await prisma.application.deleteMany({ where: { email: { in: emails } } });
    await prisma.schedule.update({ where: { id: schedule.id }, data: { enrolled: enrolledBefore } });
    await prisma.$disconnect();
    try {
      process.kill(-server.pid!, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
    try {
      spawn("bash", ["-lc", `pkill -f "remote-debugging-port=${CHROME_PORT}" || true`], { stdio: "ignore" });
    } catch {
      /* ignore */
    }
    console.log("cleanup done");
  }

  console.log(`\n───────────────\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("FAILURES:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("LIVE e2e crashed:", err);
  process.exit(1);
});
