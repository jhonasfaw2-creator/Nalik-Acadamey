import { createClient } from '@libsql/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
// Note: Based on your logs, you generate the client to a custom path. 
// Adjust this import to match your generated client path if needed.
import { PrismaClient } from '../../generated/prisma'; 

// 1. Initialize the LibSQL client first
const libsql = createClient({
  url: databaseUrl, // Make sure databaseUrl is defined in your file
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// 2. Pass the instantiated client to the Prisma adapter
const adapter = new PrismaLibSQL(libsql);

// 3. Initialize Prisma with the adapter
const prisma = new PrismaClient({ adapter });

export default prisma;