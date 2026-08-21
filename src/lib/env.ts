/**
 * Validate required environment variables.
 * Called once at server startup. Logs warnings for missing optional vars.
 */

const REQUIRED_VARS = ["DATABASE_URL"] as const;

const OPTIONAL_VARS = [
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "SESSION_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "ADMIN_WHATSAPP_NUMBER",
] as const;

export function validateEnv() {
  const missing: string[] = [];

  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.error(
      `[Env] Missing required environment variables: ${missing.join(", ")}. ` +
        "The application may not work correctly."
    );
  }

  // Warn about defaults
  if (!process.env.ADMIN_PASSWORD) {
    console.warn(
      "[Env] ADMIN_PASSWORD not set. Using default password. " +
        "Set ADMIN_PASSWORD in your .env for production."
    );
  }

  if (!process.env.SESSION_SECRET) {
    console.warn(
      "[Env] SESSION_SECRET not set. Using default secret. " +
        "Set SESSION_SECRET in your .env for production."
    );
  }

  if (!process.env.RESEND_API_KEY) {
    console.info(
      "[Env] RESEND_API_KEY not set. Emails will not be sent."
    );
  }
}
