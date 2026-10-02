/**
 * LIVE Chapa v2 TEST-environment smoke test — no mocks. Talks to the real
 * api.chapa.global using the v2 TEST credentials configured in .env.
 *
 * What it proves against the REAL Chapa TEST API:
 *   1. Registration → server-side price → PENDING_PAYMENT + merchant_reference.
 *   2. Init creates a v2 hosted checkout URL using the server key.
 *   3. V2 verification keeps an unpaid session PENDING.
 *   5. With --pay: pay the sandbox transaction on Chapa's hosted checkout, then
 *      our verify moves the DB to SUCCESS → PAID (idempotently).
 *
 * No real money: TEST keys only ever create sandbox transactions, and the
 * script refuses to run with a live key.
 *
 * Run: npx tsx scripts/chapa-live-smoke.ts [--pay]
 */
import { readFileSync } from "node:fs";

// ── Load .env (Next does this automatically; a raw script does not) ──────────
// Chapa keys are ALWAYS taken from .env: if a stale CHAPA_* value is already
// present in the shell environment, it takes precedence in the app at runtime
// and silently breaks payments, so this script makes the substitution visible.
const fromFile = new Map<string, string>();
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  } else {
    // Strip an inline comment. Next's dotenv parser does this too; a naive
    // parser that keeps it would send "CHASECK_TEST-…   # note" as the key and
    // every Chapa call would 401.
    v = v.split(/\s+#/)[0].trim();
  }
  fromFile.set(m[1], v);
}
for (const [key, value] of fromFile) {
  const inherited = process.env[key];
  if (key.startsWith("CHAPA_")) {
    if (inherited && inherited !== value) {
      console.warn(`! ${key}: overriding inherited value (${inherited.slice(0, 14)}…) with the .env value`);
    }
    process.env[key] = value;
  } else if (!(key in process.env)) {
    process.env[key] = value;
  }
}

// Hard safety gate: this script talks to the REAL api.chapa.global, so it must
// never run with a live key (that would move real money).
//   test format: CHAPA_TEST_…
//   live format: CHAPA_LIVE_…
const secretKey = process.env.CHAPA_SECRET_KEY || "";
if (!/^CHAPA[-_]TEST[-_]/i.test(secretKey) || /^CHAPA[-_]LIVE[-_]/i.test(secretKey)) {
  console.error(
    "Refusing to run: CHAPA_SECRET_KEY must be a v2 TEST-mode key (CHAPA_TEST_…). Found:\n  " +
      (secretKey ? `${secretKey.slice(0, 14)}… (${secretKey.length} chars)` : "(unset)")
  );
  process.exit(1);
}
console.log(`Using TEST credentials: ${secretKey.slice(0, 14)}…`);

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
const chapaAuth = { Authorization: `Bearer ${secretKey}` };

