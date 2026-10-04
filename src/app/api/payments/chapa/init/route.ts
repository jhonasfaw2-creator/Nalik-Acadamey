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

    const baseMerchantReference = toMerchantReference(application.referenceId);
    if (!baseMerchantReference) {
      console.error("[chapa-init] Could not build a valid merchant_reference", { referenceId });
      return NextResponse.json(
        { error: "Unable to create a valid payment reference." },
        { status: 400 }
      );
    }

    const { firstName, lastName } = splitName(application.fullName);

    // Prefer the configured canonical domain, falling back to the production
    // alias. The Host header on Vercel can be a preview deployment URL (e.g.
    // nalikacadamey-abc123.vercel.app) which Chapa would then post webhooks to
    // that specific deployment rather than the live alias. Always use a stable
    // domain so both browser redirects and server callbacks are consistent.
    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      "https://nalik-acadamey.vercel.app";

    // return_url  — where Chapa redirects the browser after checkout. We pass
    //               referenceId so PaymentCompleteClient can verify immediately
    //               on landing without parsing tx_ref or chapa_reference.
    // callback_url — per-transaction server-to-server webhook target. Chapa's
    //               hosted checkout requires it (with return_url) to complete
    //               the flow without a CSRF token mismatch.
  // Chapa validates both URLs and rejects the WHOLE initialization with
  // 400 INVALID_FORMAT ("Callback URL must start with https:// and be a valid
  // URL") if either one is not https. A plain-http origin — localhost, a LAN IP,
  // an http tunnel — would therefore make the checkout impossible to start, not
  // merely un-redirected. Send them only when they are actually usable.
  //
  // They are also not needed for settlement: the Chapa reference is already
  // stored, and the webhook plus server-side verification settle the payment.
  const useProviderUrls = origin.startsWith("https://");
  if (!useProviderUrls) {
    console.warn("[chapa-init] Non-https origin, omitting return_url/callback_url", {
      referenceId: application.referenceId,
    });
  }

  // Chapa treats a merchant_reference as SINGLE USE. Creating a second checkout
  // session under a reference it has already seen fails with
  // 409 INVALID_STATE ("Merchant reference has been used before"), so a customer
  // who abandons checkout could never retry — every later attempt died at init.
  //
  // Each attempt therefore gets its own suffixed reference (-2, -3, …) and the
  // one that Chapa accepted is what we store. That keeps the webhook, the public
  // verify route, the status cookie and the admin list all keyed on the same
  // value. A late webhook from a superseded attempt simply matches no Payment
  // and is ignored, which is logged and greppable.
  const MAX_INIT_ATTEMPTS = 5;
  let merchantReference = baseMerchantReference;
  let hosted: Awaited<ReturnType<typeof initiatePayment>> | null = null;
  let reusedReference = false;

  for (let attempt = 1; attempt <= MAX_INIT_ATTEMPTS; attempt++) {
    const candidate =
      attempt === 1 ? baseMerchantReference : `${baseMerchantReference}-${attempt}`;
    try {
      hosted = await initiatePayment({
        amount: payment.amount,
        merchantReference: candidate,
        customer: {
          first_name: firstName,
          last_name: lastName,
          email,
          phone_number: phone,
        },
        meta: {
          reference_id: application.referenceId,
          ...(application.schedule
            ? {
                schedule: `${application.schedule.group}/${application.schedule.session}`,
              }
            : {}),
        },
        ...(useProviderUrls
          ? {
              return_url: `${origin}/payment/complete?referenceId=${encodeURIComponent(application.referenceId)}`,
              callback_url: `${origin}/api/payments/webhook`,
            }
          : {}),
      });
      merchantReference = candidate;
      reusedReference = attempt > 1;
      break;
    } catch (error) {
      if (error instanceof ChapaApiError && error.httpStatus === 409) {
        console.info("[chapa-init] Reference already used by Chapa, retrying", {
          referenceId: application.referenceId,
          attempt,
        });
        continue;
      }
      throw error;
    }
  }

  if (!hosted) {
    console.error("[chapa-init] Could not obtain a fresh merchant_reference", {
      referenceId: application.referenceId,
      attempts: MAX_INIT_ATTEMPTS,
    });
    return NextResponse.json(
      { error: "Unable to start a new payment. Please contact us for help." },
      { status: 409 }
    );
  }

  if (reusedReference) {
    console.info("[chapa-init] Started a new checkout attempt", {
      referenceId: application.referenceId,
      merchantReference,
    });
  }

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

    // Set a short-lived cookie with the merchant reference so /payment/complete
    // can identify the payment even when Chapa's redirect URL carries no params.
    const initResponse = NextResponse.json({
      checkout_url: hosted.checkout_url,
      merchantReference,
    });
    initResponse.cookies.set("na_pending_ref", merchantReference, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60, // 1 hour — enough for any checkout session
    });
    return initResponse;
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