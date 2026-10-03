"use client";

// ── Payment return / confirmation (/payment/complete) ─────────────────
// Chapa redirects the student back here after hosted checkout. The redirect is
// only a signal, so this page polls the server until it has verified the
// payment with Chapa, then shows the receipt.
//
// Polling is a convenience, not the source of truth: the webhook confirms the
// payment independently, so closing this tab never loses a payment. That is why
// a timeout ends in "still processing" rather than "failed".

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Clock3,
  Loader2,
  AlertCircle,
  CalendarPlus,
  Printer,
} from "lucide-react";
import RegistrationDetails from "@/components/RegistrationDetails";
import CheckoutButton from "@/components/checkout-button";
import { looksLikeReferenceId, type RegistrationSummary } from "@/lib/registration";

type Phase = "invalid" | "checking" | "success" | "cancelled" | "failed" | "timeout";

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 120_000;

function formatBirr(amount: number | null): string {
  return amount == null ? "—" : amount.toLocaleString("en-ET") + " Birr";
}

export default function PaymentCompleteClient() {
  const searchParams = useSearchParams();
  const referenceId = (searchParams.get("referenceId") || "").trim().toUpperCase();

  const [phase, setPhase] = useState<Phase>("checking");
  const [registration, setRegistration] = useState<RegistrationSummary | null>(null);
  const [detailError, setDetailError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const startedAt = useRef(0);

  /** Loads the full summary so the receipt card has name, days and start date. */
  const loadReceipt = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/registrations/lookup?id=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!data?.found || !data.registration) {
        setDetailError("Payment confirmed, but we couldn't load your details.");
        return;
      }
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
    } catch {
      setDetailError("Payment confirmed, but we couldn't load your details.");
    }
  }, []);

  useEffect(() => {
    if (!looksLikeReferenceId(referenceId)) {
      setPhase("invalid");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    startedAt.current = Date.now();
    setPhase("checking");

    const tick = () => {
      if (!cancelled) setElapsed(Math.round((Date.now() - startedAt.current) / 1000));
    };
    const ticker = setInterval(tick, 1000);

    const stop = (next: Phase) => {
      clearInterval(ticker);
      if (!cancelled) setPhase(next);
    };

    const settle = async (next: Phase) => {
      stop(next);
      await loadReceipt(referenceId);
    };

    const scheduleNextPoll = () => {
      if (cancelled) return;
      if (Date.now() - startedAt.current >= POLL_TIMEOUT_MS) {
        stop("timeout");
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(
          `/api/payments/verify?referenceId=${encodeURIComponent(referenceId)}`,
          { cache: "no-store" }
        );
        const data = await res.json().catch(() => null);
        if (cancelled) return;

        const status = typeof data?.status === "string" ? data.status.toUpperCase() : "";

        if (status === "SUCCESS") {
          await settle("success");
          return;
        }
        if (status === "CANCELLED") {
          await settle("cancelled");
          return;
        }
        if (status === "FAILED" || status === "INCOMPLETE") {
          await settle("failed");
          return;
        }
        // PENDING, a rate limit, or a transient provider fault: keep polling.
        // The server deliberately answers 200 + PENDING for all of these.
        scheduleNextPoll();
      } catch {
        if (!cancelled) scheduleNextPoll();
      }
    };

    void poll();

    return () => {
      cancelled = true;
      clearInterval(ticker);
      if (timer) clearTimeout(timer);
    };
  }, [referenceId, retryKey, loadReceipt]);

  const retry = () => {
    setRegistration(null);
    setDetailError("");
    setElapsed(0);
    setRetryKey((k) => k + 1);
  };

  return (
    <div className="flex min-h-screen flex-col bg-warm-white">
      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md">
          <div className="text-center">
            <a href="/" className="inline-flex items-center gap-2.5">
              <img src="/assets/logo.jpeg" alt="Nalik Academy" className="h-9 w-9 rounded-lg object-cover" />
              <span className="text-lg font-bold text-navy">Nalik Academy</span>
            </a>
          </div>

          {phase === "checking" && (
            <div className="mt-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
                <Loader2 size={30} className="animate-spin text-gold" />
              </div>
              <h1 className="mt-5 text-2xl font-bold text-navy">Confirming your payment</h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Hold on while we confirm the transaction with Chapa. This usually takes a few
                seconds.
              </p>
              <p className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500">
                You can close this tab — we confirm payments by webhook too, so your seat is held
                either way.
              </p>
              <p className="mt-3 font-mono text-[11px] text-gray-400">
                {referenceId} · {elapsed}s
              </p>
            </div>
          )}

          {phase === "success" && (
            <div className="mt-10">
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                  <CheckCircle2 size={34} className="text-green-500" />
                </div>
                <h1 className="mt-5 text-2xl font-bold text-navy">Payment Successful</h1>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  Your seat is confirmed. Welcome to Nalik Academy!
                </p>
              </div>

              {registration && (
                <>
                  <div className="mt-6 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-3.5">
                    <span className="text-sm text-gray-500">Amount paid</span>
                    <span className="text-lg font-bold text-gold">
                      {formatBirr(registration.amount)}
                    </span>
                  </div>
                  <div className="mt-3">
                    <RegistrationDetails registration={registration} highlightReference />
                  </div>
                </>
              )}

              {detailError && (
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  {detailError}
                </p>
              )}

              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <a
                  href={`/api/registrations/lookup/ics?id=${encodeURIComponent(referenceId)}`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy/15 bg-white px-4 py-3 text-sm font-semibold text-navy transition-colors hover:border-gold hover:bg-gold/5"
                >
                  <CalendarPlus size={15} /> Add to Calendar
                </a>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy/15 bg-white px-4 py-3 text-sm font-semibold text-navy transition-colors hover:border-gold hover:bg-gold/5"
                >
                  <Printer size={15} /> Print Receipt
                </button>
              </div>
            </div>
          )}

          {(phase === "failed" || phase === "cancelled") && (
            <div className="mt-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                {phase === "cancelled" ? (
                  <Clock3 size={32} className="text-amber-500" />
                ) : (
                  <XCircle size={32} className="text-red-500" />
                )}
              </div>
              <h1 className="mt-5 text-2xl font-bold text-navy">
                {phase === "cancelled" ? "Payment Cancelled" : "Payment Not Completed"}
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-600">
                {phase === "cancelled"
                  ? "You cancelled the payment, so no charge was made."
                  : "We couldn't confirm the payment. No charge has been taken by us."}
              </p>

              <div className="mx-auto mt-4 max-w-sm rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                  Registration ID
                </p>
                <p className="mt-0.5 font-mono text-sm font-bold text-gold">{referenceId}</p>
              </div>

              <div className="mx-auto mt-5 max-w-sm">
                <CheckoutButton referenceId={referenceId} label="Try paying again" />
              </div>

              {registration && (
                <div className="mt-6 text-left">
                  <RegistrationDetails registration={registration} />
                </div>
              )}

              <button
                type="button"
                onClick={retry}
                className="mt-5 text-sm font-medium text-gray-500 underline underline-offset-2 transition-colors hover:text-gold"
              >
                Check again
              </button>
            </div>
          )}

          {phase === "timeout" && (
            <div className="mt-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                <Clock3 size={32} className="text-amber-500" />
              </div>
              <h1 className="mt-5 text-2xl font-bold text-navy">Still Confirming</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-600">
                This is taking longer than usual. Your registration is saved and Chapa notifies us
                directly, so your seat is held even if you close this page.
              </p>
              <div className="mx-auto mt-4 max-w-sm rounded-xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Registration ID
                </p>
                <p className="mt-0.5 font-mono text-sm font-bold text-gold">{referenceId}</p>
              </div>
              <button
                type="button"
                onClick={retry}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gold px-6 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover"
              >
                <Loader2 size={15} /> Check again
              </button>
              <p className="mt-4 text-sm text-gray-500">
                You can also{" "}
                <a
                  href={`/registration?id=${encodeURIComponent(referenceId)}`}
                  className="font-semibold text-gold underline underline-offset-2"
                >
                  look up your registration
                </a>{" "}
                at any time.
              </p>
            </div>
          )}

          {phase === "invalid" && (
            <div className="mt-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                <AlertCircle size={32} className="text-red-500" />
              </div>
              <h1 className="mt-5 text-2xl font-bold text-navy">Missing Registration ID</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-600">
                This confirmation link is incomplete. Open it from the link Chapa sent you, or look
                up your registration with your ID.
              </p>
              <a
                href="/registration"
                className="mt-5 inline-block rounded-lg bg-gold px-6 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover"
              >
                Look up my registration
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}