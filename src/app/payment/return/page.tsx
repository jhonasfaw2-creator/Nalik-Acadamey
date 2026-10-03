import { Suspense } from "react";
import PaymentCompleteClient from "@/app/payment/complete/PaymentCompleteClient";

// Compatibility shim: the Chapa dashboard's return_url points here. Render the
// canonical v2 confirmation page so there is a single return flow. Chapa's own
// redirect parameters are preserved in the URL and read by the client.

export const metadata = {
  title: "Payment Confirmation",
  robots: { index: false, follow: false },
};

export default function PaymentReturnPage() {
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
