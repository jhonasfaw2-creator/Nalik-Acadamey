
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Create a registration and schedule
  const course = await prisma.course.create({
    data: { title: "Test Course", description: "...", price: 100 }
  });
  const schedule = await prisma.schedule.create({
    data: { 
      group: "A", 
      session: "Morning", 
      days: "Mon", 
      startTime: "08:00", 
      endTime: "10:00", 
      maxSeats: 1, 
      enrolled: 0, 
      active: true,
      availabilityOverride: null 
    }
  });
  const registration = await prisma.registration.create({
    data: {
      referenceId: "TEST-" + Math.random().toString(36).substring(7),
      fullName: "Test Student",
      phone: "123456789",
      age: 20,
      courseId: course.id,
      scheduleId: schedule.id,
      paymentProofPath: "test-path",
      paymentProofStatus: "PENDING_REVIEW"
    }
  });

  console.log("Created registration:", registration.id);

  // Try to approve it
  try {
    // Mimic PATCH /api/admin/registrations/[id]/payment-proof
    const updated = await prisma.$transaction(async (tx) => {
        const registration2 = await tx.registration.findUnique({
            where: { id: registration.id },
            select: { id: true, status: true, scheduleId: true, paymentProofPath: true, paymentProofStatus: true }
        });

        // Mimic the logic in payment-proof/route.ts
        const schedule2 = await tx.schedule.findUnique({
            where: { id: registration2.scheduleId },
            select: { id: true, active: true, enrolled: true, maxSeats: true, availabilityOverride: true }
        });

        const actualEnrolled = await tx.registration.count({
            where: { scheduleId: schedule2.id, status: { in: ["PAID", "CONFIRMED"] } }
        });

        console.log("Actual enrolled:", actualEnrolled);
        console.log("Max seats:", schedule2.maxSeats);

        if (actualEnrolled >= schedule2.maxSeats) throw new Error("SCHEDULE_FULL");

        const seat = await tx.schedule.updateMany({
            where: {
                id: schedule2.id,
                enrolled: { lt: schedule2.maxSeats },
                active: true,
                OR: [ { availabilityOverride: null }, { availabilityOverride: true } ],
            },
            data: { enrolled: { increment: 1 } }
        });
        
        console.log("Seat update count:", seat.count);
        if (seat.count !== 1) throw new Error("SCHEDULE_FULL");

        return tx.registration.update({
            where: { id: registration.id },
            data: { status: "CONFIRMED", paymentProofStatus: "APPROVED" }
        });
    });
    console.log("Updated:", updated);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
main();
