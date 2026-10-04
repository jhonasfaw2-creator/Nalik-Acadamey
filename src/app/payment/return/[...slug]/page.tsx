import { Suspense } from "react";
import PaymentCompleteClient from "@/app/payment/complete/PaymentCompleteClient";

// Catch-all return handler: Chapa's dashboard Redirect URL (and any legacy
// path such as /payment/return/chapa/init) may point anywhere under
// /payment/return. Rather than 404 and strand a student right after they paid,
// every such path renders the single canonical confirmation flow. The client
// identifies the payment from Chapa's query params, the sessionStorage fallback
// written before checkout, or the na_pending_ref cookie, then verifies it
// server-side.

export const metadata = {
  title: "Payment Confirmation",
  robots: { index: false, follow: false },
};

export default function PaymentReturnCatchAll() {
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
