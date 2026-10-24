import crypto from "node:crypto";

const TOKEN_LIFETIME_SECONDS = 60 * 60 * 24;

function getSigningKey(): string | null {
  return process.env.SESSION_SECRET?.trim() || null;
}

function sign(key: string, payload: string): string {
  return crypto.createHmac("sha256", key).update(payload).digest("base64url");
}

/**
 * The hosted checkout often returns in a different browser or WebView, where
 * the HttpOnly payment cookie does not exist. This token lets the return page
 * prove which payment it belongs to without exposing a guessable identifier.
 */
export function createPaymentReturnToken(paymentId: string, nowMs = Date.now()): string | null {
  const key = getSigningKey();
  if (!key) return null;

  const expiresAt = Math.floor(nowMs / 1000) + TOKEN_LIFETIME_SECONDS;
  const payload = Buffer.from(`${paymentId}.${expiresAt}`).toString("base64url");
  return `${payload}.${sign(key, payload)}`;
}

export function verifyPaymentReturnToken(token: string, nowMs = Date.now()): string | null {
  const key = getSigningKey();
  if (!key) return null;

  const [payload, signature, ...extra] = token.split(".");
  if (!payload || !signature || extra.length > 0) return null;

  const provided = Buffer.from(signature, "base64url");
  const expected = Buffer.from(sign(key, payload), "base64url");
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const separator = decoded.lastIndexOf(".");
    if (separator < 0) return null;

    const paymentId = decoded.slice(0, separator);
    const expiresAt = Number(decoded.slice(separator + 1));
    if (
      !/^[A-Za-z0-9_-]{10,40}$/.test(paymentId) ||
      !Number.isInteger(expiresAt) ||
      expiresAt <= Math.floor(nowMs / 1000)
    ) {
      return null;
    }
    return paymentId;
  } catch {
    return null;
  }
}
