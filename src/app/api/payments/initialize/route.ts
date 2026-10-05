import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { fullName, email, phone, age, courseId, scheduleId } = body;

    if (!fullName || !phone || !courseId || !age) {
      return NextResponse.json(
        { error: "Missing required registration details." },
        { status: 400 }
      );
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const coursePrice = course.discountPrice ?? course.price;
    if (!coursePrice || coursePrice <= 0) {
      return NextResponse.json({ error: "Invalid course price." }, { status: 400 });
    }

    const referenceId = `NA-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const txRef = `TX-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Upsert registration record
    const registration = await prisma.registration.upsert({
      where: {
        email_courseId: {
          email: email || `${phone}@nalikacademy.com`,
          courseId: courseId,
        },
      },
      update: {
        fullName,
        phone,
        age: Number(age),
        scheduleId: scheduleId || null,
        status: "PENDING",
      },
      create: {
        referenceId,
        fullName,
        email: email || `${phone}@nalikacademy.com`,
        phone,
        age: Number(age),
        courseId,
        scheduleId: scheduleId || null,
        status: "PENDING",
      },
    });

    // Create pending transaction
    await prisma.transaction.create({
      data: {
        registrationId: registration.id,
        amount: coursePrice,
        currency: "ETB",
        txRef: txRef,
        status: "PENDING",
      },
    });

    const nameParts = fullName.trim().split(" ");
    const firstName = nameParts[0] || "Student";
    const lastName = nameParts.slice(1).join(" ") || "User";

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nalikacademy.com";

    // Chapa V2 Payload Structure
    const chapaV2Payload = {
      amount: coursePrice.toString(),
      currency: "ETB",
      email: email || "student@nalikacademy.com",
      first_name: firstName,
      last_name: lastName,
      tx_ref: txRef,
      callback_url: `${appUrl}/api/payments/webhook`,
      return_url: `${appUrl}/checkout/return?tx_ref=${txRef}`,
      customization: {
        title: "Nalik Academy",
        description: `Course Registration: ${course.title}`,
      },
    };

    // Explicit V2 API Endpoint
    const chapaRes = await fetch("https://api.chapa.co/v2/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chapaV2Payload),
    });

    const chapaData = await chapaRes.json();

    if (!chapaRes.ok || chapaData.status === "failed") {
      console.error("[Chapa V2 Initialization Error]:", chapaData);
      return NextResponse.json(
        { error: chapaData.message || "Failed to initialize payment with Chapa V2." },
        { status: chapaRes.status || 400 }
      );
    }

    return NextResponse.json({
      status: "success",
      checkoutUrl: chapaData.data?.checkout_url,
      txRef,
      referenceId,
    });
  } catch (err: any) {
    console.error("Error initializing V2 payment:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}