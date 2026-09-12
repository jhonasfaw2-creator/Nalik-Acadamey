// ── Chapa Inline.js + server-side verification ─────────────────────────────
// Official docs:
//   Inline.js:  https://developer.chapa.co/integrations/inline-js
//   Verify:     https://developer.chapa.co/integrations/verify-payments
//   Webhooks:   https://developer.chapa.co/integrations/webhooks
//
// The checkout itself is Chapa's Inline.js (`https://js.chapa.co/v1/inline.js`),
// rendered inside our page with the PUBLIC key. Inline.js charges through
// Chapa's inline service; it never touches our secret key.
//
// Because the amount passed to Inline.js lives in the browser, it must never be
// trusted. This module implements the authoritative server-side checks:
//   Verify:  GET https://api.chapa.co/v1/transaction/verify/<tx_ref>
//            Authorization: Bearer <CHAPA_SECRET_KEY>
//   Webhook: POST to our endpoint, x-chapa-signature = HMAC-SHA256(secret, body)
//
// Only the documented v1 endpoints are used here. No custom banking/card
// interface and no invented endpoints.

import crypto from "crypto";

// SECURITY: this module reads CHAPA_SECRET_KEY / CHAPA_WEBHOOK_SECRET and must
// never be bundled into client code. Fail loudly if it is ever imported from a
// Client Component instead of relying on reviewer discipline.
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/payments/chapa.ts is server-only and must not be imported into client code."
  );
}

const CHAPA_BASE_URL = "https://api.chapa.co";

// ── Env / config ──────────────────────────────────────────────────────────

/** Server-side secret key (CHASECK_TEST-… / CHASECK_LIVE-…). */
export function chapaSecretKey(): string | undefined {
  return process.env.CHAPA_SECRET_KEY?.trim() || undefined;
}

/** Public key (CHAPUBK_TEST-… / CHAPUBK_LIVE-…) used by Inline.js in the browser. */
export function chapaPublicKey(): string | undefined {
  return process.env.CHAPA_PUBLIC_KEY?.trim() || undefined;
}

/** Webhook "secret hash" configured in the Chapa dashboard → Webhooks. */
export function chapaWebhookSecret(): string | undefined {
  return process.env.CHAPA_WEBHOOK_SECRET?.trim() || undefined;
}

export function isChapaConfigured(): boolean {
  return Boolean(chapaSecretKey() && chapaPublicKey());
}

// ── References & phone normalization ───────────────────────────────────────

/**
 * Unique server-side transaction reference (Chapa `tx_ref`), generated per
 * payment attempt. Inline.js accepts it as the `tx_ref` option, which lets us
 * correlate Chapa's transaction (and webhooks) back to our Payment row.
 */
export function generateTxRef(referenceId: string): string {
  const stamp = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 46656).toString(36).padStart(3, "0");
  const suffix = String(referenceId).replace(/[^A-Za-z0-9]/g, "").slice(-4).toUpperCase();
  return `NALIK-${stamp}${rand}-${suffix}`;
}

/**
 * Normalizes an Ethiopian phone number to the 9-digit local form Inline.js
 * expects in its phone field (e.g. 911223344). Returns "" when it cannot be
 * normalized, so we simply don't prefill instead of rendering an invalid value.
 *
 * Inline.js validates /^(251\d{9}|0\d{9}|9\d{8}|7\d{8})$/.
 */
export function normalizePhoneForChapa(phone?: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("251")) local = local.slice(3);
  else if (local.startsWith("0")) local = local.slice(1);
  return /^[97]\d{8}$/.test(local) ? local : "";
}

// ── Verify ─────────────────────────────────────────────────────────────────

export interface ChapaVerification {
  /** Normalized status: success | failed | pending */
  status: string;
  chapaReference: string;
  txRef: string;
  amount: number;
  currency: string;
  method?: string;
  charge?: number;
  mode?: string;
}

export class PaymentNotFoundError extends Error {
  constructor(message = "Chapa transaction not found") {
    super(message);
    this.name = "PaymentNotFoundError";
  }
}

/**
 * Chapa returns a plain string for these, but some endpoints return a
 * validation object ({ field: ["rule"] }). Normalize both to a single string.
 */
