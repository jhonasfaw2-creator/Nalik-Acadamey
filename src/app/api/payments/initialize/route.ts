import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/http";
import { registrationSchema } from "@/lib/validators";
import {
  initiatePayment,
  ChapaApiError,
  ChapaConfigError,
  validateChapaV2Configuration,
} from "@/lib/payments/chapa";
import { generateUniqueReferenceId } from "@/lib/reference";

export const dynamic = "force-dynamic";

function formatChapaPhone(phone: string): string | null {
  const compact = phone.trim().replace(/[\s()-]/g, "");
  let formatted: string;

  if (compact.startsWith("+")) {
    formatted = compact;
  } else if (compact.startsWith("00")) {
    formatted = `+${compact.slice(2)}`;
  } else if (compact.startsWith("251")) {
    formatted = `+${compact}`;
  } else if (compact.startsWith("0")) {
    formatted = `+251${compact.slice(1)}`;
  } else {
    formatted = `+251${compact}`;
  }

  return /^\+[1-9]\d{7,14}$/.test(formatted) ? formatted : null;
}

export async function POST(request: NextRequest) {
  let referenceId = "";

  try {
    const body = await readJson(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = registrationSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError = Object.values(fieldErrors).flat()[0] || "Invalid input";
      return NextResponse.json({ error: firstError, fields: fieldErrors }, { status: 400 });
    }

    const {
      fullName,
      email,
      phone,
      age,
      courseId,
      scheduleId,
      previousExperience,
      motivation,
    } = parsed.data;
    const normalizedEmail = email?.trim().toLowerCase() || null;
    const formattedPhone = formatChapaPhone(phone);
    if (!formattedPhone) {
      return NextResponse.json(
        { error: "Enter a valid phone number, including its country code if it is not Ethiopian." },
        { status: 400 },
      );
    }

    validateChapaV2Configuration();

    const previewDeploymentUrl =
      process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : undefined;
    const deploymentUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : request.nextUrl.origin;
    const configuredAppUrl =
      previewDeploymentUrl ??
      process.env.NEXT_PUBLIC_APP_URL?.trim() ??
      deploymentUrl;
    let appUrl: URL;
    try {
      appUrl = new URL(configuredAppUrl);
    } catch {
      throw new ChapaConfigError("The application URL must be an absolute URL.");
    }
    if (appUrl.protocol !== "https:") {
      throw new ChapaConfigError("The application URL must use HTTPS.");
    }
    appUrl.pathname = appUrl.pathname.replace(/\/+$/, "");
    appUrl.search = "";
    appUrl.hash = "";

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    if (!course.active) {
      return NextResponse.json({ error: "This course is not available" }, { status: 400 });
    }

    const paymentAmount = course.discountPrice ?? course.price;
    if (paymentAmount <= 0) {
      return NextResponse.json({ error: "This course is not available for online payment." }, { status: 400 });
    }

    const schedule = await prisma.schedule.findFirst({
      where: { id: scheduleId, active: true },
    });
    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 400 });
    }
    if (schedule.availabilityOverride === false || schedule.enrolled >= schedule.maxSeats) {
      return NextResponse.json({ error: "This session is full. Please choose another." }, { status: 400 });
    }

    const existing = await prisma.registration.findFirst({
      where: {
        courseId,
        OR: [
          { phone: formattedPhone },
          ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ],
      },
    });

    let registrationId: string;
    let txRef: string;

    if (existing) {
      referenceId = existing.referenceId;
      if (existing.status === "PAID" || existing.status === "CONFIRMED") {
        return NextResponse.json(
          { error: "You are already registered and paid for this course." },
          { status: 409 },
        );
      }

      const pendingTransaction = await prisma.transaction.findFirst({
        where: { registrationId: existing.id, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      });

      if (
        pendingTransaction &&
        pendingTransaction.amount === paymentAmount &&
        pendingTransaction.currency === "ETB"
      ) {
        txRef = pendingTransaction.txRef;
      } else {
        txRef = `${existing.referenceId}-retry-${crypto.randomBytes(8).toString("hex")}`;
        await prisma.transaction.create({
          data: {
            registrationId: existing.id,
            amount: paymentAmount,
            currency: "ETB",
            txRef,
            status: "PENDING",
          },
        });
      }
      registrationId = existing.id;
    } else {
      referenceId = await generateUniqueReferenceId(async (id) =>
        Boolean(await prisma.registration.findUnique({ where: { referenceId: id }, select: { id: true } })),
      );
      txRef = referenceId;
      const registration = await prisma.registration.create({
        data: {
          referenceId,
          fullName: fullName.trim(),
          email: normalizedEmail,
          phone: formattedPhone,
          age,
          courseId,
          scheduleId: schedule.id,
          previousExperience: previousExperience?.trim() || "",
          motivation: motivation?.trim() || "",
          status: "PENDING",
          transactions: {
            create: {
              amount: paymentAmount,
              currency: "ETB",
              txRef,
              status: "PENDING",
            },
          },
        },
        select: { id: true },
      });
      registrationId = registration.id;
    }

    const [firstName, ...lastNameParts] = fullName.trim().split(/\s+/);
    const returnUrl = new URL(`${appUrl.pathname}/checkout/return`, appUrl);
    returnUrl.searchParams.set("tx_ref", txRef);
    const callbackUrl = new URL(`${appUrl.pathname}/api/payments/webhook`, appUrl);

    const chapaResult = await initiatePayment({
      amount: paymentAmount,
      currency: "ETB",
      merchant_reference: txRef,
      customer: {
        first_name: firstName,
        last_name: lastNameParts.join(" ") || "Student",
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        phone_number: formattedPhone,
      },
      return_url: returnUrl.toString(),
      callback_url: callbackUrl.toString(),
      customization: {
        title: course.title,
        description: `Nalik Academy - ${course.title}`,
      },
      meta: {
        reference_id: referenceId,
        schedule: `${schedule.group}/${schedule.session}`,
      },
    });

    if (chapaResult.chapa_reference) {
      await prisma.transaction.update({
        where: { txRef },
        data: { chapaReference: chapaResult.chapa_reference },
      });
    }

    return NextResponse.json({
      checkout_url: chapaResult.checkout_url,
      checkoutUrl: chapaResult.checkout_url,
      referenceId,
      txRef,
      amount: paymentAmount,
      currency: "ETB",
    });
  } catch (error) {
    if (error instanceof ChapaApiError) {
      console.error("[payments/initialize] Chapa API error", {
        referenceId: referenceId || undefined,
        httpStatus: error.httpStatus,
        code: error.code,
        message: error.message,
      });
      const message =
        error.httpStatus === 401 || error.httpStatus === 403
          ? "Chapa rejected the secret key. Check that CHAPA_SECRET_KEY contains the V2 secret key for this deployment."
          : error.httpStatus === 400
            ? "Chapa rejected the payment details. Check the server logs for the provider error."
            : "Chapa could not initialize this payment. Please try again.";
      return NextResponse.json(
        {
          error: message,
          providerStatus: error.httpStatus,
          providerCode: error.code,
        },
        { status: 502 },
      );
    }
    if (error instanceof ChapaConfigError) {
      console.error("[payments/initialize] Chapa configuration error", {
        referenceId: referenceId || undefined,
        message: error.message,
      });
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    console.error("[payments/initialize] Unexpected failure", {
      referenceId: referenceId || undefined,
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to initialize payment. Please try again." },
      { status: 500 },
    );
  }
}
