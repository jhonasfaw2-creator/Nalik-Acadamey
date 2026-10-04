#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verifySchema() {
  const columns = await prisma.$queryRaw`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name IN ('Registration', 'Transaction')
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
    "Transaction.id",
    "Transaction.registrationId",
    "Transaction.amount",
    "Transaction.currency",
    "Transaction.txRef",
    "Transaction.chapaReference",
    "Transaction.status",
    "Transaction.createdAt",
    "CourseMaterial.id",
    "CourseMaterial.courseId",
    "CourseMaterial.title",
    "CourseMaterial.fileUrl",
    "CourseMaterial.fileType",
    "CourseMaterial.sortOrder",
  ];

  const missingColumns = requiredColumns.filter((column) => !availableColumns.has(column));
  if (missingColumns.length > 0) {
    throw new Error(`Missing required schema columns: ${missingColumns.join(", ")}`);
  }

  const foreignKeys = await prisma.$queryRaw`
    SELECT constraint_row.confdeltype AS "deleteAction"
    FROM pg_constraint AS constraint_row
    JOIN pg_class AS source_table
      ON source_table.oid = constraint_row.conrelid
    JOIN pg_namespace AS source_schema
      ON source_schema.oid = source_table.relnamespace
    JOIN pg_class AS target_table
      ON target_table.oid = constraint_row.confrelid
    JOIN pg_attribute AS source_column
      ON source_column.attrelid = source_table.oid
      AND source_column.attnum = constraint_row.conkey[1]
    WHERE constraint_row.contype = 'f'
      AND source_schema.nspname = current_schema()
      AND source_table.relname = 'Transaction'
      AND source_column.attname = 'registrationId'
      AND target_table.relname = 'Registration'
  `;

  if (!foreignKeys.some(({ deleteAction }) => deleteAction === "c")) {
    throw new Error(
      "Missing Transaction.registrationId foreign key to Registration with cascade delete.",
    );
  }

  console.log("Database schema verification passed.");
  console.log("Registration and Transaction tables, required columns, and cascade relation exist.");
}

verifySchema()
  .catch((error) => {
    console.error("Database schema verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
