import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/http";
import { registrationSchema } from "@/lib/validators";
import { initiatePayment, ChapaApiError, ChapaConfigError } from "@/lib/payments/chapa";
import { generateUniqueReferenceId } from "@/lib/reference";

export const dynamic = "force-dynamic";

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

    const normalizedEmail = email.toLowerCase();

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

    const existing = await prisma.registration.findUnique({
      where: { email_courseId: { email: normalizedEmail, courseId } },
    });

    let registration;
    let txRef: string;

    if (existing) {
      referenceId = existing.referenceId;
      if (existing.status === "PAID" || existing.status === "CONFIRMED") {
        return NextResponse.json(
          { error: "You are already registered and paid for this course." },
          { status: 409 },
        );
      }

      const pendingTx = await prisma.transaction.findFirst({
        where: { registrationId: existing.id, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      });

      if (pendingTx && pendingTx.amount === paymentAmount && pendingTx.currency === "ETB") {
        txRef = pendingTx.txRef;
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

      registration = existing;
    } else {
      referenceId = await generateUniqueReferenceId(async (id) =>
        Boolean(await prisma.registration.findUnique({ where: { referenceId: id }, select: { id: true } }))
      );

      txRef = referenceId;

      registration = await prisma.registration.create({
        data: {
          referenceId,
          fullName: fullName.trim(),
          email: normalizedEmail,
          phone: phone.trim(),
          age,
          courseId,
          scheduleId: schedule?.id,
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

    // Build Chapa initialization payload
    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!configuredAppUrl) {
      throw new ChapaConfigError("NEXT_PUBLIC_APP_URL is not configured.");
    }
    let appUrl: URL;
    try {
      appUrl = new URL(configuredAppUrl);
    } catch {
      throw new ChapaConfigError("NEXT_PUBLIC_APP_URL must be an absolute URL.");
    }
    if (appUrl.protocol !== "https:") {
      throw new ChapaConfigError("NEXT_PUBLIC_APP_URL must use HTTPS.");
    }
    appUrl.pathname = appUrl.pathname.replace(/\/+$/, "");
    appUrl.search = "";
    appUrl.hash = "";
    const [firstName, ...lastNameParts] = fullName.trim().split(/\s+/);
    const lastName = lastNameParts.join(" ") || "Student";
    const returnUrl = new URL(`${appUrl.pathname}/checkout/return`, appUrl);
    returnUrl.searchParams.set("tx_ref", txRef);
    const callbackUrl = new URL(`${appUrl.pathname}/api/webhooks/chapa`, appUrl);

    const chapaResult = await initiatePayment({
      amount: paymentAmount,
      currency: "ETB",
      merchant_reference: txRef,
      customer: {
        first_name: firstName,
        last_name: lastName,
        email: normalizedEmail,
        phone_number: phone.trim(),
      },
      return_url: returnUrl.toString(),
      callback_url: callbackUrl.toString(),
      customization: {
        title: course.title,
        description: `Nalik Academy - ${course.title}`,
      },
      meta: {
        reference_id: referenceId,
        ...(schedule ? { schedule: `${schedule.group}/${schedule.session}` } : {}),
      },
    });

    return NextResponse.json({
      checkout_url: chapaResult.checkout_url,
      referenceId,
      txRef,
      amount: paymentAmount,
      currency: "ETB",
    });
  } catch (error) {
    if (error instanceof ChapaApiError) {
      console.error("[payments/initialize] Chapa API error:", {
        referenceId: referenceId || undefined,
        httpStatus: error.httpStatus,
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { error: "Failed to initialize payment with Chapa. Please try again." },
        { status: error.httpStatus && error.httpStatus >= 500 ? 502 : 400 }
      );
    }

    if (error instanceof ChapaConfigError) {
      console.error("[payments/initialize] Chapa configuration error:", {
        referenceId: referenceId || undefined,
        message: error.message,
      });
      return NextResponse.json(
        { error: "Payment system is not configured. Please contact support." },
        { status: 500 }
      );
    }

    console.error("[payments/initialize] Unexpected error:", {
      referenceId: referenceId || undefined,
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to initialize payment. Please try again." },
      { status: 500 }
    );
  }
}