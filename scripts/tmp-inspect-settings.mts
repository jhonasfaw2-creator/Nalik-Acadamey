import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const rows = await prisma.setting.findMany();
  console.log("settings keys:", rows.map((r) => r.key));
}
main().catch((e) => console.error("ERR", e.message)).finally(() => prisma.$disconnect());
