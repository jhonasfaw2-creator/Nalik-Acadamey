import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const courses = await prisma.course.findMany({ where: { active: true } });
  const schedules = await prisma.schedule.findMany({ where: { active: true } });
  console.log('Active courses:', courses.length);
  console.log('Active schedules:', schedules.length);
  if (courses[0]) console.log('First course:', courses[0].title, 'price:', courses[0].price, 'discount:', courses[0].discountPrice);
  if (schedules[0]) console.log('First schedule:', schedules[0].group, schedules[0].session, 'enrolled:', schedules[0].enrolled, '/', schedules[0].maxSeats);
  await prisma.$disconnect();
}

check().catch(e => { console.error(e); process.exit(1); });
