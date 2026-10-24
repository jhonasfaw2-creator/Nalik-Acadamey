#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verifySchema() {
  const columns = await prisma.$queryRaw`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name IN ('Registration', 'Course', 'Schedule', 'CourseMaterial', 'Payment')
  `;

  const availableColumns = new Set(
    columns.map(({ table_name, column_name }) => `${table_name}.${column_name}`),
  );
  const requiredColumns = [
    "Registration.id",
    "Registration.fullName",
    "Registration.email",
    "Registration.phone",
    "Registration.courseId",
    "Registration.createdAt",
    "Registration.status",
    "Course.id",
    "Schedule.id",
    "CourseMaterial.id",
    "CourseMaterial.courseId",
    "CourseMaterial.title",
    "CourseMaterial.fileUrl",
    "CourseMaterial.fileType",
    "CourseMaterial.sortOrder",
    "Payment.id",
    "Payment.registrationId",
    "Payment.merchantReference",
    "Payment.amount",
    "Payment.currency",
    "Payment.status",
    "Payment.verifiedAt",
  ];

  const missingColumns = requiredColumns.filter((column) => !availableColumns.has(column));
  if (missingColumns.length > 0) {
    throw new Error(`Missing required schema columns: ${missingColumns.join(", ")}`);
  }

  console.log("Database schema verification passed.");
  console.log("Registration, course, schedule, course material, and payment tables have the required columns.");
}

verifySchema()
  .catch((error) => {
    console.error("Database schema verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
