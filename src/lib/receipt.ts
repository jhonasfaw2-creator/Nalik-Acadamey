import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { formatDate, formatDays, formatTime } from "@/lib/registration";

// ── PDF receipt builder ─────────────────────────────────────────────────
// Produces a real, downloadable PDF receipt for a settled registration.
// Generated server-side so the data comes straight from the database (never
// from the browser) and no PDF library is shipped to the client.
//
// pdf-lib's standard fonts use the WinAnsi encoding, which does not cover
// non-Latin scripts. Text is normalized through `winAnsi` first so an
// unrepresentable character can never crash generation.

export interface ReceiptData {
  referenceId: string;
  fullName: string;
  courseTitle: string | null;
  scheduleDays: string | null;
  scheduleGroup: string | null;
  scheduleSession: string | null;
  startTime: string | null;
  endTime: string | null;
  startDate: string | null;
  amount: number | null;
  currency: string | null;
  paymentStatus: string;
  merchantReference: string | null;
  chapaReference: string | null;
  paidAt: string | null;
}

const NAVY = rgb(0x15 / 255, 0x1b / 255, 0x29 / 255);
const GOLD = rgb(0xe2 / 255, 0xa0 / 255, 0x33 / 255);
const WHITE = rgb(1, 1, 1);
const GRAY = rgb(0.44, 0.47, 0.52);
const LIGHT = rgb(0.95, 0.96, 0.97);
const BORDER = rgb(0.88, 0.89, 0.9);

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Common typographic characters we emit in the UI that WinAnsi lacks a direct
// codepoint for; map them to safe ASCII equivalents before anything else.
const TYPOGRAPHY: Record<string, string> = {
  "\u2013": "-", // en dash
  "\u2014": "-", // em dash
  "\u2018": "'",
  "\u2019": "'",
  "\u201c": '"',
  "\u201d": '"',
  "\u2026": "...",
  "\u00b7": "-", // middle dot
  "\u2022": "-",
};

/**
 * Rewrites text into the WinAnsi subset the standard PDF fonts understand.
 * Characters outside it become "?" rather than throwing at draw time.
 */
export function winAnsi(input: string | null | undefined): string {
  if (!input) return "";
  return Array.from(String(input))
    .map((ch) => {
      if (TYPOGRAPHY[ch]) return TYPOGRAPHY[ch];
      const code = ch.codePointAt(0) ?? 0;
      if (code === 0x0a || code === 0x09) return " ";
      if (code >= 0x20 && code <= 0x7e) return ch;
      if (code >= 0xa0 && code <= 0xff) return ch;
      return "?";
    })
    .join("");
}

function formatBirr(amount: number | null, currency: string | null): string {
  if (amount == null) return "-";
  return `${amount.toLocaleString("en-US")} ${currency || "ETB"}`;
}

function formatStamp(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

/** Splits text into lines that fit `maxWidth`, breaking on spaces. */
function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  if (!text) return [""];
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Truncates a single line with an ellipsis if it still does not fit. */
function clampLine(font: PDFFont, text: string, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}...`, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}...`;
}

