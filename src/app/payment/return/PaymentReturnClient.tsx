"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function PaymentReturnClient() {
  const [status, setStatus] = useState<"checking" | "success" | "failed">("checking");
  const searchParams = useSearchParams();
  const referenceId = searchParams.get("referenceId");

  useEffect(() => {
    if (!referenceId) {
      setStatus("failed");
      return;
    }

    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`/api/payments/verify?referenceId=${encodeURIComponent(referenceId)}`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "SUCCESS") setStatus("success");
        else setStatus("failed");
      } catch {
        if (cancelled) return;
        setStatus("failed");
      }
    };

    check();
    const id = setInterval(check, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [referenceId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-warm-white px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        {status === "checking" && (
          <>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
            <h1 className="text-lg font-bold text-navy">Confirming your payment</h1>
            <p className="mt-2 text-sm text-gray-500">Please wait while we verify your transaction…</p>
            {referenceId && <p className="mt-3 text-xs text-gray-400">Ref: {referenceId}</p>}
          </>
        )}
        {status === "success" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
              <span className="text-2xl">✅</span>
            </div>
            <h1 className="text-xl font-bold text-navy">Payment Successful</h1>
            <p className="mt-2 text-sm text-gray-500">Your registration is confirmed. You can close this window.</p>
            {referenceId && <p className="mt-3 text-xs text-gray-400">Ref: {referenceId}</p>}
          </>
        )}
        {status === "failed" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
              <span className="text-2xl">⚠️</span>
            </div>
            <h1 className="text-xl font-bold text-navy">Payment Not Completed</h1>
            <p className="mt-2 text-sm text-gray-500">We could not verify your payment. Please check your status from the main page.</p>
            {referenceId && <p className="mt-3 text-xs text-gray-400">Ref: {referenceId}</p>}
          </>
        )}
      </div>
    </div>
  );
}
