import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createPaymentReturnToken } from "@/lib/payments/returnToken";

const CHAPA_API_BASE = "https://api.chapa.global/v2";
const CHAPA_CHECKOUT_HOST = "checkout.chapa.global";
type ChapaMode = "test" | "live";
type PaymentStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "INCOMPLETE"
  | "BLOCKED"
  | "AUTH_NEEDED"
  | "INVALID";

export interface VerifiedChapaPayment {
  // Chapa returns null until a payment attempt has produced a reference.
  chapaReference: string | null;
  merchantReference: string;
  amount: number;
  serviceFee: number | null;
  currency: string;
  status: PaymentStatus;
}

interface ChapaApiResponse {
  status?: unknown;
  message?: unknown;
  data?: unknown;
}

function getChapaCredentials(): { secretKey: string; mode: ChapaMode } {
  const secretKey = process.env.CHAPA_SECRET_KEY?.trim();
  if (!secretKey) throw new Error("CHAPA_SECRET_KEY is not configured");
  if (secretKey.startsWith("CHAPA_TEST_")) return { secretKey, mode: "test" };
  if (secretKey.startsWith("CHAPA_LIVE_")) return { secretKey, mode: "live" };
  throw new Error("CHAPA_SECRET_KEY must be a Chapa TEST or LIVE secret key");
}

/** The environment of the configured secret key; Chapa webhooks must match it. */
export function getChapaMode(): ChapaMode {
  return getChapaCredentials().mode;
}

