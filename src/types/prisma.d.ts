// Fix for @prisma/client missing default.d.ts in v6.19.x
// See: https://github.com/prisma/prisma/issues/27012
declare module "@prisma/client" {
  export { PrismaClient, Prisma } from ".prisma/client";
}
