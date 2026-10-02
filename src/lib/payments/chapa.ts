// ── Chapa v2 hosted checkout + server-side verification ───────────────────
// Official docs:
//   Hosted payments: https://docs.chapa.global/docs/v2/integrations/accept-payment
//   Verify:          https://docs.chapa.global/docs/v2/integrations/verify-payment
//   Webhooks:        https://docs.chapa.global/docs/v2/integrations/webhooks
//
// Hosted checkout sessions are created server-side with a secret key. The
// browser receives only Chapa's checkout URL and redirects the customer there.
//
// Amount and currency come from the payment record. The server creates the
// hosted session and verifies the provider reference before accepting payment.
//   Initialize: POST https://api.chapa.global/v2/payments/hosted
//   Verify:     GET https://api.chapa.global/v2/payments/<reference>/verify
//   Webhook:    x-chapa-signature = HMAC-SHA256(secret, raw request body)
//
// No secret key is sent to the browser.

import crypto from "crypto";

// SECURITY: this module reads CHAPA_SECRET_KEY / CHAPA_WEBHOOK_SECRET and must
// never be bundled into client code. Fail loudly if it is ever imported from a
// Client Component instead of relying on reviewer discipline.
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/payments/chapa.ts is server-only and must not be imported into client code."
  );
}

const CHAPA_V2_BASE_URL = "https://api.chapa.global/v2";

// ── Env / config ──────────────────────────────────────────────────────────

/** Returns a cleaned Chapa secret key or undefined if it is absent. */
export function chapaSecretKey(): string | undefined {
  try {
    const raw = process.env.CHAPA_SECRET_KEY;
    if (!raw) return undefined;
    return normalizeChapaKey(raw, "secret");
  } catch {
    return undefined;
  }
}

/** Returns a cleaned Chapa public key or undefined if it is absent. */
export function chapaPublicKey(): string | undefined {
  try {
    const raw = process.env.CHAPA_PUBLIC_KEY || process.env.NEXT_PUBLIC_CHAPA_PUBLIC_KEY;
    if (!raw) return undefined;
    return normalizeChapaKey(raw, "public");
  } catch {
    return undefined;
  }
}

