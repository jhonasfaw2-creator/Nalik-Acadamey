/**
 * Tests admin compatibility: course/schedule reassignment via the admin API
 * reflects in the public lookup, and seat bookkeeping stays correct.
 * Usage: npx tsx scripts/e2e-lookup-admin-test.mjs <referenceId>
 * Requires ADMIN_PASSWORD from .env and the test server on :3122.
 */
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

// Minimal .env loader (tsx doesn't auto-load .env and dotenv isn't a dependency).
for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const BASE = process.env.E2E_BASE_URL || "http://localhost:3122";
const ref = process.argv[2];
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
};

// ── Login as admin ──
const login = await fetch(`${BASE}/api/admin/auth`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
});
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
check("admin login", login.status === 200 && cookie, `status=${login.status}`);
const authHeaders = { "content-type": "application/json", cookie };

// ── Grab target registration + an alternative schedule ──
const app = await prisma.application.findUnique({
  where: { referenceId: ref },
  include: { schedule: true, course: true },
});
const otherSchedule = await prisma.schedule.findFirst({
  where: { active: true, id: { not: app.scheduleId }, enrolled: { lt: 15 } },
});
const otherCourse = await prisma.course.findFirst({ where: { active: true, id: { not: app.courseId } } });
if (!otherSchedule || !otherCourse) { console.error("Need alternate course + schedule"); process.exit(1); }

const beforeSeats = {
  old: (await prisma.schedule.findUnique({ where: { id: app.scheduleId } })).enrolled,
  new: (await prisma.schedule.findUnique({ where: { id: otherSchedule.id } })).enrolled,
};

console.log("\n── Admin reassignment (course + schedule) ──");
const put = await fetch(`${BASE}/api/admin/registrations/${app.id}`, {
  method: "PUT",
  headers: authHeaders,
  body: JSON.stringify({ courseId: otherCourse.id, scheduleId: otherSchedule.id }),
});
check("PUT reassignment succeeds", put.status === 200, `status=${put.status} ${await put.text()}`);

const afterSeats = {
  old: (await prisma.schedule.findUnique({ where: { id: app.scheduleId } })).enrolled,
  new: (await prisma.schedule.findUnique({ where: { id: otherSchedule.id } })).enrolled,
};
check(`old session seat decremented (${beforeSeats.old}→${afterSeats.old})`, afterSeats.old === beforeSeats.old - 1);
check(`new session seat incremented (${beforeSeats.new}→${afterSeats.new})`, afterSeats.new === beforeSeats.new + 1);

console.log("\n── Public lookup reflects admin change ──");
const lookup = await (await fetch(`${BASE}/api/registrations/lookup?id=${ref}`)).json();
check("course updated", lookup.registration?.course === otherCourse.title, lookup.registration?.course);
check(
  "schedule updated",
  lookup.registration?.schedule?.startTime === otherSchedule.startTime &&
    lookup.registration?.schedule?.days === otherSchedule.days,
  JSON.stringify(lookup.registration?.schedule)
);

console.log("\n── Schedule startDate change reflects ──");
const newStart = "2026-11-02";
const putSched = await fetch(`${BASE}/api/admin/schedules`, {
  method: "PUT",
  headers: authHeaders,
  body: JSON.stringify({ id: otherSchedule.id, startDate: newStart }),
});
check("admin can set schedule startDate", putSched.status === 200, `status=${putSched.status}`);
const lookup2 = await (await fetch(`${BASE}/api/registrations/lookup?id=${ref}`)).json();
check(
  "lookup shows new start date",
  (lookup2.registration?.schedule?.startDate || "").startsWith(newStart),
  lookup2.registration?.schedule?.startDate
);

console.log("\n── Unauthenticated admin API is rejected ──");
const anon = await fetch(`${BASE}/api/admin/registrations/${app.id}`, {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ status: "CONFIRMED" }),
});
check("anonymous PUT → 401", anon.status === 401, `status=${anon.status}`);

console.log(`\n════════ RESULT: ${pass} passed, ${fail} failed ════════`);
await prisma.$disconnect();
process.exit(fail === 0 ? 0 : 1);
