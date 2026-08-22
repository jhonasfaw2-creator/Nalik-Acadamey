import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function resolveLibsqlAdapter(databaseUrl: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const libsqlModule = require("@prisma/adapter-libsql");
  const PrismaLibSql =
    libsqlModule.PrismaLibSql ??
    libsqlModule.PrismaLibSQL ??
    libsqlModule.default?.PrismaLibSql ??
    libsqlModule.default?.PrismaLibSQL;

  if (!PrismaLibSql) {
    throw new Error("@prisma/adapter-libsql did not export PrismaLibSql");
  }

  return new PrismaLibSql({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

function resolveSqliteAdapter(databaseUrl: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqliteModule = require("@prisma/adapter-better-sqlite3");
  const PrismaBetterSqlite3 =
    sqliteModule.PrismaBetterSqlite3 ??
    sqliteModule.default?.PrismaBetterSqlite3 ??
    sqliteModule.default ??
    sqliteModule;

  if (!PrismaBetterSqlite3) {
    throw new Error("@prisma/adapter-better-sqlite3 did not export PrismaBetterSqlite3");
  }

  return new PrismaBetterSqlite3({
    url: databaseUrl,
  });
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";

  if (databaseUrl.startsWith("libsql://") || databaseUrl.startsWith("https://")) {
    return new PrismaClient({ adapter: resolveLibsqlAdapter(databaseUrl) });
  }

  return new PrismaClient({ adapter: resolveSqliteAdapter(databaseUrl) });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}