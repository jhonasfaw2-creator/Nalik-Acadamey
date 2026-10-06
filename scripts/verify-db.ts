import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verifyDatabase() {
  await Promise.all([
    prisma.course.count(),
    prisma.schedule.count(),
    prisma.registration.count(),
  ]);
  console.log("Registration, course, and schedule database queries passed.");
}

verifyDatabase()
  .catch((error) => {
    console.error("Database verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
