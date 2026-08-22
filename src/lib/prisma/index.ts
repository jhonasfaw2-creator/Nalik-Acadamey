import { createClient } from '@libsql/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { PrismaClient } from '../../generated/prisma'; // Adjust path if needed

// 1. Initialize the LibSQL client first
const libsql = createClient({
  url: process.env.TURSO_DATABASE_URL!, // Make sure this matches your env variable name
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// 2. Pass the instantiated client to the Prisma adapter
const adapter = new PrismaLibSQL(libsql);

// 3. Initialize Prisma with the adapter
const prisma = new PrismaClient({ adapter });

export default prisma;