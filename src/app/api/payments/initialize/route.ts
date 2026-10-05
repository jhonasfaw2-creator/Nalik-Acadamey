import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Parse numeric amount safely
    let rawAmount = body.amount;
    if (typeof rawAmount === "string") {
      rawAmount = parseFloat(rawAmount.replace(/[^0-9.]/g, ""));
    }

    const numericAmount = Number(rawAmount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { error: "Payment amount is required and must be greater than 0." },
        { status: 400 }
      );
    }

    const firstName = body.firstName || "Student";
    const lastName = body.lastName || "User";
    const email = body.email || "student@nalikacademy.com";
    const txRef = `TX-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nalik-acadamey.vercel.app";

    // Chapa v2 standard payload structure
    const chapaPayload = {
      amount: numericAmount.toString(),
      currency: "ETB",
      email: email,
      first_name: firstName,
      last_name: lastName,
      tx_ref: txRef,
      callback_url: `${appUrl}/api/webhooks/chapa`,
      return_url: `${appUrl}/checkout/return?tx_ref=${txRef}`,
      customization: {
        title: "Nalik Academy Registration",
        description: "Course registration fee payment",
      },
    };

    const chapaRes = await fetch("https://api.chapa.co/v1/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chapaPayload),
    });

    const chapaData = await chapaRes.json();

    if (!chapaRes.ok || chapaData.status === "failed") {
      console.error("Chapa v2 Initialization Error:", chapaData);
      return NextResponse.json(
        { error: chapaData.message || "Failed to initialize payment with Chapa." },
        { status: chapaRes.status || 400 }
      );
    }

    return NextResponse.json({
      status: "success",
      checkoutUrl: chapaData.data?.checkout_url,
      txRef: txRef,
    });
  } catch (err: any) {
    console.error("Error initializing payment:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}