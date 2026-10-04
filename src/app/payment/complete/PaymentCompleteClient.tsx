"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Download,
  LayoutDashboard,
  BookOpen,
  FileText,
} from "lucide-react";
import RegistrationDetails from "@/components/RegistrationDetails";
import CheckoutButton from "@/components/checkout-button";
import {
  formatDate,
  type RegistrationSummary,
} from "@/lib/registration";

type Phase = "verifying" | "success" | "failed" | "invalid";

const POLL_INTERVAL_MS = 2_000;
const MAX_ATTEMPTS = 8;

interface ReceiptRefs {
  merchantReference: string | null;
  chapaReference: string | null;
}

interface CourseMaterial {
  id: string;
  title: string;
  fileUrl: string;
  fileType: string;
}

function formatBirr(amount: number | null, currency: string | null): string {
  if (amount == null) return "—";
  const code = currency || "ETB";
  return `${amount.toLocaleString("en-ET")} ${code}`;
}

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
  const router = useRouter();

  const firstParam = (...names: string[]): string => {
    for (const name of names) {
      const value = searchParams.get(name)?.trim();
      if (value) return value;
    }
    return "";
  };

  const referenceId = firstParam("referenceId").toUpperCase();
  const merchantReference = firstParam("tx_ref", "trxref", "trx_ref", "merchant_reference");
  const chapaReference = firstParam("chapa_reference", "reference", "ref_id");

  const storedRef = (() => {
    try { return sessionStorage.getItem("chapa_pending_ref") ?? ""; }
    catch { return ""; }
  })();

  const effectiveReferenceId = referenceId || (storedRef && !merchantReference && !chapaReference ? storedRef : "");
  const displayReference = effectiveReferenceId || merchantReference.toUpperCase() || storedRef;

  const [phase, setPhase] = useState<Phase>("verifying");
  const [registration, setRegistration] = useState<RegistrationSummary | null>(null);
  const [refs, setRefs] = useState<ReceiptRefs>({ merchantReference: null, chapaReference: null });
  const [detailError, setDetailError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [courseMaterials, setCourseMaterials] = useState<CourseMaterial[]>([]);

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

        if (reg.courseMaterials && reg.courseMaterials.length > 0) {
          setCourseMaterials(reg.courseMaterials);
        }
      } catch {
        setDetailError("Payment confirmed, but we couldn't load your registration details.");
      }
    },
    []
  );

  const loadCourseMaterials = useCallback(
    async (courseId: string) => {
      try {
        const res = await fetch(`/api/courses/${courseId}/materials`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (data?.materials) {
          setCourseMaterials(data.materials);
        }
      } catch {
        console.error("Failed to load course materials");
      }
    },
    []
  );

  const verifyPayment = useCallback(async () => {
    const verifyQuery = new URLSearchParams();
    if (effectiveReferenceId) verifyQuery.set("referenceId", effectiveReferenceId);
    if (merchantReference) verifyQuery.set("merchantReference", merchantReference);
    if (chapaReference) verifyQuery.set("chapaReference", chapaReference);

    if (!verifyQuery.toString()) {
      return null;
    }

    try {
      const res = await fetch(`/api/payments/verify?${verifyQuery.toString()}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      return data;
    } catch {
      return null;
    }
  }, [effectiveReferenceId, merchantReference, chapaReference]);

  useEffect(() => {
    const verifyQuery = new URLSearchParams();
    if (effectiveReferenceId) verifyQuery.set("referenceId", effectiveReferenceId);
    if (merchantReference) verifyQuery.set("merchantReference", merchantReference);
    if (chapaReference) verifyQuery.set("chapaReference", chapaReference);

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;

    setPhase("verifying");
    setAttempt(1);

    const finish = (next: Phase, fromVerify?: Record<string, unknown>) => {
      if (cancelled) return;
      setPhase(next);
      if (next === "success" || next === "failed") {
        try { sessionStorage.removeItem("chapa_pending_ref"); } catch { /* ignore */ }
        const resolvedId =
          typeof fromVerify?.referenceId === "string" && fromVerify.referenceId
            ? fromVerify.referenceId
            : displayReference;
        void loadReceipt(resolvedId, {
          merchantReference:
            typeof fromVerify?.merchantReference === "string"
              ? fromVerify.merchantReference
              : displayReference,
          chapaReference:
            typeof fromVerify?.chapaReference === "string" ? fromVerify.chapaReference : null,
        });
        if (fromVerify?.courseId && !courseMaterials.length) {
          void loadCourseMaterials(fromVerify.courseId as string);
        }
      }
    };

    const scheduleNext = () => {
      if (cancelled) return;
      tries += 1;
      if (tries >= MAX_ATTEMPTS) {
        setPhase("failed");
        return;
      }
      setAttempt(tries + 1);
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    const poll = async () => {
      if (cancelled) return;

      try {
        const hasParams = verifyQuery.toString().length > 0;
        const url = hasParams
          ? `/api/payments/verify?${verifyQuery.toString()}`
          : `/api/payments/status`;

        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (cancelled) return;

        const reg = (data?.registration ?? {}) as Record<string, unknown>;
        const statusReg = !hasParams ? data as Record<string, unknown> : reg;
        const status = typeof data?.status === "string" ? data.status.toUpperCase() : "";

        if (status === "SUCCESS") {
          finish("success", { ...reg, ...statusReg, courseId: data.courseId });
          return;
        }
        if (status === "FAILED" || status === "CANCELLED" || status === "INCOMPLETE") {
          finish("failed", { ...reg, ...statusReg });
          return;
        }

        if (!hasParams && status === "UNKNOWN") {
          const reason = typeof data?.reason === "string" ? data.reason : "";
          if (reason === "no_cookie" || reason === "not_found") {
            finish("invalid");
            return;
          }
        }

        scheduleNext();
      } catch {
        scheduleNext();
      }
    };

    const runInitialVerification = async () => {
      const data = await verifyPayment();
      if (cancelled) return;

      if (data) {
        const status = typeof data.status === "string" ? data.status.toUpperCase() : "";
        const reg = (data.registration ?? {}) as Record<string, unknown>;
        const statusReg = data as Record<string, unknown>;

        if (status === "SUCCESS") {
          finish("success", { ...reg, ...statusReg, courseId: data.courseId });
          return;
        }
        if (status === "FAILED" || status === "CANCELLED" || status === "INCOMPLETE") {
          finish("failed", { ...reg, ...statusReg });
          return;
        }
      }

      scheduleNext();
    };

    void runInitialVerification();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    effectiveReferenceId,
    merchantReference,
    chapaReference,
    loadReceipt,
    loadCourseMaterials,
    courseMaterials.length,
    verifyPayment,
    displayReference,
  ]);

  const downloadId = registration?.referenceId || displayReference;

  const receiptRows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Amount paid", value: formatBirr(registration?.amount ?? null, registration?.currency ?? null) },
    { label: "Transaction reference", value: refs.chapaReference || "—", mono: true },
    { label: "Merchant reference", value: refs.merchantReference || displayReference, mono: true },
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

          {phase === "verifying" && (
            <div className="mt-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
                <Loader2 size={30} className="animate-spin text-gold" />
              </div>
              <h1 className="mt-5 text-2xl font-bold text-navy">Verifying your payment</h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Confirming the transaction with Chapa. This usually takes a few seconds.
              </p>
              <p className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500">
                You can close this tab — we also confirm payments by webhook, so your seat is held either way.
              </p>
              <p className="mt-3 font-mono text-[11px] text-gray-400">
                {effectiveReferenceId || displayReference} · check {attempt} of {MAX_ATTEMPTS}
              </p>
            </div>
          )}

          {phase === "success" && (
            <div className="mt-10">
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                  <CheckCircle2 size={34} className="text-green-500" />
                </div>
                <h1 className="mt-5 text-2xl font-bold text-navy">Payment Confirmed</h1>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  Your seat is confirmed. Welcome to Nalik Academy!
                </p>
              </div>

              <div className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
                {receiptRows.map((row) => (
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
                <a
                  href={`/api/registrations/receipt?id=${encodeURIComponent(downloadId)}`}
                  download={`nalik-receipt-${downloadId}.pdf`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-4 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover"
                >
                  <FileText size={15} /> Download Payment Slip
                </a>
                <a
                  href={`/registration?id=${encodeURIComponent(displayReference)}`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy/15 bg-white px-4 py-3 text-sm font-semibold text-navy transition-colors hover:border-gold hover:bg-gold/5"
                >
                  <LayoutDashboard size={15} /> Go to Dashboard
                </a>
              </div>

              {courseMaterials.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-navy mb-3 flex items-center gap-2">
                    <BookOpen size={16} /> Course Materials
                  </h3>
                  <div className="space-y-2">
                    {courseMaterials.map((material) => (
                      <a
                        key={material.id}
                        href={material.fileUrl}
                        download
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy/15 bg-white px-4 py-3 text-sm font-semibold text-navy transition-colors hover:border-gold hover:bg-gold/5"
                      >
                        <Download size={15} />
                        {material.title} ({material.fileType})
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {registration?.course && courseMaterials.length === 0 && (
                <div className="mt-6">
                  <p className="text-sm text-gray-500 text-center">
                    Course materials will appear here once uploaded by your instructor.
                  </p>
                </div>
              )}
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
                <p className="mt-0.5 font-mono text-sm font-bold text-gold">{displayReference}</p>
              </div>

              <div className="mx-auto mt-5 max-w-sm">
                <CheckoutButton referenceId={displayReference} label="Retry Payment" />
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