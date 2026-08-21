import { type NotificationProvider, type NotificationPayload } from "../types";

/**
 * WhatsApp notification provider.
 *
 * This is a configurable integration point. Replace the body of `send`
 * with your chosen WhatsApp provider (Twilio, MessageBird, etc.)
 * without changing any calling code.
 */
export function createWhatsAppProvider(): NotificationProvider {
  return {
    name: "whatsapp",
    async send(payload: NotificationPayload) {
      if (payload.channel !== "whatsapp") {
        return { success: false, error: "Wrong channel for WhatsApp provider" };
      }

      // ── Placeholder: swap this block for Twilio / Meta / custom API ──
      // Example with Twilio:
      // const accountSid = process.env.TWILIO_ACCOUNT_SID;
      // const authToken = process.env.TWILIO_AUTH_TOKEN;
      // const from = process.env.TWILIO_WHATSAPP_NUMBER;
      //
      // const response = await fetch(
      //   `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      //   { ... }
      // );
      // return response.ok ? { success: true } : { success: false, error: "..." };

      console.info("[WhatsApp] Would send message:", {
        to: payload.to,
        message: payload.message,
      });

      return { success: true };
    },
  };
}
