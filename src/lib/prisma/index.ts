import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;

  // Production: use Turso (libSQL)
  if (databaseUrl?.startsWith("libsql://") || databaseUrl?.startsWith("https://")) {
    // Dynamic import to avoid bundling libSQL in dev
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const _libsql = require("@prisma/adapter-libsql");
    // Support both named and default/CommonJS exports
    const PrismaLibSQL = _libsql.PrismaLibSQL ?? _libsql.default ?? _libsql;
    const adapter = new PrismaLibSQL({
      url: databaseUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    return new PrismaClient({ adapter });
  }

  // Development: use local SQLite via better-sqlite3
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _bs3 = require("@prisma/adapter-better-sqlite3");
  const PrismaBetterSqlite3 = _bs3.PrismaBetterSqlite3 ?? _bs3.default ?? _bs3;
  const adapter = new PrismaBetterSqlite3({
    url: databaseUrl || "file:./dev.db",
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
