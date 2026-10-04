// Purge all student registration data.
//
// Deletes every Application and Payment row and resets every Schedule seat
// counter to zero. Courses, schedules, course materials, CMS content and
// settings are left untouched.
//
// This is destructive and irreversible. It runs as a DRY RUN unless you pass
// --execute, and it always writes a JSON backup of everything it removes
// immediately before deleting it.
//
//   node scripts/purge-registrations.mjs                    # dry run, changes nothing
//   node scripts/purge-registrations.mjs --execute          # backs up, then deletes
//   node scripts/purge-registrations.mjs --execute --no-backup
//   node scripts/purge-registrations.mjs --execute --reset-availability
//
// Why Schedule.enrolled is reset explicitly: it is a stored counter, not a
// derived value. Deleting applications leaves it untouched, so without this
// step every session would still report the students that were just removed and
// the booking form would show phantom full sessions.

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const EXECUTE = process.argv.includes("--execute");
const NO_BACKUP = process.argv.includes("--no-backup");
const RESET_AVAILABILITY = process.argv.includes("--reset-availability");
const ROOT = path.resolve(import.meta.dirname, "..");
const BACKUP_DIR = path.join(ROOT, "backups");

// Reads DATABASE_URL / DIRECT_URL from .env without printing them.
for (const file of [".env", ".env.local"]) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    if (process.env[key]) continue;
    process.env[key] = match[2].trim().replace(/^["']/, "").replace(/["']$/, "");
  }
}

const prisma = new PrismaClient();

// Set once the delete transaction commits, so the catch block does not claim
// "no changes were committed" when a later reporting step is what failed.
let committed = false;

/** Tables this script must never touch. */
const PRESERVED = ["Course", "Schedule", "CourseMaterial", "Content", "Setting"];

async function main() {
  console.log(EXECUTE ? "MODE: EXECUTE (destructive)" : "MODE: DRY RUN (nothing will change)");
  console.log(`Host: ${(process.env.DIRECT_URL ?? "").replace(/\/\/[^@]*@/, "//***@") || "(from DATABASE_URL)"}\n`);

  // ── Report ──────────────────────────────────────────────────────────────
  const applications = await prisma.application.count();
  const payments = await prisma.payment.count();
  const settled = await prisma.payment.findMany({
    where: { status: "SUCCESS" },
    select: { amount: true },
  });
  const settledTotal = settled.reduce((sum, row) => sum + row.amount, 0);

  console.log("WILL DELETE");
  console.log(`  Application : ${applications}`);
  console.log(`  Payment     : ${payments}  (${settled.length} settled, ${settledTotal} ETB of payment records)`);

  console.log("\nWILL PRESERVE");
  const preserved = {
    Course: await prisma.course.count(),
    Schedule: await prisma.schedule.count(),
    CourseMaterial: await prisma.courseMaterial.count(),
    Content: await prisma.content.count(),
    Setting: await prisma.setting.count(),
  };
  for (const model of PRESERVED) console.log(`  ${model.padEnd(14)}: ${preserved[model]}`);

  console.log("\nWILL RESET");
  console.log("  Schedule.enrolled -> 0  for every session");
  if (RESET_AVAILABILITY) {
    console.log("  Schedule.availabilityOverride -> NULL  (availability becomes automatic again)");
  }

  if (!EXECUTE) {
    console.log("\nThis was a dry run. Re-run with --execute to perform the purge.");
    return;
  }

  if (applications === 0 && payments === 0) {
    console.log("\nNothing to delete — already empty.");
    return;
  }

  // ── Backup ──────────────────────────────────────────────────────────────
  // Skipped only when the operator explicitly asks for it. The purge is then
  // truly irreversible.
  let backupPath = null;
  if (NO_BACKUP) {
    console.log("\nSkipping backup (--no-backup). This deletion is irreversible.");
  } else {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupPath = path.join(BACKUP_DIR, `registrations-${stamp}.json`);

    const [applicationRows, paymentRows, scheduleRows] = await Promise.all([
      prisma.application.findMany(),
      prisma.payment.findMany(),
      prisma.schedule.findMany({ select: { id: true, group: true, session: true, enrolled: true, availabilityOverride: true } }),
    ]);
    fs.writeFileSync(
      backupPath,
      JSON.stringify(
        { takenAt: new Date().toISOString(), applications: applicationRows, payments: paymentRows, schedules: scheduleRows },
        null,
        2
      )
    );
    console.log(`\nBackup written: ${path.relative(ROOT, backupPath)}`);
  }

  // ── Delete ──────────────────────────────────────────────────────────────
  // Payment is listed explicitly even though Application cascades to it, so the
  // intent is readable and the count is verifiable. Schedule.enrolled is NOT a
  // foreign key and must be reset by hand.
  const result = await prisma.$transaction(async (tx) => {
    const deletedPayments = await tx.payment.deleteMany({});
    const deletedApplications = await tx.application.deleteMany({});
    const resetSchedules = await tx.schedule.updateMany({ data: { enrolled: 0 } });
    const resetAvailability = RESET_AVAILABILITY
      ? await tx.schedule.updateMany({ data: { availabilityOverride: null } })
      : null;
    return { deletedPayments, deletedApplications, resetSchedules, resetAvailability };
  });

  committed = true;
  console.log(`\nDeleted ${result.deletedApplications.count} applications, ${result.deletedPayments.count} payments.`);
  console.log(`Reset ${result.resetSchedules.count} seat counters to 0.`);
  if (result.resetAvailability) {
    console.log(`Cleared availability overrides on ${result.resetAvailability.count} sessions.`);
  }

  // ── Verify ──────────────────────────────────────────────────────────────
  console.log("\nVERIFICATION");
  const after = {
    Application: await prisma.application.count(),
    Payment: await prisma.payment.count(),
  };
  const seats = await prisma.schedule.findMany({
    select: { group: true, session: true, enrolled: true, maxSeats: true },
    orderBy: [{ group: "asc" }, { startTime: "asc" }],
  });
  const stillPreserved = {};
  for (const model of PRESERVED) {
    const key = model[0].toLowerCase() + model.slice(1);
    stillPreserved[model] = await prisma[key].count();
  }

  console.log(`  Application rows : ${after.Application} ${after.Application === 0 ? "OK" : "STILL HAS ROWS"}`);
  console.log(`  Payment rows     : ${after.Payment} ${after.Payment === 0 ? "OK" : "STILL HAS ROWS"}`);
  console.log(`  Seat counters    : ${seats.every((s) => s.enrolled === 0) ? "all 0 OK" : "NOT ALL ZERO"}`);
  for (const seat of seats) {
    console.log(`    ${seat.group}/${seat.session.padEnd(18)} enrolled=${seat.enrolled}/${seat.maxSeats}`);
  }
  console.log("  Preserved        :");
  for (const model of PRESERVED) {
    const count = stillPreserved[model];
    const same = count === preserved[model];
    console.log(`    ${model.padEnd(14)} ${count} ${same ? "OK" : "CHANGED — INVESTIGATE"}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(
      committed
        ? "\nThe purge already committed successfully. This failure happened while printing the report:"
        : "\nPURGE FAILED — nothing was committed:"
    );
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
