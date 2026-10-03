"use client";

// ── Payment confirmation (/payment/complete) ──────────────────────────
// Chapa redirects the student back here after hosted checkout. The redirect is
// only a signal, so this page asks the server — which verifies with Chapa — and
// shows a receipt once the payment is confirmed.
//
// Polling is a convenience, not the source of truth: the webhook confirms the
// payment independently. That is why running out of attempts ends in "still
// being processed" rather than "failed", and why that state promises the
// status will update on its own.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Clock3,
  Loader2,
  AlertCircle,
  Download,
  LayoutDashboard,
} from "lucide-react";
import RegistrationDetails from "@/components/RegistrationDetails";
import CheckoutButton from "@/components/checkout-button";
import {
  formatDate,
  formatTime,
  looksLikeReferenceId,
  type RegistrationSummary,
} from "@/lib/registration";

type Phase = "invalid" | "checking" | "success" | "failed" | "pending";

const POLL_INTERVAL_MS = 3_000;
const MAX_ATTEMPTS = 5;

/**
 * After the burst, the page keeps checking slowly in the background so the
 * "it will update automatically" promise is real: a payment the webhook
 * confirms a minute later flips this page to the receipt on its own.
 */
const WATCH_INTERVAL_MS = 10_000;
const WATCH_TIMEOUT_MS = 5 * 60_000;

/** Fields the receipt needs that RegistrationSummary does not carry. */
interface ReceiptRefs {
  merchantReference: string | null;
  chapaReference: string | null;
}

function formatBirr(amount: number | null, currency: string | null): string {
  if (amount == null) return "—";
  const code = currency || "ETB";
  return `${amount.toLocaleString("en-ET")} ${code}`;
}

