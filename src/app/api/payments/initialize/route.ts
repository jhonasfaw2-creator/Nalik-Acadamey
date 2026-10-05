import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { amount, email, firstName, lastName, phone, txRef } = await req.json();

    // 1. Format Phone Number to E.164 standard for Chapa (+251...)
    let formattedPhone = phone ? phone.trim() : "";
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "+251" + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+251" + formattedPhone;
    }

    // 2. Base Application URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nalik-acadamey.vercel.app";
    const cleanAppUrl = appUrl.replace(/\/$/, "");

    // 3. Convert Amount to Subunits (ETB * 100 for Chapa V2)
    const amountInCents = Math.round(Number(amount) * 100);

    // 4. Request Hosted Payment Session from Chapa V2
    const chapaRes = await fetch("https://api.chapa.global/v2/payments/hosted", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountInCents,
        currency: "ETB",
        merchant_reference: txRef,
        return_url: `${cleanAppUrl}/checkout/return?tx_ref=${txRef}`,
        callback_url: `${cleanAppUrl}/api/payments/webhook`,
        customer: {
          email: email,
          first_name: firstName,
          last_name: lastName,
          phone_number: formattedPhone || "+251900000000",
        },
      }),
    });

    const data = await chapaRes.json();

    if (!chapaRes.ok) {
      console.error("CHAPA INIT ERROR:", data);
      return NextResponse.json(
        { error: data.message || "Initialization failed", details: data },
        { status: chapaRes.status }
      );
    }

    return NextResponse.json({ checkout_url: data.data.checkout_url });
  } catch (error: any) {
    console.error("SERVER INITIALIZE ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}