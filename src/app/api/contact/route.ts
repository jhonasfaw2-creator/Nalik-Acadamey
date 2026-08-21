import { NextResponse } from "next/server";
import { z } from "zod";

// ── Server-side Zod schema ──
const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(1000, "Message must be under 1000 characters"),
});

// ── Rate-limit: simple in-memory guard ─────────
const recentSubmissions = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const last = recentSubmissions.get(ip);
  if (last && now - last < RATE_LIMIT_MS) return true;
  recentSubmissions.set(ip, now);
  if (recentSubmissions.size > 100) {
    for (const [key, timestamp] of recentSubmissions) {
      if (now - timestamp > RATE_LIMIT_MS) recentSubmissions.delete(key);
    }
  }
  return false;
}

export async function POST(request: Request) {
  try {
    // ── Rate limit ──────────────────────────────
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many submissions. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    // ── Parse and validate ──────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid form data" },
        { status: 400 }
      );
    }

    const { name, email, message } = parsed.data;

    // ── Send email notification (best-effort) ───
    const recipientEmail =
      process.env.CONTACT_FORM_RECIPIENT || process.env.ADMIN_EMAIL;

    if (recipientEmail && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail =
          process.env.EMAIL_FROM || "Nalik Academy <onboarding@resend.dev>";

        await resend.emails.send({
          from: fromEmail,
          to: recipientEmail,
          subject: `New Contact Message from ${name}`,
          text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
          html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#F4F3EE;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F3EE;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FFFFFF;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="background-color:#151B29;padding:24px 32px;">
          <h1 style="margin:0;font-size:20px;font-weight:700;color:#FFFFFF;">Nalik <span style="color:#E2A033;">Academy</span></h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 20px;font-size:18px;font-weight:700;color:#151B29;">New Contact Message</h2>
          <p style="font-size:14px;color:#6B7280;margin:0 0 8px;"><strong>From:</strong> ${name}</p>
          <p style="font-size:14px;color:#6B7280;margin:0 0 20px;"><strong>Email:</strong> ${email}</p>
          <div style="font-size:15px;line-height:1.7;color:#374151;border-top:1px solid #E5E7EB;padding-top:20px;">
            <p>${message.replace(/\n/g, "<br>")}</p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        });
      } catch (err) {
        // Don't fail the request if email fails — log and continue
        console.error("[Contact] Email send failed:", err);
      }
    }

    return NextResponse.json(
      { success: true, message: "Message sent successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
