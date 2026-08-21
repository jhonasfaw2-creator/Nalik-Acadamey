import { type NotificationProvider, type NotificationPayload } from "../types";

/**
 * Email notification provider using Resend.
 *
 * Requires RESEND_API_KEY environment variable.
 * EMAIL_FROM defaults to Resend's onboarding address if the custom domain
 * is not verified.
 *
 * Sign up at https://resend.com to get your API key.
 * Verify your domain at https://resend.com/domains for production use.
 */
export function createEmailProvider(): NotificationProvider {
  return {
    name: "email",
    async send(payload: NotificationPayload) {
      if (payload.channel !== "email") {
        return { success: false, error: "Wrong channel for email provider" };
      }

      const apiKey = process.env.RESEND_API_KEY;

      // If no API key configured, log and pretend success (dev mode)
      if (!apiKey) {
        console.info("[Email] (No RESEND_API_KEY) Would send:", {
          to: payload.to,
          subject: payload.subject,
        });
        return { success: true };
      }

      try {
        const { Resend } = await import("resend");
        const resend = new Resend(apiKey);

        // Use custom domain if configured, otherwise fall back to Resend's onboarding address
        const customFrom = process.env.EMAIL_FROM;
        const fromEmail = customFrom || "Nalik Academy <onboarding@resend.dev>";

        if (!customFrom) {
          console.info(
            "[Email] No EMAIL_FROM set — using Resend onboarding address. " +
              "Set EMAIL_FROM to use your verified domain."
          );
        }

        // Build HTML email from plain text message
        const html = buildHtmlEmail(payload.subject || "Nalik Academy", payload.message);

        const { data, error } = await resend.emails.send({
          from: fromEmail,
          to: payload.to,
          subject: payload.subject || "Nalik Academy",
          text: payload.message,
          html,
        });

        if (error) {
          // Resend SDK error objects don't serialize well with JSON.stringify.
          // Extract the message using String() or direct property access.
          const errorMsg =
            (error as Record<string, unknown>).message?.toString() ||
            String(error) ||
            "Unknown Resend error";

          console.error("[Email] Resend error:", errorMsg);
          return { success: false, error: errorMsg };
        }

        if (data?.id) {
          console.info("[Email] Resend message ID:", data.id);
        }

        console.info("[Email] Sent successfully to:", payload.to);
        return { success: true };
      } catch (err) {
        console.error("[Email] Send failed:", err);
        return { success: false, error: (err as Error).message };
      }
    },
  };
}

function buildHtmlEmail(subject: string, message: string): string {
  // Convert plain text to HTML with basic formatting
  const htmlMessage = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#F4F3EE;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F3EE;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FFFFFF;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#151B29;padding:24px 32px;">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#FFFFFF;">
                Nalik <span style="color:#E2A033;">Academy</span>
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 20px;font-size:18px;font-weight:700;color:#151B29;">
                ${subject}
              </h2>
              <div style="font-size:15px;line-height:1.7;color:#374151;">
                <p>${htmlMessage}</p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#F9FAFB;padding:20px 32px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">
                &copy; ${new Date().getFullYear()} Nalik Academy. All rights reserved.
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#D1D5DB;text-align:center;">
                Addis Ababa, Ethiopia
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
