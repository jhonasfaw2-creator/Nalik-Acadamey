"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = "checking" | "success" | "failed" | "cancelled";

export default function PaymentReturnClient() {
  const [status, setStatus] = useState<Status>("checking");
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

        {status === "success" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
              <span className="text-2xl">✅</span>
            </div>
            <h1 className="text-xl font-bold text-navy">Payment Successful</h1>
            <p className="mt-2 text-sm text-gray-500">Your registration is confirmed. Welcome to Nalik Academy!</p>
            {referenceId && <p className="mt-3 text-xs text-gray-400">Ref: {referenceId}</p>}
            <a href="/" className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy transition-colors hover:bg-gold-hover">
              Back to Home
            </a>
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
            <a href="/" className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy transition-colors hover:bg-gold-hover">
              Back to Home
            </a>
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
            <a href="/" className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy transition-colors hover:bg-gold-hover">
              Back to Home
            </a>
          </>
        )}
      </div>
    </div>
  );
}
