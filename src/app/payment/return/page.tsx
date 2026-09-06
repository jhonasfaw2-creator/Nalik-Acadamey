import { Suspense } from "react";
import PaymentReturnClient from "./PaymentReturnClient";

export default function PaymentReturnPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-warm-white px-4"><div className="h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" /></div>}>
      <PaymentReturnClient />
    </Suspense>
  );
}
