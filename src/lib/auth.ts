import { jwtVerify } from "jose";

const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "fallback-secret-change-me"
);

const COOKIE_NAME = "nalik_admin_session";

// ── Verify session from cookie ────────────────────────
export async function verifySession(
  cookies: { get: (name: string) => { value: string } | undefined }
): Promise<boolean> {
  const token = cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;

  try {
    await jwtVerify(token, SESSION_SECRET);
    return true;
  } catch {
    return false;
  }
}

export { SESSION_SECRET, COOKIE_NAME };
