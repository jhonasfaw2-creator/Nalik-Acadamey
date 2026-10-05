"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ReturnContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const txRef = searchParams.get("tx_ref") || searchParams.get("merchant_reference");

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"SUCCESS" | "PENDING" | "FAILED">("PENDING");

  useEffect(() => {
    if (!txRef) {
      setLoading(false);
      return;
    }

    async function verifyPayment() {
      try {
        const res = await fetch(`/api/payments/verify?tx_ref=${encodeURIComponent(txRef)}`);
        const data = await res.json();

        if (data.status === "SUCCESS") {
          setStatus("SUCCESS");
        } else {
          setStatus("PENDING");
        }
      } catch (err) {
        console.error("Error verifying payment on return:", err);
        setStatus("PENDING");
      } finally {
        setLoading(false);
      }
    }

    verifyPayment();
  }, [txRef]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-6">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent mb-4" />
        <h2 className="text-xl font-semibold">Verifying your payment...</h2>
        <p className="text-muted-foreground mt-2">Please wait while we confirm your transaction.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-6">
      {status === "SUCCESS" ? (
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-md border border-emerald-100">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Successful!</h1>
          <p className="text-gray-600 mt-2">Your registration has been confirmed.</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-6 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-white font-medium hover:bg-emerald-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      ) : (
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-md border border-amber-100">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-4">
            !
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Processing</h1>
          <p className="text-gray-600 mt-2">
            We are waiting for confirmation from Chapa. Your status will update shortly.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full rounded-lg bg-amber-600 px-4 py-2.5 text-white font-medium hover:bg-amber-700 transition-colors"
          >
            Refresh Status
          </button>
        </div>
      )}
    </div>
  );
}

export default function ReturnPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Loading...</div>}>
      <ReturnContent />
    </Suspense>
  );
}