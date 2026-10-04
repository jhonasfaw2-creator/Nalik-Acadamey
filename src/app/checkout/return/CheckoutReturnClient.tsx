"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Download, Loader2, ReceiptText } from "lucide-react";

interface PaymentDetails {
  studentName: string;
  course: string;
  courseId: string;
  amount: number;
  currency: string;
  tx_ref: string;
  referenceId: string;
  chapa_reference: string | null;
  payment_method: string | null;
  paidAt: string;
}

interface CourseMaterial {
  id: string;
  title: string;
  fileUrl: string;
  fileType: string;
}

type ReturnState =
  | { kind: "loading" }
  | { kind: "pending"; message: string }
  | { kind: "error"; message: string }
  | {
      kind: "success";
      payment: PaymentDetails;
      token: string;
      materials: CourseMaterial[];
      materialsError?: string;
    };

const fieldClass = "text-sm text-gray-500";

export default function CheckoutReturnClient({ txRef }: { txRef: string }) {
  const [state, setState] = useState<ReturnState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (!txRef) {
        setState({ kind: "error", message: "No transaction reference was provided." });
        return;
      }

      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 2_000));
          if (cancelled) return;
        }

        try {
          const response = await fetch(
            `/api/payments/verify?tx_ref=${encodeURIComponent(txRef)}`,
            { cache: "no-store" },
          );
          const data = await response.json();
          if (cancelled) return;

          if (!response.ok) {
            if (response.status >= 500 && attempt < 2) continue;
            setState({ kind: "error", message: data.error || "We couldn't verify this payment." });
            return;
          }

          if (data.status !== "SUCCESS") {
            if (attempt < 2) continue;
            setState({
              kind: "pending",
              message: "Your payment is not confirmed yet. Please wait a moment and refresh this page.",
            });
            return;
          }

          if (
            typeof data.downloadToken !== "string" ||
            typeof data.payment?.studentName !== "string" ||
            typeof data.payment?.courseId !== "string"
          ) {
            setState({ kind: "error", message: "The payment response was incomplete. Please contact support." });
            return;
          }

          let materials: CourseMaterial[] = [];
          let materialsError: string | undefined;
          try {
            const materialsResponse = await fetch(
              `/api/courses/${encodeURIComponent(data.payment.courseId)}/materials?token=${encodeURIComponent(data.downloadToken)}`,
              { cache: "no-store" },
            );
            if (!materialsResponse.ok) {
              throw new Error(`Materials request failed (${materialsResponse.status})`);
            }
            const materialsData = await materialsResponse.json();
            if (!Array.isArray(materialsData.materials)) {
              throw new Error("Invalid course materials response");
            }
            materials = materialsData.materials;
          } catch (error) {
            console.error("Could not load paid course materials", error);
            materialsError = "Payment is confirmed, but course materials could not be loaded. Refresh this page to try again.";
          }

          if (cancelled) return;
          setState({
            kind: "success",
            payment: data.payment as PaymentDetails,
            token: data.downloadToken,
            materials,
            materialsError,
          });
          return;
        } catch (error) {
          if (cancelled) return;
          if (attempt === 2) {
            console.error("Payment verification request failed", error);
            setState({
              kind: "error",
              message: "We couldn't reach the payment service. Please refresh this page to try again.",
            });
          }
        }
      }
    }

    void verify();
    return () => {
      cancelled = true;
    };
  }, [txRef]);

  const content = (() => {
    if (state.kind === "loading") {
      return (
        <div className="flex flex-col items-center py-16 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-gold" />
          <h1 className="mt-5 text-2xl font-bold text-navy">Confirming your payment</h1>
          <p className="mt-2 text-sm text-gray-500">We&apos;re securely checking the transaction with Chapa.</p>
        </div>
      );
    }

    if (state.kind === "error" || state.kind === "pending") {
      const pending = state.kind === "pending";
      return (
        <div className="flex flex-col items-center py-16 text-center">
          {pending ? <Loader2 className="h-10 w-10 animate-spin text-gold" /> : <AlertCircle className="h-10 w-10 text-red-500" />}
          <h1 className="mt-5 text-2xl font-bold text-navy">
            {pending ? "Payment confirmation pending" : "Payment could not be confirmed"}
          </h1>
          <p className="mt-2 max-w-lg text-sm text-gray-500">{state.message}</p>
          <p className="mt-4 font-mono text-xs text-gray-400">Transaction: {txRef || "Not provided"}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-gold px-5 py-3 text-sm font-bold text-navy hover:bg-gold-hover"
          >
            Check again
          </button>
        </div>
      );
    }

    const { payment, token, materials } = state;
    const tokenQuery = `token=${encodeURIComponent(token)}`;
    return (
      <div className="py-10 sm:py-14">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          </div>
          <h1 className="mt-5 text-3xl font-bold text-navy">Payment Confirmed</h1>
          <p className="mt-2 text-sm text-gray-500">You&apos;re enrolled in {payment.course}.</p>
        </div>

        <dl className="mx-auto mt-8 max-w-xl divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white px-5">
          <div className="flex justify-between gap-4 py-3"><dt className={fieldClass}>Student</dt><dd className="text-right text-sm font-semibold text-navy">{payment.studentName}</dd></div>
          <div className="flex justify-between gap-4 py-3"><dt className={fieldClass}>Course</dt><dd className="text-right text-sm font-semibold text-navy">{payment.course}</dd></div>
          <div className="flex justify-between gap-4 py-3"><dt className={fieldClass}>Amount paid</dt><dd className="text-right text-sm font-semibold text-navy">{payment.amount.toLocaleString()} {payment.currency}</dd></div>
          <div className="flex justify-between gap-4 py-3"><dt className={fieldClass}>Transaction reference</dt><dd className="break-all text-right font-mono text-sm font-semibold text-navy">{payment.tx_ref}</dd></div>
          <div className="flex justify-between gap-4 py-3"><dt className={fieldClass}>Registration ID</dt><dd className="text-right font-mono text-sm font-semibold text-navy">{payment.referenceId}</dd></div>
        </dl>

        <section className="mx-auto mt-8 max-w-xl">
          <h2 className="text-lg font-bold text-navy">Your downloads</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <a
              href={`/api/registrations/receipt?${tokenQuery}`}
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-center text-sm font-bold text-navy hover:bg-gold-hover"
            >
              <ReceiptText size={18} /> Download payment receipt
            </a>
            {state.materialsError ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {state.materialsError}
              </p>
            ) : materials.length === 0 ? (
              <div className="flex min-h-14 items-center justify-center rounded-xl border border-gray-200 px-4 py-3 text-center text-sm text-gray-500">
                Course materials will appear here when available.
              </div>
            ) : materials.map((material) => (
              <a
                key={material.id}
                href={material.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-navy/15 px-4 py-3 text-center text-sm font-semibold text-navy transition-colors hover:border-gold hover:bg-gold/5"
              >
                <Download size={18} /> {material.title}
              </a>
            ))}
          </div>
        </section>
      </div>
    );
  })();

  return (
    <main className="min-h-screen bg-[#f9faf8] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white px-5 shadow-sm ring-1 ring-black/5 sm:px-10">
        <div className="border-b border-gray-100 py-5 text-center text-sm font-semibold tracking-wide text-navy">
          Nalik Academy
        </div>
        {content}
      </div>
    </main>
  );
}
