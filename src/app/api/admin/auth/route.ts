import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getSessionSecret, COOKIE_NAME } from "@/lib/auth";

// Fail closed in production: without an ADMIN_PASSWORD the admin panel must not
// silently default to a well-known password. Local development keeps a
// convenience default so the app boots without env config.
function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_PASSWORD is not set — refusing to enable admin login in production");
    }
    console.warn("[auth] ADMIN_PASSWORD not set — using insecure dev default. Set it in .env for real access.");
    return "admin123";
  }
  return password;
}

// ── Brute-force protection ────────────────────────────────────────────
// Simple in-memory attempt limiter: 10 failed attempts per IP per 15 minutes.
// Note: on serverless (Vercel) this memory is per-instance, so it is defense
// in depth rather than a hard guarantee — pair it with a strong ADMIN_PASSWORD.
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const now = Date.now();
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

    const { password } = await request.json();

    if (typeof password !== "string" || password !== getAdminPassword()) {
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
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
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