// ── Chapa v2 REST client ────────────────────────────────────────────────
// Docs (v2):
//   Hosted checkout: https://docs.chapa.global/docs/v2/integrations/accept-payment
//   Verification:    https://docs.chapa.global/docs/v2/integrations/verify-payment
//   Inline.js:       https://docs.chapa.global/docs/v2/integrations/inline-js
//
// Flow: create a hosted session server-side (POST /v2/payments/hosted) →
// redirect the browser to the returned checkout_url → verify on return
// (GET /v2/payments/<reference>/verify). Redirects, callbacks and webhooks are
// signals, never proof: only a verified response may settle a payment.
//
// The secret key never leaves the server. The browser only ever receives the
// checkout URL, so a hosted checkout needs no public key at all.

const CHAPA_API_BASE = "https://api.chapa.global/v2";
const DEFAULT_CURRENCY = "ETB" as const;
const REQUEST_TIMEOUT_MS = 20_000;

// SECURITY: reads CHAPA_SECRET_KEY / NEXT_PUBLIC_CHAPA_PUBLIC_KEY and must
// never be bundled into client code. Fail loudly if it is ever imported from a
// Client Component instead of relying on reviewer discipline.
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/payments/chapa.ts is server-only and must not be imported into client code."
  );
}

// ── Errors ────────────────────────────────────────────────────────────────

/** Missing or malformed environment configuration. Never surfaced to browsers. */
export class ChapaConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChapaConfigError";
  }
}

/** Chapa answered with a non-2xx status, or with an `status: "error"` envelope. */
export class ChapaApiError extends Error {
  readonly httpStatus: number | undefined;
  readonly code: string | undefined;

  constructor(
    message: string,
    options: { httpStatus?: number; code?: string } = {}
  ) {
    super(message);
    this.name = "ChapaApiError";
    this.httpStatus = options.httpStatus;
    this.code = options.code;
  }
}

// ── Config & key normalization ────────────────────────────────────────────

export type ChapaKeyKind = "secret" | "public";

/**
 * Accepted key prefixes per kind.
 *
 * This integration targets Chapa API v2 exclusively, so only the v2 key
 * formats are accepted: `CHAPA_TEST_…` / `CHAPA_LIVE_…` for the secret key
 * (see the Authorization header in the v2 docs). The legacy v1 `CHASECK-…`
 * secret is deliberately rejected — it will not authenticate against the v2
 * API — so a misconfigured key fails loudly at startup/unset time instead of
 * surfacing as an opaque 401 at checkout. An unrecognised prefix throws with
 * the accepted list, so a future key format fails legibly too.
 */
const KEY_PREFIXES: Record<ChapaKeyKind, readonly string[]> = {
  secret: ["CHAPA_TEST_", "CHAPA_LIVE_"],
  public: ["CHAPUBK_TEST_", "CHAPUBK_LIVE_"],
};

/**
 * Strips surrounding quotes and whitespace, then validates the key prefix.
 * Returns undefined for an unset/blank value; throws for a malformed one.
 */
