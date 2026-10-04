// ── Chapa V2 REST client ────────────────────────────────────────────────
// Docs: https://docs.chapa.global/docs/v2/integrations/accept-payment
//       https://docs.chapa.global/docs/v2/integrations/verify-payment

const CHAPA_API_BASE = "https://api.chapa.global/v2";
const DEFAULT_CURRENCY = "ETB" as const;
const REQUEST_TIMEOUT_MS = 20_000;

if (typeof window !== "undefined") {
  throw new Error("src/lib/payments/chapa.ts is server-only and must not be imported into client code.");
}

export class ChapaConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChapaConfigError";
  }
}

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

function getSecretKey(): string {
  const key = process.env.CHAPA_SECRET_KEY?.trim();
  if (!key) {
    throw new ChapaConfigError("CHAPA_SECRET_KEY is not configured. Add it to the server environment.");
  }
  return key;
}

interface ChapaEnvelope {
  status?: string;
  message?: string;
  data?: Record<string, unknown>;
  error?: { code?: string; details?: unknown } | string | null;
}

async function chapaFetch<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown }
): Promise<T> {
  const key = getSecretKey();

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
    const code =
      typeof payload.error === "string"
        ? payload.error
        : payload.error && typeof payload.error === "object" && "code" in payload.error
        ? String(payload.error.code)
        : undefined;
    throw new ChapaApiError(
      payload.message || `Chapa request failed with HTTP ${response.status}`,
      { httpStatus: response.status, code }
    );
  }

  return (payload.data ?? payload) as T;
}

export interface InitiatePaymentInput {
  amount: number;
  currency?: typeof DEFAULT_CURRENCY;
  merchant_reference: string;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
  };
  return_url: string;
  callback_url: string;
  customization?: {
    title?: string;
    description?: string;
  };
  meta?: Record<string, string>;
}

export interface InitiatePaymentResult {
  checkout_url: string;
  created_at: string;
  expires_at: string;
}

export async function initiatePayment(
  input: InitiatePaymentInput
): Promise<InitiatePaymentResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new ChapaConfigError("Chapa amount must be a positive number.");
  }
  if (!input.merchant_reference?.trim()) {
    throw new ChapaConfigError("Chapa merchant_reference is required.");
  }
  if (!input.customer.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customer.email)) {
    throw new ChapaConfigError("Valid email is required.");
  }
  if (!input.customer.first_name?.trim()) {
    throw new ChapaConfigError("First name is required.");
  }
  if (!input.customer.last_name?.trim()) {
    throw new ChapaConfigError("Last name is required.");
  }
  if (!input.customer.phone_number?.trim()) {
    throw new ChapaConfigError("Phone number is required.");
  }
  if (!input.return_url?.trim()) {
    throw new ChapaConfigError("Return URL is required.");
  }
  if (!input.callback_url?.trim()) {
    throw new ChapaConfigError("Callback URL is required.");
  }

  const body = {
    amount: input.amount,
    currency: input.currency ?? DEFAULT_CURRENCY,
    merchant_reference: input.merchant_reference,
    customer: input.customer,
    return_url: input.return_url,
    callback_url: input.callback_url,
    ...(input.customization ? { customization: input.customization } : {}),
    ...(input.meta ? { meta: input.meta } : {}),
  };

  const data = await chapaFetch<Record<string, unknown>>("/payments/hosted", {
    method: "POST",
    body,
  });

  const checkoutUrl = typeof data.checkout_url === "string" ? data.checkout_url : "";
  if (!checkoutUrl) {
    throw new ChapaApiError("Chapa did not return a checkout_url.");
  }

  return {
    checkout_url: checkoutUrl,
    created_at: typeof data.created_at === "string" ? data.created_at : new Date().toISOString(),
    expires_at: typeof data.expires_at === "string" ? data.expires_at : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export interface VerifyPaymentResult {
  status: string;
  amount: number | null;
  currency: string | null;
  merchant_reference: string | null;
  chapa_reference: string | null;
  payment_method: string | null;
  service_fee: number | null;
  created_at: string | null;
  updated_at: string | null;
  raw: unknown;
}

export async function verifyPayment(merchantReference: string): Promise<VerifyPaymentResult> {
  if (!merchantReference?.trim()) {
    throw new ChapaConfigError("A merchant_reference is required to verify.");
  }

  const data = await chapaFetch<Record<string, unknown>>(
    `/payments/${encodeURIComponent(merchantReference.trim())}/verify`,
    { method: "GET" }
  );

  return {
    status: typeof data.status === "string" ? data.status : "PENDING",
    amount: typeof data.amount === "number" ? data.amount : typeof data.amount === "string" ? Number(data.amount) : null,
    currency: typeof data.currency === "string" ? data.currency : null,
    merchant_reference:
      typeof data.merchant_reference === "string"
        ? data.merchant_reference
        : typeof data.tx_ref === "string"
          ? data.tx_ref
          : null,
    chapa_reference: typeof data.chapa_reference === "string" ? data.chapa_reference : null,
    payment_method: typeof data.payment_method === "string" ? data.payment_method : null,
    service_fee: typeof data.service_fee === "number" ? data.service_fee : typeof data.service_fee === "string" ? Number(data.service_fee) : null,
    created_at: typeof data.created_at === "string" ? data.created_at : null,
    updated_at: typeof data.updated_at === "string" ? data.updated_at : null,
    raw: data,
  };
}