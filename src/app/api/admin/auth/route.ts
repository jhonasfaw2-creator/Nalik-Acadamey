import { NextResponse } from "next/server";
import {
  verifyCredentials,
  createSession,
  createSessionCookie,
  getSessionFromRequest,
} from "@/lib/auth";
import { createRateLimiter, getClientIp } from "@/lib/api/rate-limit";

// Stricter rate limit for login attempts (5 per minute per IP)
const loginLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5 });

// ── POST: Admin login ─────────────────────────
export async function POST(request: Request) {
  const ip = getClientIp(request);

  if (loginLimiter.isRateLimited(`login:${ip}`)) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait a minute." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { email, password } = body || {};

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Invalid credentials format" },
        { status: 400 }
      );
    }

    if (!verifyCredentials(email, password)) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = createSession(email);

    const response = NextResponse.json({
      success: true,
      user: { email },
    });

    response.headers.set("Set-Cookie", createSessionCookie(token));

    return response;
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// ── GET: Check current session ────────────────
export async function GET(request: Request) {
  try {
    const session = getSessionFromRequest(request);

    if (!session.valid) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: { email: session.email },
    });
  } catch {
    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    );
  }
}
