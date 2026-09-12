import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SECRET_KEY = process.env.CHAPA_SECRET_KEY || '';

async function main() {
  console.log('=== Quick Chapa TEST Payment ===\n');
  
  const course = await prisma.course.findFirst({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
  const schedule = await prisma.schedule.findFirst({ where: { active: true } });
  
  if (!course || !schedule) {
    console.error('No active course/schedule');
    process.exit(1);
  }
  
  const price = course.discountPrice ?? course.price;
  const email = `quick-test-${Date.now()}@gmail.com`;
  
  console.log(`Course: ${course.title}`);
  console.log(`Price: ${price} ETB\n`);
  
  // Create registration
  const regRes = await fetch('http://0.0.0.0:3111/api/registrations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Quick Test',
      email,
      phone: '+251911223344',
      age: 25,
      courseId: course.id,
      scheduleId: schedule.id,
    }),
  });
  
  const reg = await regRes.json();
  
  if (regRes.status !== 201) {
    console.error('Registration failed:', reg);
    process.exit(1);
  }
  
  console.log(`Reference ID: ${reg.referenceId}`);
  console.log(`Email: ${email}\n`);
  
  // Create Chapa transaction
  const checkoutRes = await fetch('https://api.chapa.co/v1/transaction/initialize', {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: String(price),
      currency: 'ETB',
      email,
      first_name: 'Quick',
      last_name: 'Test',
      phone: '0900123456',
      tx_ref: reg.txRef || `QT-${Date.now()}`,
      callback_url: 'http://0.0.0.0:3111/api/webhooks/chapa',
      return_url: `http://0.0.0.0:3111/payment/return?referenceId=${reg.referenceId}`,
    }),
  });
  
  const checkoutData = await checkoutRes.json();
  
  if (checkoutData.status !== 'success') {
    console.error('Checkout creation failed:', checkoutData);
    process.exit(1);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  OPEN THIS URL IN YOUR BROWSER TO COMPLETE THE PAYMENT');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(checkoutData.data.checkout_url);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('TEST CREDENTIALS (NO REAL MONEY):');
  console.log('  • Telebirr/Bank: 0900123456 (success) or 0900000000 (fail)');
  console.log('  • Card: 4242 4242 4242 4242 (success)');
  console.log('');
  console.log('After completing the payment, run this to verify:');
  console.log(`  npx tsx scripts/verify-payment.mjs ${reg.referenceId}\n`);
  
  // Don't exit - let user complete payment, then they can run verify script
  console.log('Waiting 5 seconds before checking initial state...');
  await new Promise(r => setTimeout(r, 5000));
  
  const app = await prisma.application.findUnique({
    where: { referenceId: reg.referenceId },
    include: { payment: true },
  });
  
  console.log('\nInitial database state:');
  console.log(`  Application: ${app?.status}`);
  console.log(`  Payment: ${app?.payment?.status}`);
  console.log(`  tx_ref: ${app?.payment?.txRef}\n`);
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
