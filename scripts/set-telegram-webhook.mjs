import { config } from "dotenv";

// Match Next.js local environment precedence while still allowing deployment
// environment variables to take priority.
config({ path: ".env.local" });
config({ path: ".env" });

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const configuredAppUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();

if (!token) throw new Error("Set TELEGRAM_BOT_TOKEN before configuring the webhook.");
if (!secret || secret.length > 256 || !/^[A-Za-z0-9_-]+$/.test(secret)) {
  throw new Error("TELEGRAM_WEBHOOK_SECRET must be 1–256 characters using letters, numbers, _ or -.");
}
if (!configuredAppUrl) throw new Error("Set APP_URL or NEXT_PUBLIC_APP_URL before configuring the webhook.");

const appUrl = new URL(configuredAppUrl);
if (appUrl.protocol !== "https:") throw new Error("Telegram webhooks require an HTTPS app URL.");

const webhookUrl = new URL("/api/webhooks/telegram", appUrl).toString();
const routeCheck = await fetch(webhookUrl, { method: "GET", redirect: "manual" });
if (routeCheck.status !== 405) {
  throw new Error(`The public webhook route returned HTTP ${routeCheck.status}; expected 405 from the deployed POST-only endpoint. Deploy the Telegram route and ensure the endpoint is public before configuring the bot.`);
}

async function callTelegram(method, payload = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    throw new Error(`Telegram ${method} failed: ${result?.description || response.statusText}`);
  }
  return result.result;
}

await callTelegram("setWebhook", {
  url: webhookUrl,
  secret_token: secret,
  allowed_updates: ["callback_query"],
  max_connections: 10,
  drop_pending_updates: false,
});

const info = await callTelegram("getWebhookInfo");
if (info.url !== webhookUrl || !info.allowed_updates?.includes("callback_query")) {
  throw new Error("Telegram accepted the webhook, but callback updates could not be verified.");
}

console.log(`Telegram payment-review webhook is active at ${appUrl.host}/api/webhooks/telegram.`);
if (info.last_error_message) {
  console.warn(`Telegram reports a recent delivery error: ${info.last_error_message}`);
}
