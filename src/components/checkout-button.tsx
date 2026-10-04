"use client";

import { useState } from "react";
import { CreditCard, Loader2, AlertCircle } from "lucide-react";

// ── "Pay with Chapa" trigger ───────────────────────────────────────────
// Creates a hosted checkout session on the server and hands the browser to
// Chapa. The server reads the amount and customer details from the database,
// so nothing about the charge can be influenced from here.
//
// The redirect is a full page navigation on purpose: Chapa's hosted checkout
// owns the page until it returns the customer to /payment/complete.

interface CheckoutButtonProps {
  referenceId: string;
  label?: string;
  className?: string;
  /** Fired just before navigating away, for optimistic UI. */
  onRedirecting?: () => void;
}

export default function CheckoutButton({
  referenceId,
  label = "Pay with Chapa",
  className = "",
  onRedirecting,
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const startCheckout = async () => {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/payments/chapa/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceId: referenceId.trim().toUpperCase() }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.checkout_url) {
        // The server refuses an already-settled registration, so say so
        // plainly instead of "something went wrong".
        setError(
          data?.alreadyPaid
            ? "This registration is already paid."
            : data?.error || "We couldn't start the payment. Please try again."
        );
        setLoading(false);
        return;
      }

      // Persist the reference before navigating away. The Chapa dashboard
      // return URL may not carry query params, so /payment/complete reads
      // this as a fallback to identify which payment just completed.
      try {
        sessionStorage.setItem("chapa_pending_ref", referenceId.trim().toUpperCase());
      } catch {
        // sessionStorage unavailable (private browsing, etc.) — the URL
        // params from Chapa or the webhook will still settle the payment.
      }
      onRedirecting?.();
      window.location.href = data.checkout_url;
    } catch {
      setError("We couldn't reach the payment service. Please check your connection.");
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-6 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
        {loading ? "Redirecting to Chapa…" : label}
      </button>

      {error && (
        <p className="mt-2.5 flex items-start gap-1.5 text-xs text-red-600" role="alert">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}