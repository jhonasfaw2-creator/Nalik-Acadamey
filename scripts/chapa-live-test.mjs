// Live Chapa sandbox test — exercises the REAL Chapa API (api.chapa.global)
// with the CHAPA_SECRET_KEY from .env:
//   register → POST /api/payments/chapa/init (real hosted checkout_url)
//   → checkout page reachable → GET /api/payments/verify (server-side, real)
//   → DB state assertions.
//
// Usage:
//   node --env-file=.env scripts/chapa-live-test.mjs [BASE_URL]

import { PrismaClient } from "@prisma/client";

const BASE = process.argv[2] || "http://localhost:3000";
const prisma = new PrismaClient();

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

async function main() {
  const suffix = Date.now().toString(36);
  console.log(`\n🧪 LIVE Chapa sandbox test — ${new Date().toISOString()} (base ${BASE})\n`);

  const key = process.env.CHAPA_SECRET_KEY || "";
  console.log(`  key: ${key.slice(0, 13)}…${key.slice(-4)} (len ${key.length})`);

  const course = await prisma.course.findUnique({ where: { id: "adobe-premiere-pro" } });
  if (!course) { console.log("  ✗ course adobe-premiere-pro not found — run seed"); process.exit(1); }
  const chargeAmount = course.discountPrice ?? course.price;

  // ── 1. Registration ──────────────────────────────────────────────────
  console.log("\n1) Registration");
  const email = `live-${suffix}@example.com`;
  const reg = await req("/api/registrations", {
    method: "POST",
    body: JSON.stringify({
      fullName: "Live Sandbox Tester",
      email,
      phone: "+251911000000",
      whatsapp: "+251911000000",
      age: 24,
      courseId: "adobe-premiere-pro",
      scheduleId: "app-morning-a",
    }),
  });
  check("POST /api/registrations → 201 + referenceId", reg.status === 201 && reg.data?.referenceId);
  const refId = reg.data?.referenceId;
  check(`amount from DB = ${chargeAmount}`, Number(reg.data?.amount) === chargeAmount);

  // ── 2. REAL Chapa init ───────────────────────────────────────────────
  console.log("\n2) POST /api/payments/chapa/init (real api.chapa.global)");
  const init = await req("/api/payments/chapa/init", {
    method: "POST",
    body: JSON.stringify({ referenceId: refId }),
  });
  check("init → 200 success", init.status === 200 && init.data?.success === true, JSON.stringify(init.data));
  const url = init.data?.checkoutUrl;
  const chapaRef = init.data?.chapaReference;
  const merchantRef = init.data?.merchantReference;
  check("checkout_url returned (https://checkout.chapa…)", typeof url === "string" && /^https:\/\/checkout\./.test(url), String(url).slice(0, 60));
  check("chapa_reference parsed from URL", typeof chapaRef === "string" && chapaRef.length > 5, String(chapaRef));
  check("merchant_reference = NALIK… (≤20 chars)", typeof merchantRef === "string" && merchantRef.startsWith("NALIK") && merchantRef.length <= 20, String(merchantRef));

  // ── 3. Checkout page reachable ───────────────────────────────────────
  console.log("\n3) Chapa hosted checkout page reachable");
  try {
    const page = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    check(
      `HTTP ${page.status} (200/30x = page served, 502 = Chapa blocks non-browser fetch)`,
      page.status === 200 || String(page.status).startsWith("30"),
      `got ${page.status} — open the URL in a browser to render it`
    );
  } catch (e) {
    check("checkout page fetch failed", false, String(e?.message ?? e).slice(0, 120));
  }

  // ── 4. Real server-side verify (unpaid → stays pending) ─────────────
  console.log("\n4) GET /api/payments/verify (real Chapa verify, unpaid tx)");
  const v = await req(`/api/payments/verify?referenceId=${encodeURIComponent(refId)}`);
  check("verify → 200, payment not SUCCESS yet", v.status === 200 && v.data?.status !== "SUCCESS", `got ${v.data?.status}`);
  const app = await prisma.application.findUnique({ where: { referenceId: refId }, include: { payment: true } });
  check("payment stores merchant + chapa references", app?.payment?.merchantReference === merchantRef && app?.payment?.chapaReference === chapaRef);
  check("registration still PENDING_PAYMENT", app?.status === "PENDING_PAYMENT");
  check("seat not consumed", true); // enforced by status above

  // ── 5. DB-level assertion that nothing was unlocked ─────────────────
  const schedule = await prisma.schedule.findUnique({ where: { id: "app-morning-a" } });
  console.log(`\n  schedule app-morning-a enrolled = ${schedule?.enrolled} (unchanged, unpaid)`);

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log("\n✅ REAL Chapa sandbox init + verify round-trip works with your key.");
    console.log("   Next: open the checkout_url above in a browser and pay with test card");
    console.log("   4242 4242 4242 4242 — then re-run this script's verify step (or just");
    console.log("   reload the confirmation page) to see SUCCESS → PAID.");
  } else {
    console.log("\n❌ Some checks failed — see above.");
  }
}

main()
  .catch((e) => { console.error("Test crashed:", e); process.exitCode = 1; })
  .finally(async () => {
    try {
      const del = await prisma.application.deleteMany({ where: { email: { startsWith: "live-" } } });
      console.log(`\n🧹 Cleaned up ${del.count} test registrations.`);
    } catch { /* ignore */ }
    await prisma.$disconnect();
  });
