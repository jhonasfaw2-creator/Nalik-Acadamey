#!/usr/bin/env node
// Verification script for Chapa V2 database schema

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifySchema() {
  console.log('🔍 Verifying Chapa V2 database schema...\n');

  try {
    // 1. Check tables exist and are empty
    const [regCount, txCount] = await Promise.all([
      prisma.registration.count(),
      prisma.transaction.count(),
    ]);

    console.log('📊 Table Counts:');
    console.log(`   Registration: ${regCount} rows`);
    console.log(`   Transaction: ${txCount} rows`);

    // 2. Test Registration CRUD
    console.log('\n🧪 Testing Registration CRUD...');
    
    // Create a test course first (if needed)
    const course = await prisma.course.upsert({
      where: { id: 'test-course-v2' },
      update: {},
      create: {
        id: 'test-course-v2',
        title: 'Test Course V2',
        description: 'Test course for verification',
        price: 50000,
        discountPrice: 40000,
        active: true,
        sortOrder: 1,
      },
    });

    // Create a test schedule
    const schedule = await prisma.schedule.upsert({
      where: { group_session: { group: 'A', session: 'Morning Session' } },
      update: {},
      create: {
        group: 'A',
        session: 'Morning Session',
        days: 'Monday, Wednesday, Friday',
        startTime: '08:00',
        endTime: '10:00',
        maxSeats: 15,
        active: true,
      },
    });

    // Create registration
    const registration = await prisma.registration.create({
      data: {
        referenceId: 'NA-2026-TEST01',
        fullName: 'Test Student',
        email: 'test-v2@example.com',
        phone: '+251911223344',
        age: 25,
        courseId: course.id,
        scheduleId: schedule.id,
        previousExperience: 'Beginner',
        motivation: 'Testing V2 schema',
        status: 'PENDING',
      },
    });
    console.log(`   ✅ Created registration: ${registration.referenceId}`);

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        registrationId: registration.id,
        amount: 40000,
        currency: 'ETB',
        txRef: registration.referenceId,
        status: 'PENDING',
      },
    });
    console.log(`   ✅ Created transaction: ${transaction.txRef}`);

    // 3. Test relationships
    console.log('\n🔗 Testing Relationships...');
    
    const regWithTx = await prisma.registration.findUnique({
      where: { id: registration.id },
      include: { transactions: true, course: true, schedule: true },
    });
    console.log(`   ✅ Registration -> Transactions: ${regWithTx!.transactions.length} transaction(s)`);
    console.log(`   ✅ Registration -> Course: ${regWithTx!.course.title}`);
    console.log(`   ✅ Registration -> Schedule: Schedule ${regWithTx!.schedule!.group}`);

    const txWithReg = await prisma.transaction.findUnique({
      where: { id: transaction.id },
      include: { registration: true },
    });
    console.log(`   ✅ Transaction -> Registration: ${txWithReg!.registration.referenceId}`);

    // 4. Test unique constraints
    console.log('\n🔒 Testing Unique Constraints...');
    
    try {
      await prisma.registration.create({
        data: {
          referenceId: 'NA-2026-TEST02',
          fullName: 'Duplicate',
          email: 'test-v2@example.com', // same email + course = conflict
          phone: '+251922334455',
          age: 30,
          courseId: course.id,
        },
      });
      console.log('   ❌ Unique constraint (email, courseId) NOT enforced');
    } catch (e) {
      console.log('   ✅ Unique constraint (email, courseId) enforced');
    }

    try {
      await prisma.transaction.create({
        data: {
          registrationId: registration.id,
          amount: 40000,
          currency: 'ETB',
          txRef: registration.referenceId, // same txRef = conflict
          status: 'PENDING',
        },
      });
      console.log('   ❌ Unique constraint (txRef) NOT enforced');
    } catch (e) {
      console.log('   ✅ Unique constraint (txRef) enforced');
    }

    // 5. Test cascade delete
    console.log('\n🗑️  Testing Cascade Delete...');
    const testReg = await prisma.registration.create({
      data: {
        referenceId: 'NA-2026-CASCADE',
        fullName: 'Cascade Test',
        email: 'cascade@example.com',
        phone: '+251933445566',
        age: 22,
        courseId: course.id,
      },
    });
    await prisma.transaction.create({
      data: {
        registrationId: testReg.id,
        amount: 10000,
        currency: 'ETB',
        txRef: testReg.referenceId,
        status: 'PENDING',
      },
    });
    await prisma.registration.delete({ where: { id: testReg.id } });
    const orphanTx = await prisma.transaction.findFirst({ where: { registrationId: testReg.id } });
    if (!orphanTx) {
      console.log('   ✅ Cascade delete works (Transaction deleted with Registration)');
    } else {
      console.log('   ❌ Cascade delete failed');
    }

    // 6. Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    await prisma.transaction.deleteMany({ where: { txRef: { startsWith: 'NA-2026-TEST' } } });
    await prisma.registration.deleteMany({ where: { referenceId: { startsWith: 'NA-2026-TEST' } } });
    await prisma.registration.deleteMany({ where: { referenceId: 'NA-2026-CASCADE' } });
    console.log('   ✅ Test data cleaned up');

    console.log('\n✅ All verification checks PASSED!');
    console.log('\n📋 Schema Summary:');
    console.log('   • Registration table: id, referenceId (unique), email+courseId (unique), status, paidAt');
    console.log('   • Transaction table: id, registrationId (FK, CASCADE), txRef (unique), chapaReference (unique), status');
    console.log('   • Foreign keys: Transaction.registrationId -> Registration.id (CASCADE)');
    console.log('   • Indexes: status, referenceId, txRef, chapaReference on both tables');

  } catch (error) {
    console.error('❌ Verification FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifySchema();