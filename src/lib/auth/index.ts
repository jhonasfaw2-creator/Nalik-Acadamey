import crypto from "crypto";

// Simple cookie-based admin auth.
// In production, use a proper session store (e.g. Redis, Prisma sessions).
// For development, we use a simple in-memory token store + env credentials.

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@nalikacademy.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "nalik2024";
const SESSION_SECRET = process.env.SESSION_SECRET || "nalik-dev-session-secret";

interface Session {
  email: string;
  expiresAt: number;
}

// In-memory session store (good for single-server dev)
const sessions = new Map<string, Session>();

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export function verifyCredentials(email: string, password: string): boolean {
  return email === ADMIN_EMAIL && password === ADMIN_PASSWORD;
}

export function createSession(email: string): string {
  // Use SESSION_SECRET as HMAC key for extra token security
  const raw = crypto.randomBytes(32).toString("hex");
  const token = crypto.createHmac("sha256", SESSION_SECRET).update(raw).digest("hex");
  sessions.set(token, {
    email,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  });
  return token;
}

export function validateSession(token: string): { valid: boolean; email?: string } {
  const session = sessions.get(token);
  if (!session) return { valid: false };
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return { valid: false };
  }
  return { valid: true, email: session.email };
}

export function destroySession(token: string): void {
  sessions.delete(token);
}

export function getSessionFromRequest(request: Request): { valid: boolean; email?: string } {
  // Check Authorization header first
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    return validateSession(token);
  }

  // Then check cookie
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/admin_session=([^;]+)/);
  if (match) {
    return validateSession(match[1]);
  }

  return { valid: false };
}

export function createSessionCookie(token: string): string {
  const maxAge = Math.floor(SESSION_DURATION_MS / 1000);
  return `admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}
