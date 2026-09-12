import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SECRET_KEY = process.env.CHAPA_SECRET_KEY || '';

async function main(referenceId) {
  if (!referenceId) {
    console.error('Usage: npx tsx scripts/verify-payment.mjs <referenceId>');
    process.exit(1);
  }
  
  console.log(`\n=== Verifying Payment for ${referenceId} ===\n`);
  
  const app = await prisma.application.findUnique({
    where: { referenceId },
    include: { payment: true, course: { select: { title: true } }, schedule: true },
  });
  
  if (!app) {
    console.error('Registration not found');
    process.exit(1);
  }
  
  console.log('Registration:');
  console.log(`  Course: ${app.course.title}`);
  console.log(`  Application status: ${app.status}`);
  console.log(`  Payment status: ${app.payment?.status}`);
  console.log(`  Amount: ${app.payment?.amount} ETB`);
  console.log(`  tx_ref: ${app.payment?.txRef}`);
  console.log(`  chapaReference: ${app.payment?.chapaReference}`);
  console.log(`  paidAt: ${app.payment?.paidAt}`);
  console.log(`  Schedule: ${app.schedule?.group} - ${app.schedule?.session}`);
  console.log(`  Schedule enrolled: ${app.schedule?.enrolled}/${app.schedule?.maxSeats}\n`);
  
  // Verify with Chapa
  if (app.payment?.txRef) {
    console.log('Chapa verification:');
    const verifyRes = await fetch(`https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(app.payment.txRef)}`, {
      headers: { Authorization: `Bearer ${SECRET_KEY}` },
    });
    const verifyData = await verifyRes.json();
    
    if (verifyData.data) {
      console.log(`  Chapa status: ${verifyData.data.status}`);
      console.log(`  Chapa mode: ${verifyData.data.mode}`);
      console.log(`  Chapa amount: ${verifyData.data.amount}`);
      console.log(`  Chapa reference: ${verifyData.data.reference}`);
      
      if (verifyData.data.status === 'success') {
        console.log('\n✅ Chapa confirms payment SUCCESS');
      } else {
        console.log(`\n⚠️  Chapa status: ${verifyData.data.status}`);
      }
    } else {
      console.log('  No data returned from Chapa');
    }
  }
  
  console.log('\n=== RESULT ===');
  if (app.status === 'PAID' && app.payment?.status === 'SUCCESS') {
    console.log('✅ HAPPY PATH VERIFIED');
    console.log('   • Application is PAID');
    console.log('   • Payment is SUCCESS');
    console.log(`   • Seat booked: ${app.schedule?.enrolled}/${app.schedule?.maxSeats}`);
  } else if (app.status === 'PENDING_PAYMENT') {
    console.log('⏳ Payment not yet completed or still processing');
    console.log('   • Application is PENDING_PAYMENT');
    console.log('   • Payment is ' + app.payment?.status);
  } else {
    console.log('Status: ' + app.status);
  }
  
  await prisma.$disconnect();
}

const refId = process.argv[2];
main(refId).catch(e => {
  console.error(e);
  process.exit(1);
});