function chapaMessage(body: unknown): string {
  const message = (body as { message?: unknown } | null)?.message;
  if (typeof message === "string") return message;
  if (message && typeof message === "object") return JSON.stringify(message);
  return "";
}

/**
 * Classifies a failed verify response. Verified against Chapa's live TEST API
 * (Sept 2026) as well as their documented response list
 * (https://developer.chapa.co/integrations/responses):
 *
 *   documented  404  "Invalid transaction or Transaction not found"  → not-found
 *   documented  404  "Payment not paid yet"                          → pending
 *   observed    400  "Invalid transaction reference"                 → not-found
 *
 * Anything else (401 "Invalid API Key", "Live secret keys can't be used to
 * verify a test transaction", "Payments through API is disabled", …) is a real
 * error and must NOT be mistaken for "no such transaction" — otherwise we would
 * silently leave a payment pending instead of surfacing the misconfiguration.
 */
function classifyVerifyFailure(status: number, message: string): "pending" | "not-found" | "error" {
  const msg = message.toLowerCase();
  if (msg.includes("not paid yet")) return "pending";
  if (msg.includes("invalid transaction") || msg.includes("transaction not found")) return "not-found";
  // Documented 404 with no message body → treat as an unknown transaction.
  if (status === 404 && !msg) return "not-found";
  return "error";
}

interface ChapaVerifyData {
  status?: string;
  amount?: number | string;
  currency?: string;
  reference?: string;
  tx_ref?: string;
  method?: string;
  charge?: number | string;
  mode?: string;
}

interface ChapaVerifyResponse {
  message?: string;
  status?: string;
  data?: ChapaVerifyData | null;
}

export async function verifyChapaTransaction(txRef: string): Promise<ChapaVerification> {
  const key = chapaSecretKey();
  if (!key) throw new Error("Chapa is not configured (CHAPA_SECRET_KEY missing)");

  const res = await fetch(
    `${CHAPA_BASE_URL}/v1/transaction/verify/${encodeURIComponent(txRef)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }
  );

  const body = (await res.json().catch(() => null)) as ChapaVerifyResponse | null;
  const data = body?.data;

  if (!res.ok || !data) {
    const message = chapaMessage(body);
    switch (classifyVerifyFailure(res.status, message)) {
      case "pending":
        // A charge that is still being processed (or not yet paid) is not an
        // error — report it as pending and let the caller keep the payment
        // PENDING.
        return { status: "pending", chapaReference: "", txRef, amount: 0, currency: "ETB" };
      case "not-found":
        throw new PaymentNotFoundError(message || "Chapa transaction not found");
      default:
        throw new Error(message || `Chapa verify failed (HTTP ${res.status})`);
    }
  }

  return {
    status: String(data.status || "").trim().toLowerCase() || "pending",
    chapaReference: String(data.reference || ""),
    txRef: String(data.tx_ref || txRef),
    amount: Number(data.amount ?? 0),
    currency: String(data.currency || "ETB"),
    method: data.method ? String(data.method) : undefined,
    charge: data.charge != null ? Math.round(Number(data.charge)) : undefined,
    mode: data.mode ? String(data.mode) : undefined,
  };
}

// ── Webhook signature ──────────────────────────────────────────────────────

function timingSafeHexEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies an incoming Chapa webhook. Chapa sends:
 *   - `x-chapa-signature`: HMAC-SHA256 of the event payload, signed with the
 *     webhook secret hash.
 *   - `chapa-signature`:   HMAC-SHA256 of the secret itself, signed with the
 *     secret.
 * Either header matching is sufficient (as documented). Returns false when no
 * secret is configured so callers can decide how to fail.
 */
export function isValidChapaWebhook(
  rawBody: string | Buffer,
  xSignature: string | null,
  chapaSignature?: string | null
): boolean {
  const secret = chapaWebhookSecret();
  if (!secret) return false;
  const body = typeof rawBody === "string" ? Buffer.from(rawBody) : rawBody;

  if (xSignature && /^[a-f0-9]{64}$/i.test(xSignature)) {
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    if (timingSafeHexEqual(xSignature, expected)) return true;
  }
  if (chapaSignature && /^[a-f0-9]{64}$/i.test(chapaSignature)) {
    const expected = crypto.createHmac("sha256", secret).update(secret).digest("hex");
    if (timingSafeHexEqual(chapaSignature, expected)) return true;
  }
  return false;
}