/** "2 Oct 2026, 5:04 PM" for the paid-at stamp. */
function formatStamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${formatDate(iso)}, ${d.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export default function PaymentCompleteClient() {
  const searchParams = useSearchParams();
  const referenceId = (searchParams.get("referenceId") || "").trim().toUpperCase();

  const [phase, setPhase] = useState<Phase>("checking");
  const [registration, setRegistration] = useState<RegistrationSummary | null>(null);
  const [refs, setRefs] = useState<ReceiptRefs>({ merchantReference: null, chapaReference: null });
  const [detailError, setDetailError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [retryKey, setRetryKey] = useState(0);

  /** Loads the full summary so the receipt card has name, days and start date. */
  const loadReceipt = useCallback(
    async (id: string, extra: ReceiptRefs) => {
      setRefs({
        merchantReference: extra.merchantReference,
        chapaReference: extra.chapaReference,
      });
      try {
        const res = await fetch(`/api/registrations/lookup?id=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (!data?.found || !data.registration) {
          setDetailError("Payment confirmed, but we couldn't load your registration details.");
          return;
        }
        const reg = data.registration;
        setRegistration({
          referenceId: reg.referenceId,
          fullName: reg.fullName,
          course: reg.course,
          scheduleDays: reg.schedule?.days ?? null,
          scheduleSession: reg.schedule
            ? { group: reg.schedule.group, label: reg.schedule.session }
            : null,
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
        setDetailError("Payment confirmed, but we couldn't load your registration details.");
      }
    },
    []
  );

  useEffect(() => {
    if (!looksLikeReferenceId(referenceId)) {
      setPhase("invalid");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    let watching = false;
    const watchStartedAt = { value: 0 };

    setPhase("checking");
    setAttempt(1);

    const finish = (next: Phase, fromVerify?: Record<string, unknown>) => {
      if (cancelled) return;
      watching = false;
      setPhase(next);
      if (next === "success" || next === "failed") {
        void loadReceipt(referenceId, {
          merchantReference:
            typeof fromVerify?.merchantReference === "string"
              ? fromVerify.merchantReference
              : referenceId,
          chapaReference:
            typeof fromVerify?.chapaReference === "string" ? fromVerify.chapaReference : null,
        });
      }
    };

    /** Burst of 5 quick checks, then a slow background watch. */
    const scheduleNext = () => {
      if (cancelled) return;

      if (!watching) {
        tries += 1;
        if (tries >= MAX_ATTEMPTS) {
          watching = true;
          watchStartedAt.value = Date.now();
          setPhase("pending");
          timer = setTimeout(poll, WATCH_INTERVAL_MS);
          return;
        }
        setAttempt(tries + 1);
        timer = setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }

      // Watching: keep going until the grace period expires, then stop quietly
      // and leave the page on "being processed" rather than flipping to failed.
      if (Date.now() - watchStartedAt.value >= WATCH_TIMEOUT_MS) return;
      timer = setTimeout(poll, WATCH_INTERVAL_MS);
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

        const reg = (data?.registration ?? {}) as Record<string, unknown>;
        const status = typeof data?.status === "string" ? data.status.toUpperCase() : "";

        if (status === "SUCCESS") {
          finish("success", reg);
          return;
        }
        if (status === "FAILED" || status === "CANCELLED" || status === "INCOMPLETE") {
          finish("failed", reg);
          return;
        }

        // PENDING, a rate limit, a transient provider fault, or a response with
        // no status at all (e.g. a server misconfiguration). Never treat any of
        // those as a failed payment.
        scheduleNext();
      } catch {
        scheduleNext();
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [referenceId, retryKey, loadReceipt]);

  const retry = () => {
    setRegistration(null);
    setDetailError("");
    setAttempt(0);
    setRetryKey((k) => k + 1);
  };

  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Amount paid", value: formatBirr(registration?.amount ?? null, registration?.currency ?? null) },
    { label: "Transaction reference", value: refs.chapaReference || "—", mono: true },
    { label: "Merchant reference", value: refs.merchantReference || referenceId, mono: true },
    { label: "Confirmed on", value: formatStamp(registration?.paidAt ?? null) },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-warm-white">
      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md">
          <div className="text-center print:hidden">
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
                You can close this tab — we also confirm payments by webhook, so your seat is held
                either way.
              </p>
              <p className="mt-3 font-mono text-[11px] text-gray-400">
                {referenceId} · check {attempt} of {MAX_ATTEMPTS}
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

              {/* Receipt */}
              <div className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
                {rows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4 px-5 py-3.5">
                    <span className="shrink-0 text-sm text-gray-500">{row.label}</span>
                    <span
                      className={`text-right text-sm font-medium text-navy ${row.mono ? "font-mono text-xs" : ""}`}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {registration && (
                <div className="mt-3">
                  <RegistrationDetails registration={registration} highlightReference />
                </div>
              )}

              {detailError && (
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  {detailError}
                </p>
              )}

              <div className="mt-5 grid grid-cols-1 gap-2.5 print:hidden sm:grid-cols-2">
                {/* Opens the browser print dialog, where "Save as PDF" produces
                    a copyable receipt file. */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-4 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover"
                >
                  <Download size={15} /> Download Receipt
                </button>
                <a
                  href={`/registration?id=${encodeURIComponent(referenceId)}`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy/15 bg-white px-4 py-3 text-sm font-semibold text-navy transition-colors hover:border-gold hover:bg-gold/5"
                >
                  <LayoutDashboard size={15} /> Go to Dashboard
                </a>
              </div>
            </div>
          )}

          {phase === "failed" && (
            <div className="mt-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                <XCircle size={32} className="text-red-500" />
              </div>
              <h1 className="mt-5 text-2xl font-bold text-navy">Payment Not Completed</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-600">
                Chapa did not complete this payment, so no charge was made. Your registration is
                still saved.
              </p>

              <div className="mx-auto mt-4 max-w-sm rounded-xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Registration ID
                </p>
                <p className="mt-0.5 font-mono text-sm font-bold text-gold">{referenceId}</p>
              </div>

              <div className="mx-auto mt-5 max-w-sm">
                <CheckoutButton referenceId={referenceId} label="Retry Payment" />
              </div>

              <button
                type="button"
                onClick={retry}
                className="mt-5 text-sm font-medium text-gray-500 underline underline-offset-2 transition-colors hover:text-gold"
              >
                Check again
              </button>
            </div>
          )}

          {phase === "pending" && (
            <div className="mt-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                <Clock3 size={32} className="text-amber-500" />
              </div>
              <h1 className="mt-5 text-2xl font-bold text-navy">Payment Being Processed</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-600">
                Chapa is still confirming this payment. Your registration is saved and your seat is
                held — this page will update automatically once the payment is confirmed, so there
                is nothing you need to do.
              </p>

              <div className="mx-auto mt-5 max-w-sm rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-amber-700">
                  <Loader2 size={12} className="animate-spin" />
                  Still checking in the background — no action needed.
                </span>
              </div>

              <div className="mx-auto mt-4 max-w-sm rounded-xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Registration ID
                </p>
                <p className="mt-0.5 font-mono text-sm font-bold text-gold">{referenceId}</p>
              </div>

              <div className="mx-auto mt-5 max-w-sm print:hidden">
                <CheckoutButton referenceId={referenceId} label="Pay again" />
              </div>

              <div className="mt-5 flex flex-col items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={retry}
                  className="inline-flex items-center gap-2 rounded-lg border border-navy/15 bg-white px-6 py-3 text-sm font-semibold text-navy transition-colors hover:border-gold hover:bg-gold/5"
                >
                  <Loader2 size={15} /> Check again
                </button>
                <a
                  href={`/registration?id=${encodeURIComponent(referenceId)}`}
                  className="text-sm text-gray-500 underline underline-offset-2 transition-colors hover:text-gold"
                >
                  View your registration
                </a>
              </div>
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