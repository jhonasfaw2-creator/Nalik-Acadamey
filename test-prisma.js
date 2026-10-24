
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
    const res = await prisma.schedule.updateMany({
        where: { id: "sched-a-morning", OR: [ { availabilityOverride: null }, { availabilityOverride: true } ] },
        data: { enrolled: { increment: 0 } }
    });
    console.log("Count:", res.count);
}
main();
