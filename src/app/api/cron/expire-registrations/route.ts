import { NextRequest, NextResponse } from "next/server";
import { expireOverdueRegistrations } from "@/lib/services/expiration";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/cron/expire-registrations — scheduled by vercel.json.
// Vercel sends `Authorization: Bearer $CRON_SECRET` when the variable is set.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();

  if (secret) {
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error("CRON_SECRET is not configured; refusing to run the expiration job.");
    return NextResponse.json({ error: "Cron is not configured." }, { status: 503 });
  }

  try {
    const expired = await expireOverdueRegistrations();
    return NextResponse.json({ success: true, expired });
  } catch (error) {
    console.error("Registration expiration sweep failed:", error);
    return NextResponse.json({ error: "Expiration sweep failed." }, { status: 500 });
  }
}
