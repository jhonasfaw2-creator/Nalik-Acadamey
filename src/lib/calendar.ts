// ── Calendar (.ics) generation for confirmed registrations ──────────
// Produces a downloadable event for the class schedule. Kept dependency-free
// and minimal: one recurring event covering the course days/times is enough
// for a student's calendar.

import { formatTime } from "./registration";

interface ScheduleEventData {
  referenceId: string;
  courseTitle: string;
  days: string[]; // ["Monday", "Wednesday", ...]
  startTime: string; // "14:00"
  endTime: string; // "16:00"
  startDate: string | null; // ISO date of first class, when known
  durationWeeks?: number;
}

const DAY_TO_ICS: Record<string, string> = {
  monday: "MO",
  tuesday: "TU",
  wednesday: "WE",
  thursday: "TH",
  friday: "FR",
  saturday: "SA",
  sunday: "SU",
};

/** "2026-10-05" | ISO string → local midnight UTC stamp, e.g. 20261005. */
function toIcsDate(input: string): string | null {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function foldLine(line: string): string {
  // RFC 5545: lines longer than 75 octets are folded with CRLF + space.
  if (line.length <= 73) return line;
  const chunks: string[] = [];
  let rest = line;
  chunks.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 0) {
    chunks.push(" " + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  return chunks.join("\r\n");
}

/**
 * Build a VEVENT for the recurring class sessions. Recurs weekly on the class
 * days at the session time. Falls back to the upcoming Monday when no start
 * date is known, so the event is still anchored to a valid date.
 */
export function buildScheduleIcs(data: ScheduleEventData): string {
  const weekDays = data.days
    .map((d) => DAY_TO_ICS[d.trim().toLowerCase()])
    .filter(Boolean);

  const startBase = data.startDate && toIcsDate(data.startDate) ? new Date(data.startDate) : nextWeekday(data.days[0]);
  const start = toIcsDate(startBase.toISOString()) || toIcsDate(new Date().toISOString())!;

  // Anchor on the first occurrence that falls on one of the class days.
  const firstOccurrence = weekDays.length > 0 ? nextOccurrenceOnOrAfter(startBase, data.days) : startBase;
  const firstDate = toIcsDate(firstOccurrence.toISOString()) || start;

  const [sh, sm] = parseHm(data.startTime);
  const [eh, em] = parseHm(data.endTime);
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const until = new Date(firstOccurrence);
  const weeks = Math.max(1, data.durationWeeks ?? 12);
  until.setUTCDate(until.getUTCDate() + weeks * 7);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nalik Academy//Registration//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${data.referenceId}@nalikacademy`,
    `DTSTAMP:${dtstamp}`,
    `SUMMARY:${escapeIcsText(`${data.courseTitle} — Nalik Academy`)}`,
    `DESCRIPTION:${escapeIcsText(
      `Class schedule for registration ${data.referenceId}. ${formatTime(data.startTime)}–${formatTime(data.endTime)}.`
    )}`,
    `LOCATION:${escapeIcsText("Nalik Academy, Yeab Building 5th Floor, Addis Ababa")}`,
    `DTSTART;TZID=Africa/Addis_Ababa:${firstDate}T${pad(sh)}${pad(sm)}00`,
    `DTEND;TZID=Africa/Addis_Ababa:${firstDate}T${pad(eh)}${pad(em)}00`,
  ];

  if (weekDays.length > 0) {
    lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${weekDays.join(",")};UNTIL=${toIcsDate(until.toISOString())}T235959Z`);
  }

  lines.push("BEGIN:VALARM", "TRIGGER:-PT60M", "ACTION:DISPLAY", `DESCRIPTION:${escapeIcsText(`${data.courseTitle} class in 1 hour`)}`, "END:VALARM");
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

function parseHm(time: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec((time || "").trim());
  if (!m) return [0, 0];
  return [Number(m[1]), Number(m[2])];
}

function nextWeekday(dayName: string | undefined): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  if (!dayName) return d;
  const target = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(
    dayName.trim().toLowerCase()
  );
  if (target < 0) return d;
  while (d.getUTCDay() !== target) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function nextOccurrenceOnOrAfter(from: Date, days: string[]): Date {
  const targets = days
    .map((d) => ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(d.trim().toLowerCase()))
    .filter((i) => i >= 0);
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  if (targets.length === 0) return d;
  for (let i = 0; i < 7; i++) {
    if (targets.includes(d.getUTCDay())) return d;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}
