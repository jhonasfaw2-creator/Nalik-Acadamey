import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  // Find recent applications
  const recentApps = await prisma.application.findMany({
    where: { 
      email: { contains: 'livetest' },
      createdAt: { gte: new Date(Date.now() - 3600000) }
    },
    include: { payment: true, course: { select: { title: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  console.log('Recent livetest applications:');
  for (const app of recentApps) {
    console.log('  -', app.referenceId, 'status:', app.status, 'payment:', app.payment?.status, 'course:', app.course.title);
  }
  
  // Check schedule seats
  const schedules = await prisma.schedule.findMany({ where: { active: true } });
  console.log('\nSchedule seats:');
  for (const s of schedules) {
    console.log('  -', s.group, s.session, 'enrolled:', s.enrolled, '/', s.maxSeats);
  }
  
  // Also check e2e test records
  const e2eApps = await prisma.application.findMany({
    where: { 
      email: { contains: 'e2e-' },
      createdAt: { gte: new Date(Date.now() - 3600000) }
    },
    include: { payment: true },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  console.log('\nRecent e2e-test applications:');
  for (const app of e2eApps) {
    console.log('  -', app.referenceId, 'status:', app.status, 'payment:', app.payment?.status);
  }
  
  await prisma.$disconnect();
}

check().catch(e => { console.error(e); process.exit(1); });
