/**
 * E2E tests for the three admin features:
 *   1. Password change (Settings → Change Password)
 *   2. Manual student enrollment (Registrations → Add Student)
 *   3. Schedule availability marking (Schedules → Available/Full)
 * Usage: E2E_BASE_URL=http://localhost:3124 npx tsx scripts/e2e-admin-features-test.mjs
 * Requires ADMIN_PASSWORD from .env. Restores state at the end.
 */
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const BASE = process.env.E2E_BASE_URL || "http://localhost:3124";
const prisma = new PrismaClient();
let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
};

// ── Login with the original (env) password ──
const login = await fetch(`${BASE}/api/admin/auth`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
});
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
check("login with current (temporary) password", login.status === 200, `status=${login.status}`);
const auth = { "content-type": "application/json", cookie };

console.log("\n── 1. Change Admin Password ──");
const change = await fetch(`${BASE}/api/admin/password`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({ currentPassword: process.env.ADMIN_PASSWORD, newPassword: "brand-new-pw-2026" }),
});
const changeData = await change.json().catch(() => ({}));
check("change succeeds", change.status === 200 && changeData.success, JSON.stringify(changeData));

const wrongPw = await fetch(`${BASE}/api/admin/auth`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
});
check("old (env) password no longer works", wrongPw.status === 401, `status=${wrongPw.status}`);

const newPw = await fetch(`${BASE}/api/admin/auth`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ password: "brand-new-pw-2026" }),
});
const newCookie = (newPw.headers.get("set-cookie") || "").split(";")[0];
check("new password works", newPw.status === 200, `status=${newPw.status}`);