export function verifyChapaWebhookSignature(rawBody: Buffer, signature: string | null): boolean {
  // Trim so a trailing newline/space pasted into the hosting env does not
  // silently invalidate every HMAC (the signature covers the body only).
  const secret = process.env.CHAPA_WEBHOOK_SECRET?.trim();
  if (!secret || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const supplied = Buffer.from(signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function normalizeChapaStatus(status: unknown): PaymentStatus {
  if (typeof status !== "string") return "INVALID";

  switch (status.toLowerCase()) {
    case "success":
      return "SUCCESS";
    case "pending":
      return "PENDING";
    case "failed":
      return "FAILED";
    case "cancelled":
      return "CANCELLED";
    case "incomplete":
      return "INCOMPLETE";
    case "blocked":
      return "BLOCKED";
    case "auth_needed":
      return "AUTH_NEEDED";
    default:
      return "INVALID";
  }
}

/** Chapa returns integer cents as either a JSON number or a numeric string. */
export function parseChapaAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return value >= 0 && Number.isSafeInteger(value) ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d+(?:\.0+)?$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  return Number.isSafeInteger(amount) ? amount : null;
}

/**
 * Chapa reports the initialized (net) amount on verification, but some
 * responses (for example List Payments and webhooks) report the gross amount
 * with service_fee included. Accept either representation.
 */
export function chapaAmountMatches(
  amount: number,
  serviceFee: number | null,
  expected: number,
): boolean {
  return amount === expected || (serviceFee !== null && amount - serviceFee === expected);
}

export function parseVerifiedChapaPayment(
  response: unknown,
  expected: {
    merchantReference: string;
    amount: number;
    currency: string;
  },
): VerifiedChapaPayment | null {
  if (!response || typeof response !== "object") return null;
  const body = response as ChapaApiResponse;
  if (body.status !== "success" || !body.data || typeof body.data !== "object") return null;

  const data = body.data as Record<string, unknown>;
  const amount = parseChapaAmount(data.amount);
  const serviceFee = parseChapaAmount(data.service_fee);
  const chapaReference =
    typeof data.chapa_reference === "string" && data.chapa_reference
      ? data.chapa_reference
      : null;
  const merchantReference = data.merchant_reference;
  const currency = data.currency;
  const status = normalizeChapaStatus(data.status);

  if (
    typeof merchantReference !== "string" ||
    typeof currency !== "string" ||
    amount === null ||
    merchantReference !== expected.merchantReference ||
    !chapaAmountMatches(amount, serviceFee, expected.amount) ||
    currency.toUpperCase() !== expected.currency.toUpperCase() ||
    status === "INVALID" ||
    // A completed payment must carry Chapa's own reference.
    (status === "SUCCESS" && chapaReference === null)
  ) {
    return null;
  }

  return {
    chapaReference,
    merchantReference,
    amount,
    serviceFee,
    currency: currency.toUpperCase(),
    status,
  };
}

export function normalizeEthiopianPhone(phone: string): string | null {
  const compact = phone.replace(/[\s()-]/g, "");
  if (/^\+251[79]\d{8}$/.test(compact)) return compact;
  if (/^251[79]\d{8}$/.test(compact)) return `+${compact}`;
  if (/^0[79]\d{8}$/.test(compact)) return `+251${compact.slice(1)}`;
  return null;
}

export function toChapaMinorUnits(amountInBirr: number): number | null {
  if (!Number.isSafeInteger(amountInBirr) || amountInBirr <= 1) return null;
  const amount = amountInBirr * 100;
  return Number.isSafeInteger(amount) && amount > 100 && amount <= 2_147_483_647
    ? amount
    : null;
}

export function generateMerchantReference(): string {
  return `NA${randomBytes(9).toString("hex")}`;
}

function getReturnUrl(paymentId: string): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return null;
  try {
    const parsed = new URL(appUrl);
    if (parsed.protocol !== "https:") return null;
    const token = createPaymentReturnToken(paymentId);
    const path = token
      ? `/checkout/return?payment=${encodeURIComponent(token)}`
      : "/checkout/return";
    return new URL(path, parsed.origin).toString();
  } catch {
    return null;
  }
}

export async function initializeHostedPayment(paymentId: string): Promise<string> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      registration: {
        include: { course: { select: { title: true } } },
      },
    },
  });
  if (!payment) throw new Error("PAYMENT_NOT_FOUND");
  if (payment.status !== "PENDING") throw new Error("PAYMENT_NOT_PENDING");
  if (payment.checkoutUrl) return payment.checkoutUrl;

  const nameParts = payment.registration.fullName.trim().split(/\s+/);
  const phoneNumber = normalizeEthiopianPhone(payment.registration.phone);
  if (!phoneNumber) throw new Error("INVALID_CUSTOMER_PHONE");

  const customer: Record<string, string> = {
    first_name: nameParts[0],
    last_name: nameParts.slice(1).join(" ") || nameParts[0],
    phone_number: phoneNumber,
  };
  if (payment.registration.email) customer.email = payment.registration.email;

  const returnUrl = getReturnUrl(payment.id);
  const response = await fetch(`${CHAPA_API_BASE}/payments/hosted`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getChapaCredentials().secretKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": payment.merchantReference,
    },
    body: JSON.stringify({
      amount: payment.amount,
      currency: payment.currency,
      merchant_reference: payment.merchantReference,
      customer,
      ...(returnUrl ? { return_url: returnUrl } : {}),
      meta: {
        registration_reference: payment.registration.referenceId,
        course: payment.registration.course.title,
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("CHAPA_INVALID_RESPONSE");
  }
  const data =
    body && typeof body === "object" && "data" in body
      ? (body as { data?: unknown }).data
      : null;
  const checkoutUrl =
    data && typeof data === "object" && "checkout_url" in data
      ? (data as { checkout_url?: unknown }).checkout_url
      : null;
  if (
    !response.ok ||
    !body ||
    typeof body !== "object" ||
    (body as ChapaApiResponse).status !== "success" ||
    typeof checkoutUrl !== "string"
  ) {
    console.error("Chapa payment initialization failed", { status: response.status });
    throw new Error("CHAPA_INITIALIZATION_FAILED");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(checkoutUrl);
  } catch {
    throw new Error("CHAPA_INVALID_CHECKOUT_URL");
  }
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== CHAPA_CHECKOUT_HOST) {
    throw new Error("CHAPA_INVALID_CHECKOUT_URL");
  }

  const checkoutUrlString = parsedUrl.toString();
  // The checkout URL segment is a checkout-session reference, not the payment
  // reference Chapa returns after completion, so only the URL is persisted.
  // The real chapa_reference is stored from verification or the webhook.
  await prisma.payment.update({
    where: { id: payment.id },
    data: { checkoutUrl: checkoutUrlString },
  });
  return checkoutUrlString;
}

