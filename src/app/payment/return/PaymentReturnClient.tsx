"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarPlus,
  Printer,
  Search,
  Home,
} from "lucide-react";
import RegistrationDetails, { StatusPill } from "@/components/RegistrationDetails";
import { getEnrollmentState, type RegistrationSummary } from "@/lib/registration";

type Status = "checking" | "success" | "failed" | "cancelled";

export default function PaymentReturnClient() {
  const [status, setStatus] = useState<Status>("checking");
  const [registration, setRegistration] = useState<RegistrationSummary | null>(null);
  const searchParams = useSearchParams();
  const referenceId = searchParams.get("referenceId");

  const normalizeRemoteStatus = (value: unknown): string => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const tokens = raw.split(/[\/|,&]+/).map((part) => part.trim().toUpperCase()).filter(Boolean);
    for (const token of tokens) {
      if (token === "SUCCESS") return "SUCCESS";
      if (token === "CANCELLED") return "CANCELLED";
      if (token === "FAILED") return "FAILED";
      if (token === "INCOMPLETE") return "INCOMPLETE";
    }
    return raw.toUpperCase();
  };

  useEffect(() => {
    if (!referenceId) {
      setStatus("failed");
      return;
    }

    let cancelled = false;
    let attempts = 0;

    // The redirect is only a signal — the server verifies the payment with
    // Chapa before we ever show success.
    const check = async (): Promise<boolean> => {
      try {
        const res = await fetch(`/api/payments/verify?referenceId=${encodeURIComponent(referenceId)}`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return true;

        const remoteStatus = normalizeRemoteStatus(data.status);
        if (remoteStatus === "SUCCESS") {
          // buildSummary returns fullName-less data; fetch the full summary via
          // the lookup endpoint so the card has everything (name, start date).
          const lookup = await fetch(`/api/registrations/lookup?id=${encodeURIComponent(referenceId)}`, { cache: "no-store" })
            .then((r) => r.json())
            .catch(() => null);
          if (cancelled) return true;
          if (lookup?.found && lookup.registration) {
            const reg = lookup.registration;
            setRegistration({
              referenceId: reg.referenceId,
              fullName: reg.fullName,
              course: reg.course,
              scheduleDays: reg.schedule?.days ?? null,
              scheduleSession: reg.schedule ? { group: reg.schedule.group, label: reg.schedule.session } : null,
              startTime: reg.schedule?.startTime ?? null,
              endTime: reg.schedule?.endTime ?? null,
              startDate: reg.schedule?.startDate ?? null,
              amount: reg.amount,
              currency: reg.currency,
              paymentStatus: reg.paymentStatus,
              registrationStatus: reg.registrationStatus,
              paidAt: reg.paidAt,
            });
          } else {
            // Fallback: minimal card from verify data alone.
            setRegistration({
              referenceId,
              fullName: "",
              course: data.registration?.course ?? null,
              scheduleDays: null,
              scheduleSession: null,
              startTime: null,
              endTime: null,
              startDate: null,
              amount: data.registration?.amount ?? null,
              currency: data.registration?.currency ?? null,
              paymentStatus: "SUCCESS",
              registrationStatus: data.registration?.registrationStatus ?? "PAID",
              paidAt: data.registration?.paidAt ?? null,
            });
          }
          setStatus("success");
          return true;
        }
        if (remoteStatus === "CANCELLED") {
          setStatus("cancelled");
          return true;
        }
        if (remoteStatus === "FAILED" || remoteStatus === "INCOMPLETE") {
          if (attempts >= 3) {
            setStatus("failed");
            return true;
          }
          return false;
        }
      } catch {
        // keep retrying
      }
      return false;
    };

    const tick = async () => {
      attempts++;
      const done = await check();
      if (!done && attempts >= 40 && !cancelled) setStatus("failed");
    };

    tick();
    const id = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [referenceId]);

  const state = useMemo(
    () => (registration ? getEnrollmentState(registration) : null),
    [registration]
  );

  if (status === "success" && registration && state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-white px-4 py-10 print:block">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 print:h-12 print:w-12">
              <svg className="h-7 w-7 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-navy print:text-xl">Payment Successful</h1>
            <p className="mt-1.5 flex items-center justify-center gap-2 text-sm text-gray-600">
              You&apos;re enrolled at Nalik Academy
              <StatusPill label={state.enrollmentLabel} tone={state.tone} />
            </p>
          </div>

          <div className="mt-6">
            <RegistrationDetails registration={registration} highlightReference />
          </div>

          {/* Actions */}
          <div className="mt-6 space-y-2.5 print:hidden">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <a
                href={`/registration?id=${encodeURIComponent(registration.referenceId)}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-4 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover print:hidden"
              >
                <Search size={15} /> View My Registration
              </a>
              <a
                href={`/api/registrations/lookup/ics?id=${encodeURIComponent(registration.referenceId)}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy/15 bg-white px-4 py-3 text-sm font-semibold text-navy transition-colors hover:border-gold hover:bg-gold/5"
              >
                <CalendarPlus size={15} /> Add Schedule to Calendar
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy/15 bg-white px-4 py-3 text-sm font-semibold text-navy transition-colors hover:border-gold hover:bg-gold/5"
              >
                <Printer size={15} /> Print Confirmation
              </button>
            </div>
            <a
              href="/"
              className="flex items-center justify-center gap-1.5 pt-1 text-sm font-medium text-gray-500 transition-colors hover:text-gold"
            >
              <Home size={14} /> Back to Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  const panel = "w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm";

  return (
    <div className="flex min-h-screen items-center justify-center bg-warm-white px-4">
      <div className={panel}>
        {status === "checking" && (
          <>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
            <h1 className="text-lg font-bold text-navy">Confirming your payment</h1>
            <p className="mt-2 text-sm text-gray-500">Please wait while we verify your transaction with Chapa…</p>
            {referenceId && <p className="mt-3 text-xs text-gray-400">Ref: {referenceId}</p>}
          </>
        )}

        {status === "cancelled" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
              <span className="text-2xl">⚠️</span>
            </div>
            <h1 className="text-xl font-bold text-navy">Payment Cancelled</h1>
            <p className="mt-2 text-sm text-gray-500">
              Your payment was cancelled. Your registration is saved as <span className="font-semibold">Pending Payment</span> — you can pay anytime from the home page.
            </p>
            {referenceId && <p className="mt-3 text-xs text-gray-400">Ref: {referenceId}</p>}
            <div className="mt-5 space-y-2">
              <a
                href={`/registration?id=${encodeURIComponent(referenceId || "")}`}
                className="inline-flex w-full items-center justify-center rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Check Registration Status
              </a>
              <a href="/" className="inline-flex w-full items-center justify-center rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy transition-colors hover:bg-gold-hover">
                Back to Home
              </a>
            </div>
          </>
        )}

        {status === "failed" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
              <span className="text-2xl">⚠️</span>
            </div>
            <h1 className="text-xl font-bold text-navy">Payment Not Completed</h1>
            <p className="mt-2 text-sm text-gray-500">
              We could not confirm your payment. Your registration is saved — you can retry from the home page.
            </p>
            {referenceId && <p className="mt-3 text-xs text-gray-400">Ref: {referenceId}</p>}
            <div className="mt-5 space-y-2">
              <a
                href={`/registration?id=${encodeURIComponent(referenceId || "")}`}
                className="inline-flex w-full items-center justify-center rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Check Registration Status
              </a>
              <a href="/" className="inline-flex w-full items-center justify-center rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy transition-colors hover:bg-gold-hover">
                Back to Home
              </a>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