const unauthChange = await fetch(`${BASE}/api/admin/password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ currentPassword: "x".repeat(8), newPassword: "y".repeat(8) }),
});
check("password change requires session", unauthChange.status === 401, `status=${unauthChange.status}`);

// ── Switch test session to the new password's cookie ──
auth.cookie = newCookie;

// Restore: clear DB hash so env password works again (keeps deployments consistent).
const restored = await fetch(`${BASE}/api/admin/password`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({ currentPassword: "brand-new-pw-2026", newPassword: process.env.ADMIN_PASSWORD }),
});
check("password restorable (change back)", restored.status === 200, `status=${restored.status}`);

console.log("\n── 2. Manual Students ──");
const course = await prisma.course.findFirst({ where: { active: true }, orderBy: { sortOrder: "asc" } });
const schedule = await prisma.schedule.findFirst({ where: { active: true, enrolled: { lt: 15 }, OR: [{ availabilityOverride: null }, { availabilityOverride: true }] } });
if (!course || !schedule) { console.error("need course+schedule"); process.exit(1); }

const email = `manual-admin-${Date.now()}@test.nalik`;
const manual = await fetch(`${BASE}/api/admin/registrations/manual`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    fullName: "Manual Student", email, phone: "+251911223344", age: 24,
    courseId: course.id, scheduleId: schedule.id, paymentStatus: "PAID",
  }),
});
const manualData = await manual.json().catch(() => ({}));
check("manual PAID enrollment created", manual.status === 201 && manualData.success, JSON.stringify(manualData));
const ref = manualData?.application?.referenceId;

const dbApp = await prisma.application.findUnique({ where: { referenceId: ref }, include: { payment: true } });
check("registration status is PAID", dbApp?.status === "PAID");
check("payment marked SUCCESS (manual)", dbApp?.payment?.status === "SUCCESS" && dbApp?.payment?.method === "manual");
const schedAfter = await prisma.schedule.findUnique({ where: { id: schedule.id } });
check("seat occupied (enrolled +1)", schedAfter.enrolled === schedule.enrolled + 1, `${schedule.enrolled}→${schedAfter.enrolled}`);

// Lookup works with the manual reference ID
const lookup = await (await fetch(`${BASE}/api/registrations/lookup?id=${ref}`)).json();
check("manual student visible on public lookup", lookup.found === true && lookup.registration.fullName === "Manual Student");
check("lookup shows PAID/ENROLLED for manual student", lookup.registration.paymentStatus === "SUCCESS");

// Pending variant
const email2 = `manual-pending-${Date.now()}@test.nalik`;
const manual2 = await fetch(`${BASE}/api/admin/registrations/manual`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    fullName: "Pending Manual", email: email2, phone: "+251911223345", age: 25,
    courseId: course.id, scheduleId: schedule.id, paymentStatus: "PENDING",
  }),
});
const manual2Data = await manual2.json().catch(() => ({}));
check("manual PENDING enrollment created", manual2.status === 201, JSON.stringify(manual2Data));
const dbApp2 = await prisma.application.findUnique({ where: { referenceId: manual2Data?.application?.referenceId }, include: { payment: true } });
check("pending manual stays PENDING_PAYMENT / PENDING", dbApp2?.status === "PENDING_PAYMENT" && dbApp2?.payment?.status === "PENDING");

const dup = await fetch(`${BASE}/api/admin/registrations/manual`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    fullName: "Dup Student", email, phone: "+251911223344", age: 24,
    courseId: course.id, scheduleId: schedule.id, paymentStatus: "PENDING",
  }),
});
check("duplicate email+course rejected (409)", dup.status === 409, `status=${dup.status}`);

const anonManual = await fetch(`${BASE}/api/admin/registrations/manual`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ fullName: "Anon", email: "a@b.co", phone: "0900000000", age: 20, courseId: course.id, scheduleId: schedule.id }),
});
check("manual enrollment requires admin session", anonManual.status === 401, `status=${anonManual.status}`);

console.log("\n── 3. Schedule Availability ──");
const target = await prisma.schedule.findFirst({ where: { id: { not: schedule.id }, enrolled: 0 } });
if (!target) { console.error("need a second schedule"); process.exit(1); }

const markFull = await fetch(`${BASE}/api/admin/schedules`, {
  method: "PUT",
  headers: auth,
  body: JSON.stringify({ id: target.id, availabilityOverride: "FULL" }),
});
check("admin can mark session Full", markFull.status === 200, `status=${markFull.status}`);

const pub = await (await fetch(`${BASE}/api/schedules`)).json();
const pubSession = pub.groups.flatMap((g) => g.sessions).find((s) => s.id === target.id);
check("public API reports marked-full session as isFull", pubSession?.isFull === true);

// Public registration against a marked-full session must be blocked.
const email3 = `blocked-${Date.now()}@test.nalik`;
const blocked = await fetch(`${BASE}/api/registrations`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ fullName: "Blocked Student", email: email3, phone: "+251911223346", age: 22, courseId: course.id, scheduleId: target.id }),
});
check("public registration blocked on marked-full session", blocked.status === 400, `status=${blocked.status} ${await blocked.text()}`);

// Manual enrollment also blocked on marked-full session.
const blockedManual = await fetch(`${BASE}/api/admin/registrations/manual`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({ fullName: "Blocked Manual", email: `bm-${Date.now()}@t.co`, phone: "0900000001", age: 22, courseId: course.id, scheduleId: target.id }),
});
check("manual enrollment blocked on marked-full session", blockedManual.status === 400, `status=${blockedManual.status}`);

const markAvail = await fetch(`${BASE}/api/admin/schedules`, {
  method: "PUT",
  headers: auth,
  body: JSON.stringify({ id: target.id, availabilityOverride: "AVAILABLE" }),
});
check("admin can mark session Available", markAvail.status === 200);

const pub2 = await (await fetch(`${BASE}/api/schedules`)).json();
const pubSession2 = pub2.groups.flatMap((g) => g.sessions).find((s) => s.id === target.id);
check("marked-Available session is selectable", pubSession2?.isFull === false);

const auto = await fetch(`${BASE}/api/admin/schedules`, {
  method: "PUT",
  headers: auth,
  body: JSON.stringify({ id: target.id, availabilityOverride: "AUTO" }),
});
check("admin can reset to Auto", auto.status === 200);

console.log("\n── Cleanup ──");
const del = await prisma.application.deleteMany({ where: { email: { in: [email, email2] } } });
console.log(`  removed ${del.count} test registrations`);
await prisma.schedule.update({ where: { id: schedule.id }, data: { enrolled: schedule.enrolled } });
await prisma.schedule.update({ where: { id: target.id }, data: { availabilityOverride: null } });
console.log("  restored seat count + availability override");

console.log(`\n════════ RESULT: ${pass} passed, ${fail} failed ════════`);
await prisma.$disconnect();
process.exit(fail === 0 ? 0 : 1);
