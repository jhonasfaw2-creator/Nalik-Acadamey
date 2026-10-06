// ── Shared registration display helpers ─────────────────────────────
// Shared registration display helpers used by the public registration lookup.

export interface RegistrationSummary {
  referenceId: string;
  fullName: string;
  course: string | null;
  courseId: string | null;
  downloadToken: string | null;
  courseMaterials: { id: string; title: string; fileUrl: string; fileType: string }[];
  courseMaterialsError: string | null;
  scheduleDays: string | null;
  scheduleSession: string | RegistrationSummaryScheduleSession | null;
  startTime: string | null;
  endTime: string | null;
  startDate: string | null;
  registrationStatus: string;
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
 * PAID is retained as a legacy registration status for existing records.
 */
export function getRegistrationState(registrationStatus: string): {
  label: string;
  tone: "success" | "pending" | "failed";
} {
  if (registrationStatus === "PAID" || registrationStatus === "CONFIRMED") {
    return { label: "ENROLLED", tone: "success" };
  }
  if (registrationStatus === "PENDING") {
    return {
      label: "PENDING",
      tone: "pending",
    };
  }
  return { label: registrationStatus, tone: "failed" };
}

/** True when the reference ID looks like ours (NA-YYYY-XXXXXX). Loose on purpose. */
export function looksLikeReferenceId(id: string): boolean {
  return /^NA-\d{4}-[A-Z2-9]{4,10}$/.test(id.trim().toUpperCase());
}
