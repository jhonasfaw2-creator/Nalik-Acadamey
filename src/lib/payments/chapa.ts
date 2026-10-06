import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const CHAPA_API_BASE = "https://api.chapa.global/v2";
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
  chapaReference: string;
  merchantReference: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
}

interface ChapaApiResponse {
  status?: unknown;
  message?: unknown;
  data?: unknown;
}

function getTestSecretKey(): string {
  const secretKey = process.env.CHAPA_SECRET_KEY;
  if (!secretKey) throw new Error("CHAPA_SECRET_KEY is not configured");
  if (!secretKey.startsWith("CHAPA_TEST_")) {
    throw new Error("CHAPA_SECRET_KEY must be a Chapa TEST-mode secret key");
  }
  return secretKey;
}

export function verifyChapaWebhookSignature(rawBody: Buffer, signature: string | null): boolean {
  const secret = process.env.CHAPA_WEBHOOK_SECRET;
  if (!secret || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;

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

export function parseVerifiedChapaPayment(
  response: unknown,
  expected: {
    chapaReference: string;
    merchantReference: string;
    amount: number;
    currency: string;
  },
): VerifiedChapaPayment | null {
  if (!response || typeof response !== "object") return null;
  const body = response as ChapaApiResponse;
  if (body.status !== "success" || !body.data || typeof body.data !== "object") return null;

  const data = body.data as Record<string, unknown>;
  const amount = typeof data.amount === "number" ? data.amount : Number(data.amount);
  const chapaReference = data.chapa_reference;
  const merchantReference = data.merchant_reference;
  const currency = data.currency;
  const status = normalizeChapaStatus(data.status);

  if (
    typeof chapaReference !== "string" ||
    typeof merchantReference !== "string" ||
    typeof currency !== "string" ||
    !Number.isFinite(amount) ||
    chapaReference !== expected.chapaReference ||
    merchantReference !== expected.merchantReference ||
    amount !== expected.amount ||
    currency.toUpperCase() !== expected.currency.toUpperCase() ||
    status === "INVALID"
  ) {
    return null;
  }

  return {
    chapaReference,
    merchantReference,
    amount,
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

  const response = await fetch(`${CHAPA_API_BASE}/payments/hosted`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getTestSecretKey()}`,
      "Content-Type": "application/json",
      "Idempotency-Key": payment.merchantReference,
    },
    body: JSON.stringify({
      amount: payment.amount,
      currency: payment.currency,
      merchant_reference: payment.merchantReference,
      customer,
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
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "checkout.chapa.global") {
    throw new Error("CHAPA_INVALID_CHECKOUT_URL");
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { checkoutUrl: parsedUrl.toString() },
  });
  return parsedUrl.toString();
}

export async function verifyChapaPayment(chapaReference: string): Promise<unknown> {
  const response = await fetch(
    `${CHAPA_API_BASE}/payments/${encodeURIComponent(chapaReference)}/verify`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getTestSecretKey()}`,
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
  chapaReference: string,
  verified: VerifiedChapaPayment | null,
): Promise<PaymentStatus> {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    include: { registration: { select: { id: true, scheduleId: true, status: true } } },
  });
  if (!payment) throw new Error("PAYMENT_NOT_FOUND");

  const otherPayment = await tx.payment.findUnique({
    where: { chapaReference },
    select: { id: true },
  });
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
      data: { status: "INVALID", chapaReference, verifiedAt: new Date() },
    });
    return "INVALID";
  }

  if (payment.status === "SUCCESS" && verified.status !== "SUCCESS") return "SUCCESS";

  await tx.payment.update({
    where: { id: payment.id },
    data: {
      chapaReference: verified.chapaReference,
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
