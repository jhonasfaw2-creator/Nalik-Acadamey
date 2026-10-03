#!/usr/bin/env node
/**
 * Keeps the deployed database in step with prisma/schema.prisma.
 *
 * Why this exists: the build only ran `prisma generate`, which never touches the
 * database. A schema change therefore shipped as code that queried columns the
 * database did not have yet — that is exactly what broke `GET /api/courses` when
 * `Course.discountStartAt` / `discountEndAt` were added, leaving the Courses
 * section stuck on "We couldn't load the course list right now."
 *
 * Wired in through `buildCommand` in vercel.json, which overrides both the
 * dashboard build command and the package.json `build` script. Local
 * `npm run build` and `npm run dev` stay completely database-free.
 *
 * Deliberate behaviour:
 *   - Production deployments only. Preview deployments share the same
 *     DATABASE_URL, so letting a branch preview rewrite the production schema
 *     before review would be worse than the drift this fixes.
 *     Override with ALLOW_DB_PUSH=1 when you genuinely want a preview to sync.
 *   - Never passes --accept-data-loss. A change that would drop a column, drop
 *     a table, or narrow a type fails this build loudly instead of quietly
 *     destroying data. Apply that kind of change by hand with `npm run db:push`,
 *     confirm it, then redeploy.
 *   - Any failure exits non-zero, so a drifted schema cannot reach production.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const isVercel = Boolean(process.env.VERCEL);
const vercelEnv = process.env.VERCEL_ENV ?? "";
const forced = process.env.ALLOW_DB_PUSH === "1";

function skip(reason) {
  console.log(`[db-push] Skipping schema sync — ${reason}`);
  process.exit(0);
}

if (!isVercel && !forced) {
  skip("not a Vercel build, so there is nothing to deploy");
}

if (isVercel && vercelEnv !== "production" && !forced) {
  skip(`VERCEL_ENV is "${vercelEnv || "unknown"}", not "production"`);
}

// `prisma db push` uses the schema's directUrl (the unpooled Neon connection),
// not DATABASE_URL. Locally that comes from .env; on Vercel it must be set as a
// project environment variable, or the push below fails the deploy.
if (isVercel && !process.env.DIRECT_URL) {
  console.warn(
    "[db-push] Warning: DIRECT_URL is not set in this environment. The schema declares " +
      'directUrl = env("DIRECT_URL"), which prisma db push relies on — add it under ' +
      "Vercel → Settings → Environment Variables or the sync below will fail."
  );
}

const prismaBin = path.join(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma"
);

if (!existsSync(prismaBin)) {
  console.error(
    `[db-push] Could not find the Prisma CLI at ${prismaBin}. ` +
      "Expected it from devDependencies during the build install step."
  );
  process.exit(1);
}

console.log(
  `[db-push] Syncing the database with prisma/schema.prisma (VERCEL_ENV=${vercelEnv || "n/a"}) …`
);

// --skip-generate: `prisma generate` already ran earlier in this build.
const result = spawnSync(prismaBin, ["db", "push", "--skip-generate"], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(`[db-push] Could not run prisma db push: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    "[db-push] prisma db push failed, so this deployment is stopped. The database was not " +
      "changed and the app will not ship against a schema it does not match. If the change " +
      "genuinely requires data loss, run `npm run db:push` and confirm it, then redeploy."
  );
  process.exit(result.status ?? 1);
}

console.log("[db-push] Database is in sync with the schema.");
