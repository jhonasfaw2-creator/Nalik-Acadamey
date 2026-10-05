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

async function generateUniqueTxRef(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const txRef = `TX-${Date.now().toString().slice(-10)}-${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;
    const existing = await prisma.transaction.findUnique({
      where: { txRef },
      select: { id: true },
    });
    if (!existing) return txRef;
  }
  throw new Error("Could not generate a unique payment reference.");
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

    const txRef = await generateUniqueTxRef();

    if (existing) {
      referenceId = existing.referenceId;
      if (existing.status === "PAID" || existing.status === "CONFIRMED") {
        return NextResponse.json(
          { error: "You are already registered and paid for this course." },
          { status: 409 },
        );
      }

      await prisma.transaction.create({
        data: {
          registrationId: existing.id,
          amount: paymentAmount,
          currency: "ETB",
          txRef,
          status: "PENDING",
        },
      });
    } else {
      referenceId = await generateUniqueReferenceId(async (id) =>
        Boolean(await prisma.registration.findUnique({ where: { referenceId: id }, select: { id: true } })),
      );
      await prisma.registration.create({
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
      });
    }

    const [firstName, ...lastNameParts] = fullName.trim().split(/\s+/);
    const lastName = lastNameParts.join(" ") || "Student";
    const returnUrl = new URL(`${appUrl.pathname}/checkout/return`, appUrl);
    returnUrl.searchParams.set("tx_ref", txRef);
    const callbackUrl = new URL(`${appUrl.pathname}/api/payments/webhook`, appUrl);

    const chapaResult = await initiatePayment({
      amount: paymentAmount.toString(),
      currency: "ETB",
      merchant_reference: txRef,
      customer: {
        first_name: firstName,
        last_name: lastName,
        email: normalizedEmail || "student@nalikacademy.com",
        phone_number: formattedPhone,
      },
      return_url: returnUrl.toString(),
      callback_url: callbackUrl.toString(),
      customization: {
        title: "Nalik Academy",
        description: `Course Registration: ${course.title}`,
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
          : error.message;
      const status =
        error.httpStatus !== undefined && error.httpStatus >= 400 && error.httpStatus < 600
          ? error.httpStatus
          : 502;
      return NextResponse.json(
        { error: message },
        { status },
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
