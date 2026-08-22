import { createClient } from '@libsql/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
// Adjust this path if your generated client is located elsewhere
import { PrismaClient } from '../../generated/prisma'; 

// 1. Initialize the LibSQL client first
const libsql = createClient({
  url: databaseUrl, // Ensure databaseUrl is defined in your file
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// 2. Pass the instantiated client to the Prisma adapter
const adapter = new PrismaLibSQL(libsql);

// 3. Initialize Prisma with the adapter
const prisma = new PrismaClient({ adapter });

export default prisma;