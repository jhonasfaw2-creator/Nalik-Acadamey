import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

/**
 * Check if the request has a valid admin session.
 * Returns null if authenticated, or a NextResponse with 401 if not.
 */
export function requireAdmin(request: Request): NextResponse | null {
  const session = getSessionFromRequest(request);
  if (!session.valid) {
    return NextResponse.json(
      { error: "Unauthorized. Please log in." },
      { status: 401 }
    );
  }
  return null;
}
