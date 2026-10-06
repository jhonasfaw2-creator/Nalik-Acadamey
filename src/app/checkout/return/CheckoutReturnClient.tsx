"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

interface PaymentResult {
  paymentStatus: string;
  registrationStatus: string;
  referenceId: string;
}

export default function CheckoutReturnClient() {
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const verify = useCallback(async () => {
    setChecking(true);
    setError("");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const response = await fetch("/api/payments/verify", {
          method: "POST",
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Payment verification is unavailable.");
        if (
          typeof data.paymentStatus !== "string" ||
          typeof data.registrationStatus !== "string" ||
          typeof data.referenceId !== "string"
        ) {
          throw new Error("The payment status response was invalid.");
        }
        const nextResult: PaymentResult = data;
        setResult(nextResult);
        if (nextResult.paymentStatus !== "PENDING") break;
        if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (verifyError) {
        setError(
          verifyError instanceof Error
            ? verifyError.message
            : "Payment verification is temporarily unavailable.",
        );
        break;
      }
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    void verify();
  }, [verify]);

  const confirmed =
    result?.paymentStatus === "SUCCESS" && result.registrationStatus === "CONFIRMED";
  const terminalFailure =
    result &&
    ["FAILED", "CANCELLED", "INCOMPLETE", "BLOCKED", "INVALID"].includes(result.paymentStatus);
  const canRetry =
    result &&
    ["FAILED", "CANCELLED", "INCOMPLETE"].includes(result.paymentStatus);

  const retryPayment = async () => {
    setRetrying(true);
    setError("");
    try {
      const retryResponse = await fetch("/api/payments/retry", { method: "POST" });
      const retryData = await retryResponse.json().catch(() => ({}));
      if (!retryResponse.ok || typeof retryData.paymentId !== "string") {
        throw new Error(retryData.error || "A new payment attempt could not be prepared.");
      }

      const initializeResponse = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: retryData.paymentId }),
      });
      const initializeData = await initializeResponse.json().catch(() => ({}));
      if (!initializeResponse.ok || typeof initializeData.checkoutUrl !== "string") {
        throw new Error(initializeData.error || "Checkout could not start. Please try again.");
      }
      window.location.assign(initializeData.checkoutUrl);
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : "A new payment attempt could not be started.",
      );
    } finally {
      setRetrying(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-warm-white px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm sm:p-9">
        <a href="/" className="text-sm font-bold text-navy">Nalik Academy</a>
        {checking ? (
          <>
            <Loader2 size={34} className="mx-auto mt-8 animate-spin text-gold" />
            <h1 className="mt-5 text-2xl font-bold text-navy">Verifying your payment</h1>
            <p className="mt-2 text-sm text-gray-600">
              We are checking the transaction directly with Chapa. Please keep this page open.
            </p>
          </>
        ) : confirmed ? (
          <>
            <CheckCircle2 size={38} className="mx-auto mt-8 text-green-600" />
            <h1 className="mt-5 text-2xl font-bold text-navy">Enrollment confirmed</h1>
            <p className="mt-2 text-sm text-gray-600">
              Chapa verified your payment and your registration is confirmed.
            </p>
            <p className="mx-auto mt-5 w-fit rounded-xl bg-warm-white px-5 py-3 font-mono font-bold text-navy">
              {result.referenceId}
            </p>
            <a
              href={`/registration?id=${encodeURIComponent(result.referenceId)}`}
              className="mt-6 inline-flex rounded-xl bg-gold px-5 py-3 text-sm font-bold text-navy hover:bg-gold-hover"
            >
              View confirmation and course materials
            </a>
          </>
        ) : terminalFailure ? (
          <>
            <AlertCircle size={36} className="mx-auto mt-8 text-red-500" />
            <h1 className="mt-5 text-2xl font-bold text-navy">Payment not completed</h1>
            <p className="mt-2 text-sm text-gray-600">
              Chapa reported this payment as {result.paymentStatus.toLowerCase()}. No enrollment confirmation or downloads are available.
            </p>
          </>
        ) : (
          <>
            <AlertCircle size={36} className="mx-auto mt-8 text-amber-500" />
            <h1 className="mt-5 text-2xl font-bold text-navy">Payment is being confirmed</h1>
            <p className="mt-2 text-sm text-gray-600">
              We have not yet received server-side confirmation from Chapa. Your registration remains pending; check again shortly.
            </p>
            {result?.referenceId && (
              <p className="mx-auto mt-5 w-fit rounded-xl bg-warm-white px-5 py-3 font-mono font-bold text-navy">
                {result.referenceId}
              </p>
            )}
          </>
        )}

        {error && (
          <p className="mt-5 text-sm text-red-600" role="alert">{error}</p>
        )}
        {!checking && !confirmed && (
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void verify()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-navy hover:bg-gray-50"
            >
              <RefreshCw size={15} /> Check payment status
            </button>
            {canRetry && (
              <button
                type="button"
                disabled={retrying}
                onClick={() => void retryPayment()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-navy hover:bg-gold-hover disabled:opacity-60"
              >
                {retrying ? <Loader2 size={15} className="animate-spin" /> : null}
                {retrying ? "Preparing checkout..." : "Try payment again"}
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
