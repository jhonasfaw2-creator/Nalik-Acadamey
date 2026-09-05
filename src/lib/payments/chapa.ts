// ── Chapa API v2 client (https://docs.chapa.global/docs/v2) ────────────────
// Current official API (docs.chapa.global), v1 is legacy:
//   Initialize (hosted):  POST https://api.chapa.global/v2/payments/hosted
//   Verify:               GET  https://api.chapa.global/v2/payments/{reference}/verify
//   Webhooks:             POST to your endpoint, x-chapa-signature = HMAC-SHA256
//                         (key = webhook secret, message = raw request body)
//
// Test mode uses CHAPA_TEST_... keys on the SAME base URL; the environment is
// chosen by the key. Amounts are sent as numbers, currency as ETB.

import crypto from "crypto";

const CHAPA_BASE_URL = "https://api.chapa.global";

// ── Env / config ──────────────────────────────────────────────────────────

export function chapaSecretKey(): string | undefined {
  return process.env.CHAPA_SECRET_KEY?.trim() || undefined;
}

export function chapaWebhookSecret(): string | undefined {
  return process.env.CHAPA_WEBHOOK_SECRET?.trim() || undefined;
}

export function isChapaConfigured(): boolean {
  return Boolean(chapaSecretKey());
}

// ── References & phone normalization ───────────────────────────────────────

/**
 * Unique server-side transaction reference (Chapa merchant_reference).
 *
 * Chapa's v2 API rejects merchant_reference values longer than ~20 characters
 * with HTTP 500 PROCESSING_FAILED (verified against the sandbox), so this is
 * kept compact: NALIK + base36 millisecond timestamp + random + the last 4
 * digits of the registration referenceId for traceability. Unique per attempt
 * (retries always get a fresh value).
 */
export function generateTxRef(referenceId: string): string {
  const stamp = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 1296).toString(36); // 2 base36 chars
  const suffix = String(referenceId).slice(-4);
  return `NALIK${stamp}${rand}${suffix}`;
}

/**
 * Chapa requires international phone format (e.g. +251960724272). Normalize
 * common Ethiopian numbers (09… / 07… / 251…) and leave anything else as-is.
 */
export function normalizePhoneForChapa(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("251")) return `+${digits}`;
  if (digits.length === 10 && (digits.startsWith("09") || digits.startsWith("07"))) {
    return `+251${digits.slice(1)}`;
  }
  if (digits.length > 9 && digits.startsWith("251")) return `+${digits}`;
  return undefined;
}

/** Extract the Chapa payment reference (slug) from a hosted checkout URL. */
export function parseChapaReference(checkoutUrl: string): string {
  try {
    const segments = new URL(checkoutUrl).pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] || "";
  } catch {
    return "";
  }
}

// ── Initialize hosted checkout ─────────────────────────────────────────────

export interface ChapaInitInput {
  amount: number;
  currency: string;
  merchantReference: string;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number?: string;
  };
  meta?: Record<string, unknown>;
}

export interface ChapaInitResult {
  checkoutUrl: string;
  chapaReference: string;
}

export async function initializeChapaPayment(input: ChapaInitInput): Promise<ChapaInitResult> {
  const key = chapaSecretKey();
  if (!key) throw new Error("Chapa is not configured (CHAPA_SECRET_KEY missing)");

  const res = await fetch(`${CHAPA_BASE_URL}/v2/payments/hosted`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      merchant_reference: input.merchantReference,
      customer: input.customer,
      meta: input.meta,
    }),
    cache: "no-store",
  });
  const data: unknown = await res.json().catch(() => null);

  if (!res.ok || !data || (data as { status?: string }).status !== "success") {
    const body = (data ?? {}) as { message?: string; error?: { code?: string; details?: string } };
    const detail = [body.error?.code, body.message || body.error?.details].filter(Boolean).join(": ");
    throw new Error(`Chapa init failed (HTTP ${res.status})${detail ? ` — ${detail}` : ""}`);
  }

  const checkoutUrl = (data as { data?: { checkout_url?: string } })?.data?.checkout_url;
  if (!checkoutUrl) throw new Error("Chapa init response missing checkout_url");

  return { checkoutUrl, chapaReference: parseChapaReference(checkoutUrl) };
}

// ── Verify ─────────────────────────────────────────────────────────────────

export interface ChapaVerification {
  /** Normalized status: success | pending | failed | cancelled | incomplete | blocked | auth_needed */
  status: string;
  chapaReference: string;
  merchantReference: string;
  amount: number;
  currency: string;
  method?: string;
  serviceFee?: number;
  customer?: Record<string, unknown> | null;
}

export class PaymentNotFoundError extends Error {
  constructor() {
    super("Chapa payment not found");
    this.name = "PaymentNotFoundError";
  }
}

export async function verifyChapaPayment(reference: string): Promise<ChapaVerification> {
  const key = chapaSecretKey();
  if (!key) throw new Error("Chapa is not configured (CHAPA_SECRET_KEY missing)");

  const res = await fetch(`${CHAPA_BASE_URL}/v2/payments/${encodeURIComponent(reference)}/verify`, {
    method: "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  const data: unknown = await res.json().catch(() => null);

  if (!res.ok || !data || (data as { status?: string }).status !== "success" || !(data as { data?: unknown }).data) {
    throw new PaymentNotFoundError();
  }

  const d = (data as { data: Record<string, unknown> }).data;
  return {
    status: String(d.status ?? "").toLowerCase() || "unknown",
    chapaReference: String(d.chapa_reference ?? reference),
    merchantReference: String(d.merchant_reference ?? ""),
    amount: Number(d.amount ?? 0),
    currency: String(d.currency ?? "ETB"),
    method: d.payment_method ? String(d.payment_method) : undefined,
    serviceFee: d.service_fee != null ? Number(d.service_fee) : undefined,
    customer: d.customer && typeof d.customer === "object" ? (d.customer as Record<string, unknown>) : null,
  };
}

// ── Webhook signature ──────────────────────────────────────────────────────

/**
 * Verify the x-chapa-signature header: lowercase hex HMAC-SHA256 over the raw
 * request body using the webhook secret, compared in constant time.
 */
export function isValidChapaWebhook(rawBody: string | Buffer, signature: string | null): boolean {
  const secret = chapaWebhookSecret();
  if (!secret || !signature) return false;
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}