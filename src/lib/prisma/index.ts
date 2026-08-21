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
    // Resolve common export shapes: named, default, or the module itself
    let PrismaLibSQL = _libsql.PrismaLibSQL ?? _libsql.default ?? _libsql;
    // If the resolved export isn't a constructor, try common factory shapes
    let adapter;
    if (typeof PrismaLibSQL === "function") {
      adapter = new PrismaLibSQL({ url: databaseUrl, authToken: process.env.TURSO_AUTH_TOKEN });
    } else if (PrismaLibSQL && typeof PrismaLibSQL.create === "function") {
      adapter = PrismaLibSQL.create({ url: databaseUrl, authToken: process.env.TURSO_AUTH_TOKEN });
    } else if (typeof _libsql.createAdapter === "function") {
      adapter = _libsql.createAdapter({ url: databaseUrl, authToken: process.env.TURSO_AUTH_TOKEN });
    } else {
      // As a last resort, pass the raw export through; Prisma will error with a clearer message
      adapter = PrismaLibSQL;
    }
    return new PrismaClient({ adapter });
  }

  // Development: use local SQLite via better-sqlite3
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _bs3 = require("@prisma/adapter-better-sqlite3");
  let PrismaBetterSqlite3 = _bs3.PrismaBetterSqlite3 ?? _bs3.default ?? _bs3;
  let adapter;
  if (typeof PrismaBetterSqlite3 === "function") {
    adapter = new PrismaBetterSqlite3({ url: databaseUrl || "file:./dev.db" });
  } else if (PrismaBetterSqlite3 && typeof PrismaBetterSqlite3.create === "function") {
    adapter = PrismaBetterSqlite3.create({ url: databaseUrl || "file:./dev.db" });
  } else if (typeof _bs3.createAdapter === "function") {
    adapter = _bs3.createAdapter({ url: databaseUrl || "file:./dev.db" });
  } else {
    adapter = PrismaBetterSqlite3;
  }
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
