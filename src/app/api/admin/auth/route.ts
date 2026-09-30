import crypto from "crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getSessionSecret, COOKIE_NAME } from "@/lib/auth";
import { readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// The admin password can be changed from the admin panel (Settings → Change
// Password). The changed password is stored as a bcrypt hash in the Setting
// table and takes precedence over the ADMIN_PASSWORD env fallback.
const PASSWORD_HASH_KEY = "admin_password_hash";

// Fail closed in production: without an ADMIN_PASSWORD the admin panel must not
// silently default to a well-known password. Local development keeps a
// convenience default so the app boots without env config.
function getAdminPasswordPlain(): string | undefined {
  return process.env.ADMIN_PASSWORD?.trim();
}

function getAdminPasswordHash(): string | undefined {
  // Support ADMIN_PASSWORD_HASH for hashed password deployments.
  return process.env.ADMIN_PASSWORD_HASH?.trim();
}

function ensureAdminConfig(): void {
  if (!getAdminPasswordPlain() && !getAdminPasswordHash() && process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_PASSWORD or ADMIN_PASSWORD_HASH is not set — refusing to enable admin login in production");
  }
  if (!getAdminPasswordPlain() && !getAdminPasswordHash()) {
    console.warn("[auth] ADMIN_PASSWORD not set — using insecure dev default. Set ADMIN_PASSWORD_HASH in production.");
    // Note: dev default not returned as a password here — comparisons will
    // fallback to the literal 'admin123' for local development only.
  }
}

async function passwordsMatch(candidate: string): Promise<boolean> {
  // 1. DB hash set via the panel's Change Password — always wins.
  const stored = await prisma.setting
    .findUnique({ where: { key: PASSWORD_HASH_KEY }, select: { value: true } })
    .catch(() => null);
  if (stored?.value) {
    try {
      return bcrypt.compareSync(candidate, stored.value);
    } catch {
      return false;
    }
  }
  // 2. Env-provided hash (ADMIN_PASSWORD_HASH) for hash-only deployments.
  const envHash = getAdminPasswordHash();
  if (envHash) {
    try {
      return bcrypt.compareSync(candidate, envHash);
    } catch {
      return false;
    }
  }
  // 3. Env plaintext (the "temporary password" flow), constant-time compare.
  const expected = getAdminPasswordPlain() ?? "admin123";
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Brute-force protection ────────────────────────────────────────────
// Simple in-memory attempt limiter: 10 failed attempts per IP per 15 minutes.
// Note: on serverless (Vercel) this memory is per-instance, so it is defense
// in depth rather than a hard guarantee — pair it with a strong ADMIN_PASSWORD.
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

// Expired entries would otherwise accumulate forever (one per unique IP) —
// prune them whenever the map grows past this size.
const MAX_TRACKED_IPS = 10_000;

function pruneExpired(now: number): void {
  if (attempts.size < MAX_TRACKED_IPS) return;
  for (const [ip, entry] of attempts) {
    if (now > entry.resetAt) attempts.delete(ip);
  }
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  pruneExpired(now);
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const now = Date.now();
  pruneExpired(now);
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

// ── POST /api/admin/auth — Login ──────────────────────
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again in 15 minutes." },
        { status: 429 }
      );
    }

    const body = await readJson(request);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { password } = body as { password?: unknown };

    ensureAdminConfig();
    if (typeof password !== "string" || !(await passwordsMatch(password))) {
      recordFailure(ip);
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    // Create JWT token (24 hours)
    const token = await new SignJWT({ role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(getSessionSecret());

    const response = NextResponse.json({ success: true });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    // A thrown misconfiguration error (missing env in prod) must surface as a
    // 500, not be confused with a failed login.
    if (error instanceof Error && error.message.includes("is not set")) {
      console.error("[auth] admin login misconfigured:", error.message);
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}

// ── DELETE /api/admin/auth — Logout ───────────────────
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}