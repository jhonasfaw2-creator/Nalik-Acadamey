// ── Shared registration display helpers ─────────────────────────────
// Used by /payment/return (confirmation), /registration (public lookup),
// and the lookup API so every surface formats data identically.

export interface RegistrationSummary {
  referenceId: string;
  fullName: string;
  course: string | null;
  scheduleDays: string | null;
  scheduleSession: string | RegistrationSummaryScheduleSession | null;
  startTime: string | null;
  endTime: string | null;
  startDate: string | null;
  amount: number | null;
  currency: string | null;
  paymentStatus: string;
  registrationStatus: string;
  paidAt: string | null;
}

interface RegistrationSummaryScheduleSession {
  group: string;
  label: string;
}

/** "08:00" → "8:00 AM" (returns the input unchanged when not HH:MM). */
export function formatTime(time: string | null | undefined): string {
  const m = /^(\d{2}):(\d{2})$/.exec((time || "").trim());
  if (!m) return time || "";
  const h = Number(m[1]);
  const min = m[2];
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${suffix}`;
}

/** "2026-10-05" | ISO → "5 Oct 2026" (or the input when unparseable). */
export function formatDate(input: string | null | undefined): string {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Days string "Monday, Wednesday, Friday" → "Monday / Wednesday / Friday". */
export function formatDays(days: string | null | undefined): string {
  if (!days) return "";
  return days
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .join(" / ");
}

/**
 * Display state derived from BOTH statuses. The database only stores
 * PENDING_PAYMENT / PAID / CONFIRMED; "ENROLLED" is presentation — a PAID or
 * CONFIRMED registration reads as enrolled to the student.
 */
export function getEnrollmentState(summary: {
  registrationStatus: string;
  paymentStatus: string;
}): {
  enrolled: boolean;
  enrollmentLabel: string;
  paymentLabel: string;
  tone: "success" | "pending" | "failed";
} {
  const paid = summary.paymentStatus === "SUCCESS";
  const confirmed = summary.registrationStatus === "CONFIRMED";
  const pendingPayment = summary.registrationStatus === "PENDING_PAYMENT" || !paid;

  if (paid && confirmed) {
    return { enrolled: true, enrollmentLabel: "ENROLLED", paymentLabel: "PAID", tone: "success" };
  }
  if (paid) {
    return { enrolled: true, enrollmentLabel: "ENROLLED", paymentLabel: "PAID", tone: "success" };
  }
  if (pendingPayment) {
    return {
      enrolled: false,
      enrollmentLabel: "NOT ENROLLED",
      paymentLabel: "PENDING",
      tone: "pending",
    };
  }
  // Unreachable in practice; keeps tone exhaustive.
  return { enrolled: false, enrollmentLabel: "NOT ENROLLED", paymentLabel: summary.paymentStatus, tone: "failed" };
}

/** True when the reference ID looks like ours (NA-YYYY-XXXXXX). Loose on purpose. */
export function looksLikeReferenceId(id: string): boolean {
  return /^NA-\d{4}-[A-Z2-9]{4,10}$/.test(id.trim().toUpperCase());
}
