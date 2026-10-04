import crypto from "node:crypto";

const TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 30;

function getSigningKey(): string {
  const key = process.env.SESSION_SECRET?.trim();
  if (!key) throw new Error("SESSION_SECRET is required to issue download tokens.");
  return key;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSigningKey()).update(payload).digest("base64url");
}

export function createDownloadToken(referenceId: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS;
  const payload = Buffer.from(`${referenceId}.${expiresAt}`).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyDownloadToken(token: string): string | null {
  const [payload, signature, ...extra] = token.split(".");
  if (!payload || !signature || extra.length > 0) return null;

  const expected = sign(payload);
  const providedBuffer = Buffer.from(signature, "base64url");
  const expectedBuffer = Buffer.from(expected, "base64url");
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const separator = decoded.lastIndexOf(".");
    if (separator < 0) return null;
    const referenceId = decoded.slice(0, separator);
    const expiresAt = Number(decoded.slice(separator + 1));
    if (
      !/^NA-\d{4}-[A-Z2-9]{6}$/.test(referenceId) ||
      !Number.isInteger(expiresAt) ||
      expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return referenceId;
  } catch {
    return null;
  }
}
