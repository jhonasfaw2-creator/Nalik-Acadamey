import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { checkAndIncrement, getRemaining } from "@/lib/rateLimit";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin routes (not /admin/login)
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const isAuthed = await verifySession(request.cookies);
    if (!isAuthed) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // Also protect admin API routes (except auth)
  if (
    pathname.startsWith("/api/admin") &&
    !pathname.startsWith("/api/admin/auth")
  ) {
    // Apply a per-IP rate limit to admin API endpoints as an extra layer.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const key = `admin-api:${ip}:${pathname}`;
    const allowed = checkAndIncrement(key, 200, 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const isAuthed = await verifySession(request.cookies);
    if (!isAuthed) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // Global API rate limiting for public APIs to mitigate abuse. Configure
  // limits conservatively here; move to a shared store for production.
  if (pathname.startsWith("/api/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const key = `api:${ip}:${pathname}`;
    const allowed = checkAndIncrement(key, 300, 60 * 1000);
    if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
