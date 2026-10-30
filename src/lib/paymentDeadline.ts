// ── Payment-proof deadline ──────────────────────────────────────────
// Public (bank-transfer) registrations must submit proof within 24 hours of
// creation. Timestamps are stored in UTC and compared as epoch milliseconds, so
// the server's local time zone can never shift the deadline.

export const PAYMENT_PROOF_WINDOW_MS = 24 * 60 * 60 * 1000;

export function getPaymentProofDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + PAYMENT_PROOF_WINDOW_MS);
}

/**
 * True while proof may still be submitted. A null deadline means the
 * registration has no deadline (admin manual enrolments).
 */
export function isPaymentProofWindowOpen(
  deadline: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!deadline) return true;
  const value = typeof deadline === "string" ? new Date(deadline) : deadline;
  if (Number.isNaN(value.getTime())) return true;
  return value.getTime() > now.getTime();
}

/** Format a deadline in the viewer's local time, including the time zone. */
export function formatPaymentDeadline(
  value: string | Date | null | undefined,
  locale = "en-GB",
): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  try {
    return date.toLocaleString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return date.toLocaleString();
  }
}
