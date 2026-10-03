import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson, isUniqueConstraintError } from "@/lib/http";
import { looksLikeReferenceId } from "@/lib/registration";
import {
  initiatePayment,
  ChapaApiError,
  ChapaConfigError,
} from "@/lib/payments/chapa";

export const dynamic = "force-dynamic";

// POST /api/payments/chapa/init — create a Chapa v2 hosted checkout session.
//
// The browser sends nothing but the registration reference ID. The amount,
// currency and customer details are always read from the database, so a
// tampered request can never change what is charged. The response contains
// only Chapa's checkout URL — the secret key never leaves the server.

/** Chapa's 9-digit local Ethiopian format: mobile (9…) or Safaricom (7…). */
const ETHIOPIAN_LOCAL_PHONE = /^[97]\d{8}$/;

/**
 * Reduces any stored phone form to Chapa's expected international format.
 * Accepts "09xxxxxxxx", "2519xxxxxxxx", "+2519xxxxxxxx" and separators.
 */
function toInternationalPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("251")
    ? digits.slice(3)
    : digits.startsWith("0")
      ? digits.slice(1)
      : digits;
  return ETHIOPIAN_LOCAL_PHONE.test(local) ? `+251${local}` : null;
}

/** merchant_reference must be alphanumeric with hyphens only. */
function toMerchantReference(referenceId: string): string | null {
  const cleaned = referenceId.replace(/[^A-Za-z0-9-]/g, "");
  return cleaned.length > 0 ? cleaned : null;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    firstName: parts[0] || "Student",
    lastName: parts.slice(1).join(" ") || "Applicant",
  };
}

/** Absolute origin for provider callbacks, preferring the configured value. */
function getAppOrigin(request: NextRequest): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/^["']+|["']+$/g, "");
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      return null;
    }
  }
  try {
    const { origin, protocol } = new URL(request.url);
    return protocol === "https:" || protocol === "http:" ? origin : null;
  } catch {
    return null;
  }
}

/**
 * Returns the registration's Payment row, creating a PENDING one when a
 * registration predates online payments. Safe under concurrent requests: a
 * losing racer re-reads the row the winner inserted.
 */
async function getOrCreatePendingPayment(
  applicationId: string,
  amount: number
) {
  const existing = await prisma.payment.findUnique({ where: { applicationId } });
  if (existing) return existing;

  try {
    return await prisma.payment.create({
      data: { applicationId, amount, currency: "ETB", status: "PENDING" },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const raced = await prisma.payment.findUnique({ where: { applicationId } });
      if (raced) return raced;
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  let referenceId = "";

  try {
    const body = await readJson(request);
    const rawReference =
      typeof body === "object" && body !== null
        ? (body as { referenceId?: unknown }).referenceId
        : undefined;
    referenceId = typeof rawReference === "string" ? rawReference.trim().toUpperCase() : "";

    if (!looksLikeReferenceId(referenceId)) {
      return NextResponse.json({ error: "A valid registration ID is required." }, { status: 400 });
    }

    const application = await prisma.application.findUnique({
      where: { referenceId },
      select: {
        id: true,
        referenceId: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        course: { select: { title: true, price: true, discountPrice: true } },
        schedule: { select: { group: true, session: true } },
      },
    });
    if (!application) {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }

    const email = application.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error("[chapa-init] Registration has an unusable customer email", { referenceId });
      return NextResponse.json(
        { error: "This registration has no valid email address for payment." },
        { status: 400 }
      );
    }

    const phone = toInternationalPhone(application.phone);
    if (!phone) {
      console.error("[chapa-init] Registration has an unusable customer phone", {
        referenceId,
      });
      return NextResponse.json(
        { error: "This registration has no valid phone number for payment." },
        { status: 400 }
      );
    }

    const origin = getAppOrigin(request);
    if (!origin) {
      console.error("[chapa-init] Could not resolve an absolute origin", { referenceId });
      return NextResponse.json(
        { error: "Payment return URL is not configured correctly." },
        { status: 500 }
      );
    }

    const payment = await getOrCreatePendingPayment(
      application.id,
      application.course.discountPrice ?? application.course.price
    );

    // Already settled — never start a second checkout for a paid registration.
    if (payment.status === "SUCCESS") {
      return NextResponse.json(
        { error: "This registration is already paid.", alreadyPaid: true },
        { status: 409 }
      );
    }
    if (payment.amount <= 0) {
      console.error("[chapa-init] Registration has an invalid amount", {
        referenceId,
        amount: payment.amount,
      });
      return NextResponse.json(
        { error: "This registration has an invalid payment amount." },
        { status: 400 }
      );
    }

    const merchantReference = toMerchantReference(application.referenceId);
    if (!merchantReference) {
      console.error("[chapa-init] Could not build a valid merchant_reference", { referenceId });
      return NextResponse.json(
        { error: "Unable to create a valid payment reference." },
        { status: 400 }
      );
    }

    // Chapa redirects the customer back to /payment/return and posts webhooks
    // to /api/webhooks/chapa. The referenceId is carried through so the
    // confirmation page can verify the payment immediately.
    const returnUrl = new URL("/payment/return", origin);
    returnUrl.searchParams.set("referenceId", application.referenceId);
    const callbackUrl = new URL("/api/webhooks/chapa", origin).toString();
    const { firstName, lastName } = splitName(application.fullName);

    const hosted = await initiatePayment({
      amount: payment.amount,
      merchantReference,
      customer: {
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phone,
      },
      returnUrl: returnUrl.toString(),
      callbackUrl,
      title: application.course.title,
      meta: {
        reference_id: application.referenceId,
        ...(application.schedule
          ? {
              schedule: `${application.schedule.group}/${application.schedule.session}`,
            }
          : {}),
      },
    });

    // Re-read before writing: a webhook may have settled this payment while we
    // were talking to Chapa, and a settled payment must never be downgraded.
    const current = await prisma.payment.findUnique({
      where: { id: payment.id },
      select: { status: true },
    });
    if (!current || current.status === "SUCCESS") {
      return NextResponse.json(
        { error: "This registration is already paid.", alreadyPaid: true },
        { status: 409 }
      );
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "PENDING",
        merchantReference,
        chapaReference: hosted.chapa_reference,
      },
    });

    return NextResponse.json({
      checkout_url: hosted.checkout_url,
      merchantReference,
    });
  } catch (error) {
    if (error instanceof ChapaApiError) {
      console.error("[chapa-init] Chapa rejected hosted payment initialization:", {
        referenceId: referenceId || undefined,
        httpStatus: error.httpStatus,
        providerCode: error.code,
        message: error.message,
      });
      // A provider-side fault (5xx, timeout, unreachable) is a bad gateway;
      // our own rejected payload is a client error.
      const upstream = error.httpStatus === undefined || error.httpStatus >= 500;
      return NextResponse.json(
        { error: "Unable to start payment. Please try again." },
        { status: upstream ? 502 : 400 }
      );
    }

    if (error instanceof ChapaConfigError) {
      console.error("[chapa-init] Chapa configuration error:", {
        referenceId: referenceId || undefined,
        message: error.message,
      });
      return NextResponse.json(
        { error: "Payments are not configured on this server." },
        { status: 500 }
      );
    }

    console.error("[chapa-init] Unexpected payment initialization failure:", {
      referenceId: referenceId || undefined,
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Unable to start payment. Please try again." },
      { status: 500 }
    );
  }
}