"use client";

// ── Shared registration details card ────────────────────────────────
// One component renders the enrollment summary everywhere: the payment
// confirmation page and the public /registration lookup page. Keeps the two
// surfaces consistent and avoids duplicated formatting logic.

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  XCircle,
  CalendarDays,
  GraduationCap,
  User,
  Hash,
  CreditCard,
  School,
  Copy,
  Check,
} from "lucide-react";
import {
  formatDays,
  formatDate,
  formatTime,
  getEnrollmentState,
  type RegistrationSummary,
} from "@/lib/registration";

interface RegistrationDetailsProps {
  registration: RegistrationSummary;
  /** When true the reference row is emphasized (confirmation context). */
  highlightReference?: boolean;
}

export default function RegistrationDetails({ registration, highlightReference = false }: RegistrationDetailsProps) {
  const state = getEnrollmentState(registration);
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

  const rows: { icon: React.ReactNode; label: string; value: React.ReactNode; strong?: boolean }[] = [
    {
      icon: <User size={15} className="text-gold" />,
      label: "Student",
      value: registration.fullName,
      strong: true,
    },
    {
      icon: <School size={15} className="text-gold" />,
      label: "Course",
      value: registration.course || "To be confirmed",
    },
  ];

  if (registration.scheduleDays || registration.startTime) {
    rows.push({
      icon: <CalendarDays size={15} className="text-gold" />,
      label: "Schedule days",
      value: registration.scheduleDays ? formatDays(registration.scheduleDays) : "To be confirmed",
    });
    rows.push({
      icon: <Clock3 size={15} className="text-gold" />,
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
      icon: <GraduationCap size={15} className="text-gold" />,
      label: "Start date",
      value: formatDate(registration.startDate),
    });
  }

  rows.push(
    {
      icon: <Hash size={15} className="text-gold" />,
      label: "Registration ID",
      value: (
        <button
          type="button"
          onClick={copyReference}
          className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 -mx-1.5 font-mono text-sm font-semibold text-gold transition-colors hover:bg-gold/10"
          title="Copy registration ID"
        >
          {registration.referenceId}
          {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} className="opacity-0 transition-opacity group-hover:opacity-100" />}
        </button>
      ),
      strong: highlightReference,
    },
    {
      icon: <CreditCard size={15} className="text-gold" />,
      label: "Payment status",
      value: <StatusPill label={state.paymentLabel} tone={state.tone} />,
    },
    {
      icon: <GraduationCap size={15} className="text-gold" />,
      label: "Enrollment status",
      value: <StatusPill label={state.enrollmentLabel} tone={state.tone} />,
    }
  );

  return (
    <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white text-left">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-4 px-5 py-3.5">
          <span className="flex shrink-0 items-center gap-2 text-sm text-gray-500">
            {row.icon}
            {row.label}
          </span>
          <span className={`text-right text-sm ${row.strong ? "font-semibold text-navy" : "font-medium text-navy"}`}>
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
      ? "bg-green-50 text-green-700 border-green-200"
      : tone === "pending"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-red-50 text-red-700 border-red-200";
  const Icon = tone === "success" ? CheckCircle2 : tone === "pending" ? Clock3 : XCircle;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles}`}>
      <Icon size={13} />
      {label}
    </span>
  );
}