export function normalizeChapaKey(
  raw: string | undefined | null,
  kind: ChapaKeyKind
): string | undefined {
  if (typeof raw !== "string") return undefined;

  const cleaned = raw.trim().replace(/^["']+|["']+$/g, "").trim();
  if (!cleaned) return undefined;

  const prefixes = KEY_PREFIXES[kind];
  if (!prefixes.some((prefix) => cleaned.startsWith(prefix))) {
    throw new ChapaConfigError(
      `Chapa ${kind} key has an unrecognised format. Expected one of: ${prefixes.join(", ")}`
    );
  }
  return cleaned;
}

/** Cleaned server-side secret key, or undefined when unset. */
export function getChapaSecretKey(): string | undefined {
  return normalizeChapaKey(process.env.CHAPA_SECRET_KEY, "secret");
}

/**
 * Cleaned public key for Inline.js, or undefined when unset. Hosted checkout
 * does not need it — only an in-page Inline.js embed does.
 */
export function getChapaPublicKey(): string | undefined {
  return normalizeChapaKey(
    process.env.NEXT_PUBLIC_CHAPA_PUBLIC_KEY,
    "public"
  );
}

function requireSecretKey(): string {
  const key = getChapaSecretKey();
  if (!key) {
    throw new ChapaConfigError(
      "CHAPA_SECRET_KEY is not configured. Add it to the server environment."
    );
  }
  return key;
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface ChapaCustomer {
  first_name: string;
  last_name: string;
  email: string;
  /** Must be international format, e.g. "+251960724272". */
  phone_number: string;
}

export interface InitiatePaymentInput {
  /** Amount in the given currency, in major units (e.g. 2500 ETB). */
  amount: number;
  /** Our unique reference for this attempt. Must be unique per attempt. */
  merchantReference: string;
  customer: ChapaCustomer;
  /** Free-form internal metadata for reconciliation. */
  meta?: Record<string, string>;
  currency?: typeof DEFAULT_CURRENCY;
}

/** Normalized hosted-session result. Field names mirror the Chapa response. */
export interface InitiatePaymentResult {
  checkout_url: string;
  /**
   * Chapa's own payment reference. The v2 hosted-init response does not always
   * include it — it is normally obtained from verification or a webhook — so
   * this may be null.
   */
  chapa_reference: string | null;
  merchant_reference: string | null;
}

export type PaymentStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "INCOMPLETE";

/** Normalized result of a verification call. */
export interface ChapaVerification {
  status: PaymentStatus;
  amount: number | null;
  currency: string | null;
  chapaReference: string | null;
  merchantReference: string | null;
  paymentMethod: string | null;
  serviceFee: number | null;
  customer: ChapaCustomer | null;
  createdAt: string | null;
  updatedAt: string | null;
  /** The untouched provider payload, for auditing. */
  raw: unknown;
}

interface ChapaEnvelope {
  status?: string;
  message?: string;
  data?: Record<string, unknown>;
  error?: { code?: string; details?: unknown } | string | null;
}

// ── Status mapping ────────────────────────────────────────────────────────

/**
 * Maps Chapa's payment status onto our stored statuses. Chapa reports
 * lowercase values and also uses compound strings on some providers, so the
 * input is tokenized and scanned for the first known status.
 */
export function mapChapaStatus(status: unknown): PaymentStatus {
  const raw = typeof status === "string" ? status.trim().toLowerCase() : "";

  const table: Record<string, PaymentStatus> = {
    success: "SUCCESS",
    completed: "SUCCESS",
    successful: "SUCCESS",
    failed: "FAILED",
    failure: "FAILED",
    pending: "PENDING",
    processing: "PENDING",
    cancelled: "CANCELLED",
    canceled: "CANCELLED",
    reversed: "CANCELLED",
    refunded: "CANCELLED",
    incomplete: "INCOMPLETE",
    abandoned: "INCOMPLETE",
    timeout: "INCOMPLETE",
    blocked: "FAILED",
  };

  for (const token of raw.split(/[\s/|,&]+/).filter(Boolean)) {
    if (table[token]) return table[token];
  }
  return table[raw] ?? "PENDING";
}

// ── Transport ─────────────────────────────────────────────────────────────

function extractErrorCode(error: ChapaEnvelope["error"]): string | undefined {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

async function chapaFetch<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown }
): Promise<T> {
  const key = requireSecretKey();

  let response: Response;
  try {
    response = await fetch(`${CHAPA_API_BASE}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    // Network failure, DNS failure, or the abort above. Never leak the key.
    throw new ChapaApiError(
      `Could not reach Chapa: ${cause instanceof Error ? cause.message : "unknown error"}`
    );
  }

  const text = await response.text();
  let payload: ChapaEnvelope = {};
  if (text) {
    try {
      payload = JSON.parse(text) as ChapaEnvelope;
    } catch {
      payload = {};
    }
  }

  const envelopeErrored = payload.status === "error";
  if (!response.ok || envelopeErrored) {
    const code = extractErrorCode(payload.error);
    throw new ChapaApiError(
      payload.message || `Chapa request failed with HTTP ${response.status}`,
      { httpStatus: response.status, code }
    );
  }

  // Chapa nests the payload under `data`; fall back to the envelope itself so
  // a flatter response shape still works.
  return (payload.data ?? payload) as T;
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  // Chapa v2 returns numeric fields (amount, service_fee) as strings in both
  // the webhook payload and the verify response (e.g. "40000"). Accept both
  // the native number form and the quoted-number form that the API sends.
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[\s,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// ── Client ────────────────────────────────────────────────────────────────

/**
 * Creates a hosted checkout session.
 *
 * POST /v2/payments/hosted → the browser is redirected to `checkout_url`.
 * Amount is always supplied by the caller from the database, never from the
 * browser.
 *
 * Chapa v2 hosted checkout carries no redirect/callback fields in this request:
 * the documented body is amount/currency/merchant_reference/customer/meta. The
 * browser return URL and the webhook endpoint are configured per business in
 * the Chapa dashboard, and Chapa appends the transaction parameters to the
 * configured Redirect URL. Those parameters are a UX signal only — the payment
 * is settled exclusively from server-side verification and signed webhooks.
 */
export async function initiatePayment(
  input: InitiatePaymentInput
): Promise<InitiatePaymentResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new ChapaConfigError("Chapa amount must be a positive number.");
  }
  if (!input.merchantReference?.trim()) {
    throw new ChapaConfigError("Chapa merchant_reference is required.");
  }

  const data = await chapaFetch<Record<string, unknown>>("/payments/hosted", {
    method: "POST",
    body: {
      amount: input.amount,
      currency: input.currency ?? DEFAULT_CURRENCY,
      merchant_reference: input.merchantReference,
      customer: input.customer,
      ...(input.meta ? { meta: input.meta } : {}),
    },
  });

  const checkoutUrl = readString(data, "checkout_url");
  if (!checkoutUrl) {
    throw new ChapaApiError("Chapa did not return a checkout_url.");
  }

  return {
    checkout_url: checkoutUrl,
    chapa_reference: readString(data, "chapa_reference"),
    merchant_reference:
      readString(data, "merchant_reference") ?? input.merchantReference,
  };
}

/**
 * Verifies a payment with Chapa. The only trustworthy signal that money moved.
 *
 * GET /v2/payments/<reference>/verify — v2 resolves the Chapa reference
 * (`chapa_reference`) returned at initialization or via webhook. Callers
 * should pass that when they have it and fall back to our merchant reference
 * otherwise; verification also returns the provider's own `chapa_reference`.
 *
 * Callers MUST additionally check that the returned amount and currency match
 * what was expected, and that the payment has not already been applied.
 */
export async function verifyPayment(
  reference: string
): Promise<ChapaVerification> {
  if (!reference?.trim()) {
    throw new ChapaConfigError("A reference is required to verify.");
  }

  const data = await chapaFetch<Record<string, unknown>>(
    `/payments/${encodeURIComponent(reference.trim())}/verify`,
    { method: "GET" }
  );

  const customer =
    data.customer && typeof data.customer === "object"
      ? (data.customer as ChapaCustomer)
      : null;

  return {
    status: mapChapaStatus(data.status),
    amount: readNumber(data, "amount"),
    currency: readString(data, "currency"),
    chapaReference: readString(data, "chapa_reference"),
    // Chapa's older responses misspell this key; accept both.
    merchantReference:
      readString(data, "merchant_reference") ??
      readString(data, "merchant_referece"),
    paymentMethod: readString(data, "payment_method"),
    serviceFee: readNumber(data, "service_fee"),
    customer,
    createdAt: readString(data, "created_at"),
    updatedAt: readString(data, "updated_at"),
    raw: data,
  };
}