async function rawVerify(chapaReference: string) {
  const res = await fetch(`https://api.chapa.global/v2/payments/${encodeURIComponent(chapaReference)}/verify`, {
    headers: chapaAuth,
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, any> | null };
}

async function main() {
  const { NextRequest } = await import("next/server");
  const { prisma } = await import("@/lib/prisma");
  const { POST: registerRoute } = await import("@/app/api/registrations/route");
  const { POST: initRoute } = await import("@/app/api/payments/chapa/init/route");
  const { GET: verifyRoute } = await import("@/app/api/payments/verify/route");

  const jsonReq = (url: string, body: unknown) =>
    new NextRequest(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const verifyApp = (referenceId: string) =>
    verifyRoute(new NextRequest(`http://localhost/api/payments/verify?referenceId=${referenceId}`));

  const course = await prisma.course.findFirst({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  const schedule = await prisma.schedule.findFirst({ where: { active: true } });
  if (!course || !schedule) throw new Error("No active course/schedule — seed the DB first.");
  const price = course.discountPrice ?? course.price;
  const enrolledBefore = schedule.enrolled;
  console.log(`\nLIVE TEST MODE — course="${course.title}" price=${price} ETB\n`);

  // ══ 1. Registration (real route, real DB) ══════════════════════════════════
  console.log("1) Registration → server-side price");
  const email = `livetest-${Date.now()}@gmail.com`;
  const regRes = await registerRoute(
    jsonReq("http://localhost/api/registrations", {
      fullName: "Live Smoke Test",
      email,
      phone: "+251911223344",
      age: 24,
      courseId: course.id,
      scheduleId: schedule.id,
    })
  );
  const reg = await regRes.json();
  check("registration created (201)", regRes.status === 201, reg);
  check("server-calculated price", reg.amount === price, { got: reg.amount, expected: price });

  const app = await prisma.application.findUnique({
    where: { referenceId: reg.referenceId },
    include: { payment: true },
  });
  check("DATABASE: PENDING_PAYMENT", app?.status === "PENDING_PAYMENT", app?.status);
  check(
    "DATABASE: payment PENDING with server price",
    app?.payment?.status === "PENDING" && app?.payment?.amount === price,
    app?.payment
  );
  const merchantReference = app!.payment!.txRef!;

  try {
    // ══ 2. v2 hosted init ═══════════════════════════════════════════════════
    console.log("\n2) v2 hosted checkout init");
    const initRes = await initRoute(jsonReq("http://localhost/api/payments/chapa/init", { referenceId: reg.referenceId }));
    const init = await initRes.json();
    check("init never returns the secret key", !JSON.stringify(init).includes(secretKey.slice(0, 20)), "leaked");
    check("init returns 200", initRes.status === 200, init);
    check("init returns hosted checkout URL", typeof init.checkoutUrl === "string" && init.checkoutUrl.startsWith("https://checkout.chapa."), init.checkoutUrl);
    check("init preserves merchant_reference", init.merchantReference === merchantReference, init.merchantReference);
    const paymentAfterInit = await prisma.payment.findUnique({ where: { applicationId: app!.id } });
    const chapaReference = paymentAfterInit?.chapaReference;

    // ══ 3. V2 verify, when Chapa returns its reference during initialization ═
    console.log("\n3) V2 verify pending hosted checkout");
    if (chapaReference) {
      const raw0 = await rawVerify(chapaReference);
      console.log(`  (raw Chapa v2 verify: HTTP ${raw0.status} status=${raw0.body?.data?.status})`);
      check("raw v2 verify succeeds", raw0.status === 200, raw0.status);
      check("raw v2 status is pending", raw0.body?.data?.status === "pending", raw0.body?.data?.status);
    } else {
      skip("raw v2 verify", "Chapa reference will arrive via webhook");
    }
    const v0Res = await verifyApp(reg.referenceId);
    const v0 = await v0Res.json();
    check("our verify returns 200 while pending", v0Res.status === 200, { status: v0Res.status, v0 });
    check("our verify reports PENDING", v0.status === "PENDING", v0.status);

    const checkoutUrl = init.checkoutUrl as string | undefined;
    check("verify stays PENDING for an unpaid hosted transaction", v0.status === "PENDING", v0.status);
    const appAfter = await prisma.application.findUnique({ where: { referenceId: reg.referenceId } });
    check("DATABASE: still PENDING_PAYMENT (never falsely PAID)", appAfter?.status === "PENDING_PAYMENT", appAfter?.status);

    // ══ 6. Pay the sandbox transaction, then let our verify settle it ═══════
    if (!process.argv.includes("--pay")) {
      console.log("\n6) Paying the sandbox transaction: SKIPPED (pass --pay to run it).");
      console.log(`   Payable TEST checkout (no real money):\n   ${checkoutUrl}`);
    } else {
      console.log("\n6) Paying the sandbox transaction…");
      console.log(`   Open and complete the TEST payment here:\n   ${checkoutUrl}\n`);
      const deadline = Date.now() + 10 * 60 * 1000;
      let outcome: string | undefined;
      while (Date.now() < deadline) {
        await sleep(5000);
        const r = await (await verifyApp(reg.referenceId)).json();
        outcome = String(r.status || "").toUpperCase();
        process.stdout.write(`   … status=${outcome}\n`);
        if (["SUCCESS", "FAILED", "CANCELLED", "INCOMPLETE"].includes(outcome)) break;
      }
      check("sandbox payment reported success by Chapa", outcome === "SUCCESS", outcome || "not paid within 10 minutes");

      if (outcome === "SUCCESS") {
        const v2 = await (await verifyApp(reg.referenceId)).json();
        check("our verify reports SUCCESS", v2.status === "SUCCESS", v2.status);
        const finalApp = await prisma.application.findUnique({
          where: { referenceId: reg.referenceId },
          include: { payment: true },
        });
        check("DATABASE: payment SUCCESS", finalApp?.payment?.status === "SUCCESS", finalApp?.payment?.status);
        check("DATABASE: application PAID", finalApp?.status === "PAID", finalApp?.status);
        check("DATABASE: paidAt recorded", Boolean(finalApp?.payment?.paidAt), finalApp?.payment?.paidAt);
        check("DATABASE: Chapa reference stored", Boolean(finalApp?.payment?.chapaReference), finalApp?.payment?.chapaReference);
        const sched2 = await prisma.schedule.findUnique({ where: { id: schedule.id } });
        check("DATABASE: seat incremented exactly once", sched2?.enrolled === enrolledBefore + 1, {
          before: enrolledBefore,
          after: sched2?.enrolled,
        });
        const v3 = await (await verifyApp(reg.referenceId)).json();
        const sched3 = await prisma.schedule.findUnique({ where: { id: schedule.id } });
        check(
          "re-verify is idempotent (SUCCESS stays, seat unchanged)",
          v3.status === "SUCCESS" && sched3?.enrolled === enrolledBefore + 1,
          { status: v3.status, enrolled: sched3?.enrolled }
        );
      }
    }
  } finally {
    console.log("\nCleanup…");
    await prisma.application.deleteMany({ where: { email } });
    await prisma.schedule.update({ where: { id: schedule.id }, data: { enrolled: enrolledBefore } });
    await prisma.$disconnect();
  }

  console.log(`\n───────────────\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("FAILURES:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Live smoke test crashed:", err);
  process.exit(1);
});