/** Picks our payment from a GET /v2/payments list response (newest first). */
export function pickChapaReferenceFromPayments(
  response: unknown,
  merchantReference: string,
): string | null {
  if (!response || typeof response !== "object") return null;
  const data = (response as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  const items = (data as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const payment = item as { merchant_reference?: unknown; chapa_reference?: unknown };
    if (
      payment.merchant_reference === merchantReference &&
      typeof payment.chapa_reference === "string" &&
      payment.chapa_reference
    ) {
      return payment.chapa_reference;
    }
  }
  return null;
}

/**
 * Resolves the Chapa payment reference when verification by merchant reference
 * is no longer accepted (Chapa only accepts the Chapa reference after a hosted
 * checkout completes). The list endpoint is documented as newest-first.
 */
export async function findChapaReferenceForPayment(
  merchantReference: string,
): Promise<string | null> {
  const response = await fetch(`${CHAPA_API_BASE}/payments?limit=50`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getChapaCredentials().secretKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }
  return pickChapaReferenceFromPayments(body, merchantReference);
}

export async function verifyChapaPayment(chapaReference: string): Promise<unknown> {
  const response = await fetch(
    `${CHAPA_API_BASE}/payments/${encodeURIComponent(chapaReference)}/verify`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getChapaCredentials().secretKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  );

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("CHAPA_INVALID_RESPONSE");
  }
  if (!response.ok) {
    console.error("Chapa payment verification failed", { status: response.status });
    throw new Error("CHAPA_VERIFICATION_FAILED");
  }
  return body;
}

export async function reconcileVerifiedPayment(
  tx: Prisma.TransactionClient,
  paymentId: string,
  chapaReference: string | null,
  verified: VerifiedChapaPayment | null,
): Promise<PaymentStatus> {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    include: { registration: { select: { id: true, scheduleId: true, status: true } } },
  });
  if (!payment) throw new Error("PAYMENT_NOT_FOUND");

  // Success is a terminal state: a stale, pending, failed, or unverified
  // notification must never undo an already verified successful payment.
  if (payment.status === "SUCCESS" && (!verified || verified.status !== "SUCCESS")) {
    return "SUCCESS";
  }

  const otherPayment = chapaReference
    ? await tx.payment.findUnique({
        where: { chapaReference },
        select: { id: true },
      })
    : null;
  if (otherPayment && otherPayment.id !== payment.id) {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "INVALID", verifiedAt: new Date() },
    });
    return "INVALID";
  }

  if (!verified) {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "INVALID",
        ...(chapaReference ? { chapaReference } : {}),
        verifiedAt: new Date(),
      },
    });
    return "INVALID";
  }

  await tx.payment.update({
    where: { id: payment.id },
    data: {
      // Keep the reference captured at initialization when Chapa has not
      // assigned one yet (for example while the payment is still PENDING).
      ...(verified.chapaReference ? { chapaReference: verified.chapaReference } : {}),
      status: verified.status,
      verifiedAt: new Date(),
    },
  });

  if (verified.status !== "SUCCESS") return verified.status;

  const claim = await tx.registration.updateMany({
    where: { id: payment.registration.id, status: "PENDING" },
    data: { status: "CONFIRMED" },
  });
  if (claim.count === 0) return "SUCCESS";

  const scheduleId = payment.registration.scheduleId;
  if (!scheduleId) throw new Error("PAYMENT_REGISTRATION_WITHOUT_SCHEDULE");
  const schedule = await tx.schedule.findUnique({
    where: { id: scheduleId },
    select: { maxSeats: true },
  });
  if (!schedule) throw new Error("PAYMENT_SCHEDULE_NOT_FOUND");

  const seat = await tx.schedule.updateMany({
    where: {
      id: scheduleId,
      active: true,
      enrolled: { lt: schedule.maxSeats },
      OR: [{ availabilityOverride: null }, { availabilityOverride: true }],
    },
    data: { enrolled: { increment: 1 } },
  });
  if (seat.count !== 1) throw new Error("PAYMENT_SCHEDULE_FULL");

  return "SUCCESS";
}

export function createWebhookDedupKey(input: {
  event: string;
  chapaReference: string;
  status: string;
  updatedAt: string;
  rawBody: Buffer;
}): string {
  const identity = input.updatedAt
    ? `${input.event}:${input.chapaReference}:${input.status}:${input.updatedAt}`
    : `${input.event}:${input.chapaReference}:${input.status}:${createHash("sha256").update(input.rawBody).digest("hex")}`;
  return createHash("sha256").update(identity).digest("hex");
}
