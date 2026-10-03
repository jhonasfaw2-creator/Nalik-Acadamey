import type { Metadata } from "next";
import { Suspense } from "react";
import PaymentCompleteClient from "./PaymentCompleteClient";

export const metadata: Metadata = {
  title: "Confirming Your Payment",
  robots: { index: false, follow: false },
};

export default function PaymentCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-warm-white px-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      }
    >
      <PaymentCompleteClient />
    </Suspense>
  );
}