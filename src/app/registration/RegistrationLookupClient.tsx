"use client";

// ── Public registration lookup (/registration) ──────────────────────
// A student enters their reference ID and sees their live enrollment +
// schedule. Data comes from the public lookup API, so admin changes (course,
// schedule, status) are reflected automatically on every check.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  CalendarPlus,
  Printer,
  AlertCircle,
  Loader2,
  Download,
  RefreshCw,
} from "lucide-react";
import RegistrationDetails from "@/components/RegistrationDetails";
import CheckoutButton from "@/components/checkout-button";
import type { RegistrationSummary } from "@/lib/registration";

type LookupState = "idle" | "loading" | "found" | "error";

export default function RegistrationLookupClient() {
  const searchParams = useSearchParams();
  const [id, setId] = useState("");
  const [state, setState] = useState<LookupState>("idle");
  const [error, setError] = useState("");
  const [registration, setRegistration] = useState<RegistrationSummary | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState("");

  const lookup = useCallback(async (rawId: string, silent = false): Promise<boolean> => {
    const trimmed = rawId.trim().toUpperCase();
    if (!trimmed) {
      if (!silent) {
        setError("Please enter your registration ID.");
        setState("error");
      }
      return false;
    }
    if (!silent) {
      setState("loading");
      setError("");
    }
    try {
      const res = await fetch(`/api/registrations/lookup?id=${encodeURIComponent(trimmed)}`, { cache: "no-store" });
      const data = await res.json();
      if (data.found && data.registration) {
        const reg = data.registration;
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
        setState("found");
        return true;
      }
      setError(data.error || "We couldn't find a registration with that ID.");
      setRegistration(null);
      setState("error");
      return false;
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
      setRegistration(null);
      setState("error");
      return false;
    }
  }, []);

  // Deep link: /registration?id=NA-2026-XXXXXX looks up immediately.
  useEffect(() => {
    const prefill = searchParams.get("id");
    if (prefill) {
      setId(prefill.toUpperCase());
      lookup(prefill);
    }
  }, [searchParams, lookup]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    lookup(id);
  };

  /**
   * Asks the server to confirm the payment with Chapa, then re-reads the
   * registration.
   *
   * This is the escape hatch for the most common dead end: the customer pays on
   * Chapa's own receipt page and never gets redirected back, so nothing in the
   * browser ever notices the money arrived. Chapa is the only authority on that,
   * so this asks Chapa directly instead of guessing from the local record.
   */
  const checkPayment = async () => {
    if (!registration || checking) return;
    setChecking(true);
    setCheckNote("");
    try {
      const res = await fetch(
        `/api/payments/verify?referenceId=${encodeURIComponent(registration.referenceId)}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => null);
      const status = typeof data?.status === "string" ? data.status.toUpperCase() : "";

      if (status === "SUCCESS") {
        setCheckNote("Payment confirmed. Your seat is booked.");
      } else if (status === "FAILED" || status === "CANCELLED" || status === "INCOMPLETE") {
        setCheckNote(`Chapa reports this payment as ${status.toLowerCase()}. You can start a new payment below.`);
      } else {
        setCheckNote("Chapa has not confirmed this payment yet. It can take a minute — try again shortly.");
      }
    } catch {
      setCheckNote("We couldn't reach the payment service. Please try again.");
    } finally {
      setChecking(false);
      await lookup(registration.referenceId, true);
    }
  };

  const unpaid = registration != null && registration.paymentStatus !== "SUCCESS";

  return (
    <div className="flex min-h-screen flex-col bg-warm-white">
      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center">
            <a href="/" className="inline-flex items-center gap-2.5">
              <img src="/assets/logo.jpeg" alt="Nalik Academy" className="h-9 w-9 rounded-lg object-cover" />
              <span className="text-lg font-bold text-navy">Nalik Academy</span>
            </a>
            <h1 className="mt-6 text-2xl font-bold text-navy sm:text-3xl">Check Your Registration</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Enter your registration ID to view your enrollment and class schedule.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="mt-8">
            <label htmlFor="reg-id" className="mb-1.5 block text-sm font-medium text-gray-700">
              Registration ID
            </label>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input
                id="reg-id"
                name="reg-id"
                value={id}
                onChange={(e) => setId(e.target.value.toUpperCase())}
                placeholder="NA-2026-XXXXXX"
                autoComplete="off"
                spellCheck={false}
                className="w-full flex-1 rounded-lg border border-gray-200 bg-white px-4 py-3 font-mono text-sm tracking-wide text-navy placeholder:font-sans placeholder:tracking-normal placeholder:text-gray-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
              />
              <button
                type="submit"
                disabled={state === "loading" || !id.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-6 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover disabled:opacity-50 sm:shrink-0"
              >
                {state === "loading" ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                {state === "loading" ? "Checking…" : "Check Registration"}
              </button>
            </div>
          </form>

          {/* Error */}
          {state === "error" && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3.5" role="alert">
              <AlertCircle size={17} className="mt-0.5 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-700">{error}</p>
                <p className="mt-1 text-xs text-red-600/80">
                  Your registration ID was shown after you registered and is in your payment confirmation (format: NA-YYYY-XXXXXX).
                </p>
              </div>
            </div>
          )}

          {/* Result */}
          {state === "found" && registration && (
            <div className="mt-8">
              <RegistrationDetails registration={registration} highlightReference />

              {unpaid && (
                <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-4">
                  <p className="text-sm text-amber-700">
                    We haven&apos;t confirmed this payment yet. Already paid on Chapa? Ask us to
                    check — otherwise you can start or restart the payment below.
                  </p>

                  <button
                    type="button"
                    onClick={checkPayment}
                    disabled={checking}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-60 sm:w-auto"
                  >
                    {checking ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                    {checking ? "Checking with Chapa…" : "I have paid — check my payment"}
                  </button>

                  {checkNote && (
                    <p className="mt-2.5 text-xs text-amber-700" role="status">
                      {checkNote}
                    </p>
                  )}

                  <div className="mt-3 border-t border-amber-200 pt-3">
                    <CheckoutButton referenceId={registration.referenceId} />
                  </div>
                </div>
              )}

              {checkNote && !unpaid && (
                <p className="mt-4 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
                  {checkNote}
                </p>
              )}

              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {registration.paymentStatus === "SUCCESS" && (
                  <>
                    <a
                      href={`/api/registrations/receipt?id=${encodeURIComponent(registration.referenceId)}`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-4 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover"
                    >
                      <Download size={15} /> Download Receipt
                    </a>
                    <a
                      href={`/api/registrations/lookup/ics?id=${encodeURIComponent(registration.referenceId)}`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy/15 bg-white px-4 py-3 text-sm font-semibold text-navy transition-colors hover:border-gold hover:bg-gold/5"
                    >
                      <CalendarPlus size={15} /> Add Schedule to Calendar
                    </a>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy/15 bg-white px-4 py-3 text-sm font-semibold text-navy transition-colors hover:border-gold hover:bg-gold/5"
                >
                  <Printer size={15} /> Print Confirmation
                </button>
              </div>
            </div>
          )}

          <p className="mt-10 text-center text-xs text-gray-400">
            Lost your registration ID? Contact us at info@nalikacademy.com or +251 911 223 344.
          </p>
        </div>
      </main>
    </div>
  );
}
