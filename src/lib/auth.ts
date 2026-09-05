import { jwtVerify } from "jose";

// Never fall back to a hardcoded secret in production — that would let anyone
// forge admin sessions. Local development keeps a convenience fallback so the
// app boots without env config; production fails loudly instead.
function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET is not set — refusing to start in production");
    }
    console.warn("[auth] SESSION_SECRET not set — using insecure dev fallback. Set it in .env for real sessions.");
    return new TextEncoder().encode("dev-only-insecure-secret");
  }
  return new TextEncoder().encode(secret);
}

const COOKIE_NAME = "nalik_admin_session";

// ── Verify session from cookie ────────────────────────
export async function verifySession(
  cookies: { get: (name: string) => { value: string } | undefined }
): Promise<boolean> {
  const token = cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;

  try {
    await jwtVerify(token, getSessionSecret());
    return true;
  } catch {
    return false;
  }
}

export { getSessionSecret, COOKIE_NAME };