export async function buildReceiptPdf(data: ReceiptData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(winAnsi(`Nalik Academy receipt ${data.referenceId}`));
  doc.setAuthor("Nalik Academy");
  doc.setCreator("Nalik Academy");

  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  // ── Header band ──
  const headerHeight = 118;
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - headerHeight,
    width: PAGE_WIDTH,
    height: headerHeight,
    color: NAVY,
  });
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - headerHeight - 4,
    width: PAGE_WIDTH,
    height: 4,
    color: GOLD,
  });

  page.drawText(winAnsi("Nalik Academy"), {
    x: MARGIN,
    y: PAGE_HEIGHT - 62,
    size: 24,
    font: bold,
    color: WHITE,
  });
  page.drawText(winAnsi("PAYMENT RECEIPT"), {
    x: MARGIN,
    y: PAGE_HEIGHT - 86,
    size: 11,
    font: regular,
    color: GOLD,
  });

  // PAID badge, right side of the header.
  const badgeText = winAnsi(data.paymentStatus === "SUCCESS" ? "PAID" : data.paymentStatus);
  const badgeFontSize = 11;
  const badgeTextWidth = bold.widthOfTextAtSize(badgeText, badgeFontSize);
  const badgeWidth = badgeTextWidth + 28;
  const badgeHeight = 26;
  const badgeX = PAGE_WIDTH - MARGIN - badgeWidth;
  const badgeY = PAGE_HEIGHT - 74;
  page.drawRectangle({
    x: badgeX,
    y: badgeY,
    width: badgeWidth,
    height: badgeHeight,
    color: GOLD,
    borderColor: GOLD,
  });
  page.drawText(badgeText, {
    x: badgeX + 14,
    y: badgeY + (badgeHeight - badgeFontSize) / 2 + 1,
    size: badgeFontSize,
    font: bold,
    color: NAVY,
  });

  // ── Body ──
  let y = PAGE_HEIGHT - headerHeight - 52;

  page.drawText(winAnsi("Receipt for"), {
    x: MARGIN,
    y,
    size: 10,
    font: regular,
    color: GRAY,
  });
  y -= 22;
  page.drawText(clampLine(bold, winAnsi(data.fullName), 18, CONTENT_WIDTH), {
    x: MARGIN,
    y,
    size: 18,
    font: bold,
    color: NAVY,
  });
  y -= 34;

  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Registration ID", value: data.referenceId, mono: true },
    { label: "Course", value: data.courseTitle || "-" },
    ...(data.scheduleDays
      ? [{ label: "Schedule days", value: formatDays(data.scheduleDays) }]
      : []),
    ...(data.startTime && data.endTime
      ? [
          {
            label: "Class time",
            value: `${formatTime(data.startTime)} - ${formatTime(data.endTime)}${
              data.scheduleSession ? ` (${data.scheduleSession})` : ""
            }`,
          },
        ]
      : []),
    ...(data.startDate ? [{ label: "Start date", value: formatDate(data.startDate) }] : []),
    { label: "Amount paid", value: formatBirr(data.amount, data.currency) },
    { label: "Payment status", value: data.paymentStatus === "SUCCESS" ? "PAID" : data.paymentStatus },
    ...(data.merchantReference
      ? [{ label: "Merchant reference", value: data.merchantReference, mono: true }]
      : []),
    ...(data.chapaReference
      ? [{ label: "Transaction reference", value: data.chapaReference, mono: true }]
      : []),
    { label: "Confirmed on", value: formatStamp(data.paidAt) },
    { label: "Issued", value: formatStamp(new Date().toISOString()) },
  ];

  const labelSize = 10.5;
  const valueSize = 11;
  const rowPadY = 9;
  const labelWidth = 150;
  const valueMaxWidth = CONTENT_WIDTH - labelWidth - 16;

  for (const row of rows) {
    const valueFont = row.mono ? mono : bold;
    const valueLines = wrapText(valueFont, winAnsi(row.value), valueSize, valueMaxWidth);
    const rowHeight = Math.max(1, valueLines.length) * 15 + rowPadY * 2;

    page.drawRectangle({
      x: MARGIN,
      y: y - rowHeight,
      width: CONTENT_WIDTH,
      height: rowHeight,
      color: LIGHT,
    });
    page.drawRectangle({
      x: MARGIN,
      y: y - rowHeight,
      width: CONTENT_WIDTH,
      height: 1,
      color: BORDER,
    });

    page.drawText(winAnsi(row.label), {
      x: MARGIN + 14,
      y: y - rowPadY - 3,
      size: labelSize,
      font: regular,
      color: GRAY,
    });

    valueLines.forEach((line, i) => {
      const lineWidth = valueFont.widthOfTextAtSize(line, valueSize);
      page.drawText(line, {
        x: MARGIN + CONTENT_WIDTH - 14 - lineWidth,
        y: y - rowPadY - 3 - i * 15,
        size: valueSize,
        font: valueFont,
        color: NAVY,
      });
    });

    y -= rowHeight + 2;
  }

  // ── Footer ──
  const footerY = 64;
  page.drawRectangle({
    x: 0,
    y: footerY - 22,
    width: PAGE_WIDTH,
    height: 1,
    color: BORDER,
  });
  page.drawText(winAnsi("This receipt confirms your enrollment at Nalik Academy."), {
    x: MARGIN,
    y: footerY - 6,
    size: 9,
    font: regular,
    color: GRAY,
  });
  page.drawText(winAnsi("info@nalikacademy.com  -  Yeab Building 5th Floor, Addis Ababa"), {
    x: MARGIN,
    y: footerY - 22,
    size: 9,
    font: regular,
    color: GRAY,
  });

  return doc.save();
}