/** Webhook "secret hash" configured in the Chapa dashboard → Webhooks. */
export function chapaWebhookSecret(): string | undefined {
  const raw = process.env.CHAPA_WEBHOOK_SECRET;
  return raw?.trim().replace(/^['"]+|['"]+$/g, "") || undefined;
}

export function isChapaConfigured(): boolean {
  return Boolean(chapaV2SecretKey());
}

// ── Key format validation ─────────────────────────────────────────────────
// Chapa keys have changed naming formats across versions. We accept both the
// older CHAPUBK_/CHASECK_ names and the newer CHAPA_TEST_PUB_/CHAPA_TEST_PRIV_
// family as well as stripped/quoted values and the more compact PUBK_/SECK_
// variants used by some dashboard exports. The app still rejects a secret key in
// the public slot and any TEST/LIVE mix.
const PUBLIC_KEY_RE = /^(?:(?:CHAPUBK|PUBK)[-_](TEST|LIVE)[-_]|CHAPA[-_](TEST|LIVE)[-_](?:PUB|PUBLIC)[-_])[A-Za-z0-9_-]+$/i;
const SECRET_KEY_RE = /^(?:(?:CHASECK|SECK)[-_](TEST|LIVE)[-_]|CHAPA[-_](TEST|LIVE)[-_](?:(?:PRIV|PRIVATE)[-_]|(?!PUB(?:LIC)?[-_])))[A-Za-z0-9_-]+$/i;
const V2_SECRET_KEY_RE = /^CHAPA[-_](TEST|LIVE)[-_](?:(?:PRIV|PRIVATE)[-_])?(?!PUB(?:LIC)?[-_])[A-Za-z0-9_-]+$/i;

export function chapaV2SecretKey(): string | undefined {
  const key = chapaSecretKey();
  return key && V2_SECRET_KEY_RE.test(key) ? key : undefined;
}

function cleanChapaKey(value: unknown): string {
  return (typeof value === "string" ? value : "")
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .replace(/[\r\n\t\s]+/g, "");
}

export function normalizeChapaKey(value: unknown, kind: "public" | "secret"): string {
  const cleaned = cleanChapaKey(value);

  if (!cleaned) {
    throw new Error(`${kind === "public" ? "CHAPA_PUBLIC_KEY" : "CHAPA_SECRET_KEY"} is empty or missing`);
  }

  const regex = kind === "public" ? PUBLIC_KEY_RE : SECRET_KEY_RE;
  if (!regex.test(cleaned)) {
    throw new Error(
      `${kind === "public" ? "CHAPA_PUBLIC_KEY" : "CHAPA_SECRET_KEY"} is invalid. Expected a Chapa public key or a v1/v2 secret key.`
    );
  }

  return cleaned;
}

export type ChapaKeyMode = "TEST" | "LIVE";

function keyMode(regex: RegExp, key: string): ChapaKeyMode | undefined {
  const match = key.match(regex);
  return (match?.[1] || match?.[2]) as ChapaKeyMode | undefined;
}

export function chapaPublicKeyMode(): ChapaKeyMode | undefined {
  const key = chapaPublicKey();
  return key ? keyMode(PUBLIC_KEY_RE, key) : undefined;
}

export function chapaSecretKeyMode(): ChapaKeyMode | undefined {
  const key = chapaSecretKey();
  return key ? keyMode(SECRET_KEY_RE, key) : undefined;
}

/** Classifies a key's shape without ever exposing its value. */
function describeKeyType(key: string): string {
  if (/^CHASECK/i.test(key) || /^CHAPA.*PRIV/i.test(key)) return "a CHASECK / CHAPA secret key";
  if (/^CHAPUBK/i.test(key) || /^CHAPA.*PUB/i.test(key)) return "a CHAPUBK / CHAPA public key";
  return "a key with an unrecognized prefix";
}

/**
 * Human-readable config problems. Safe to return to a browser — it names key
 * TYPES and modes, never key values.
 */
export function chapaConfigurationProblems(): string[] {
  const problems: string[] = [];
  const pub = chapaPublicKey();
  const sec = chapaV2SecretKey();

  if (pub && !PUBLIC_KEY_RE.test(pub))
    problems.push(
      `CHAPA_PUBLIC_KEY is ${describeKeyType(pub)} — Inline.js needs a CHAPUBK_TEST-/CHAPUBK_LIVE- or CHAPA_TEST_PUB-/CHAPA_LIVE_PUB- public key`
    );
  if (!sec) problems.push("CHAPA_SECRET_KEY must be a Chapa v2 key (CHAPA_TEST_… or CHAPA_LIVE_…)");
  else if (!SECRET_KEY_RE.test(sec))
    problems.push(
      `CHAPA_SECRET_KEY is ${describeKeyType(sec)} — v2 server requests need a CHAPA_TEST_ or CHAPA_LIVE_ secret key`
    );

  const pubMode = chapaPublicKeyMode();
  const secMode = sec ? keyMode(V2_SECRET_KEY_RE, sec) : undefined;
  if (pubMode && secMode && pubMode !== secMode)
    problems.push(
      `Key mode mismatch: the public key is ${pubMode} but the secret key is ${secMode} — TEST and LIVE keys cannot be mixed`
    );

  return problems;
}

export interface ChapaHostedPaymentRequest {
  amount: number;
  currency: string;
  merchant_reference: string;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number?: string;
  };
  meta?: Record<string, string>;
  return_url?: string;
}

interface ChapaHostedPaymentResponse {
  status?: string;
  message?: string;
  code?: string;
  data?: {
    checkout_url?: string;
    chapa_reference?: string;
    reference?: string;
  } | null;
}

export class ChapaHostedPaymentError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly providerCode?: string
  ) {
    super(message);
    this.name = "ChapaHostedPaymentError";
  }
}

