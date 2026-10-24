"use client";

// ── Shared registration details card ────────────────────────────────
// Shared registration summary for the public /registration lookup page.

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  XCircle,
  Copy,
  Check,
} from "lucide-react";
import {
  formatDays,
  formatDate,
  formatTime,
  getRegistrationState,
  type RegistrationSummary,
} from "@/lib/registration";

interface RegistrationDetailsProps {
  registration: RegistrationSummary;
  /** When true the reference row is emphasized (confirmation context). */
  highlightReference?: boolean;
}

export default function RegistrationDetails({ registration, highlightReference = false }: RegistrationDetailsProps) {
  const state = getRegistrationState(registration.registrationStatus);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(registration.referenceId);
      setCopied(true);
    } catch {
      // Clipboard unavailable (permissions/insecure context) — no-op.
    }
  };

  const rows: { label: string; value: React.ReactNode; strong?: boolean }[] = [
    {
      label: "Student",
      value: registration.fullName,
      strong: true,
    },
    {
      label: "Course",
      value: registration.course || "To be confirmed",
    },
  ];

  if (registration.scheduleDays || registration.startTime) {
    rows.push({
      label: "Schedule days",
      value: registration.scheduleDays ? formatDays(registration.scheduleDays) : "To be confirmed",
    });
    rows.push({
      label: "Class time",
      value:
        registration.startTime && registration.endTime
          ? `${formatTime(registration.startTime)} – ${formatTime(registration.endTime)}${
              registration.scheduleSession ? ` · ${sessionLabel(registration.scheduleSession)}` : ""
            }`
          : "To be confirmed",
    });
  }

  if (registration.startDate) {
    rows.push({
      label: "Start date",
      value: formatDate(registration.startDate),
    });
  }

  rows.push(
    {
      label: "Registration ID",
      value: (
        <button
          type="button"
          onClick={copyReference}
          className="group inline-flex min-h-11 max-w-full items-center gap-1.5 break-all rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold text-gold transition-colors hover:bg-gold/10 sm:text-sm"
          title="Copy registration ID"
        >
          {registration.referenceId}
          {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} className="opacity-0 transition-opacity group-hover:opacity-100" />}
        </button>
      ),
      strong: highlightReference,
    },
    {
      label: "Registration status",
      value: <StatusPill label={state.label} tone={state.tone} />,
    }
  );

  if (registration.paymentProofStatus) {
    const proofTone =
      registration.paymentProofStatus === "APPROVED"
        ? "success"
        : registration.paymentProofStatus === "REJECTED"
          ? "failed"
          : "pending";
    rows.push({
      label: "Payment proof",
      value: <StatusPill label={registration.paymentProofStatus.replace(/_/g, " ")} tone={proofTone} />,
    });
    if (registration.paymentProofNote && registration.paymentProofStatus === "REJECTED") {
      rows.push({
        label: "Admin note",
        value: registration.paymentProofNote,
      });
    }
  }

  return (
    <div className="space-y-2 bg-white text-left">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-2 px-3 py-3 sm:flex sm:justify-between sm:gap-4 sm:px-5 sm:py-3.5">
          <span className="min-w-0 text-xs leading-5 text-gray-500 sm:text-sm">{row.label}</span>
          <span className={`min-w-0 break-words text-right text-sm ${row.strong ? "font-semibold text-navy" : "font-medium text-navy"}`}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function sessionLabel(session: RegistrationSummary["scheduleSession"]): string {
  if (!session) return "";
  if (typeof session === "string") return session;
  return `Schedule ${session.group}`;
}

export function StatusPill({ label, tone }: { label: string; tone: "success" | "pending" | "failed" }) {
  const styles =
    tone === "success"
      ? "text-green-700"
      : tone === "pending"
        ? "text-amber-700"
        : "text-red-700";
  const Icon = tone === "success" ? CheckCircle2 : tone === "pending" ? Clock3 : XCircle;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${styles}`}>
      <Icon size={13} />
      {label}
    </span>
  );
}
