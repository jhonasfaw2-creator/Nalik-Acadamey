import { execSync } from 'child_process';

console.log('[db-push] Starting Prisma db push...');

try {
  execSync('npx prisma db push --accept-data-loss --skip-generate', {
    stdio: 'inherit',
    env: process.env,
  });
  console.log('[db-push] ✅ Database is in sync with schema.');
} catch (error) {
  console.error('[db-push] ❌ Failed:', error.message);
  console.error('[db-push] Deployment stopped. Database was not changed.');
  process.exit(1);
}