export async function createChapaHostedPayment(
  payload: ChapaHostedPaymentRequest,
  configuredKey: string | undefined = chapaV2SecretKey()
): Promise<{ checkoutUrl: string; chapaReference?: string }> {
  if (!configuredKey) throw new Error("Chapa is not configured (CHAPA_SECRET_KEY missing)");
  const key = normalizeChapaKey(configuredKey, "secret");
  if (!V2_SECRET_KEY_RE.test(key)) throw new Error("CHAPA_SECRET_KEY must use a Chapa v2 key (CHAPA_TEST_… or CHAPA_LIVE_…)");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${CHAPA_V2_BASE_URL}/payments/hosted`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => null)) as ChapaHostedPaymentResponse | null;
    const checkoutUrl = body?.data?.checkout_url;
    if (!response.ok || body?.status?.toLowerCase() !== "success" || !checkoutUrl) {
      throw new ChapaHostedPaymentError(
        body?.message || `Chapa hosted payment initialization failed (HTTP ${response.status})`,
        response.status,
        body?.code
      );
    }

    return {
      checkoutUrl,
      chapaReference: body.data?.chapa_reference || body.data?.reference || undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ── References & phone normalization ───────────────────────────────────────

/**
 * Unique merchant_reference generated per payment attempt and correlated with
 * Chapa v2 verification responses and webhook events.
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

/** Normalizes Ethiopian phone numbers to the international format required by v2. */
export function normalizePhoneForChapaV2(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("251") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits;
  return /^[97]\d{8}$/.test(local) ? `+251${local}` : undefined;
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

interface ChapaVerifyData {
  status?: string;
  amount?: number | string;
  currency?: string;
  chapa_reference?: string;
  merchant_reference?: string;
  payment_method?: string;
  service_fee?: number | string;
  mode?: string;
}

interface ChapaVerifyResponse {
  message?: string;
  status?: string;
  data?: ChapaVerifyData | null;
}

export async function verifyChapaTransaction(
  chapaReference: string,
  configuredKey: string | undefined = chapaV2SecretKey()
): Promise<ChapaVerification> {
  if (!configuredKey) throw new Error("Chapa is not configured (CHAPA_SECRET_KEY missing)");
  const key = normalizeChapaKey(configuredKey, "secret");
  if (!V2_SECRET_KEY_RE.test(key)) throw new Error("CHAPA_SECRET_KEY must use a Chapa v2 key (CHAPA_TEST_… or CHAPA_LIVE_…)");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(
      `${CHAPA_V2_BASE_URL}/payments/${encodeURIComponent(chapaReference)}/verify`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      }
    );
    const body = (await response.json().catch(() => null)) as ChapaVerifyResponse | null;
    const data = body?.data;

    if (!response.ok || !data) {
      const message = chapaMessage(body);
      if (response.status === 404 || /not found/i.test(message)) {
        throw new PaymentNotFoundError(message || "Chapa payment not found");
      }
      throw new Error(message || `Chapa verify failed (HTTP ${response.status})`);
    }

    return {
      status: String(data.status || "pending").trim().toLowerCase(),
      chapaReference: String(data.chapa_reference || chapaReference),
      txRef: String(data.merchant_reference || ""),
      amount: Number(data.amount ?? 0),
      currency: String(data.currency || "ETB"),
      method: data.payment_method ? String(data.payment_method) : undefined,
      charge: data.service_fee != null ? Math.round(Number(data.service_fee)) : undefined,
      mode: data.mode ? String(data.mode) : undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ── Webhook signature ──────────────────────────────────────────────────────

function timingSafeHexEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/** Verifies the v2 HMAC signature against the exact raw request bytes. */
export function isValidChapaWebhook(
  rawBody: Buffer,
  xSignature: string | null
): boolean {
  const secret = chapaWebhookSecret();
  if (!secret || !xSignature || !/^[a-f0-9]{64}$/i.test(xSignature)) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeHexEqual(xSignature, expected);
}
