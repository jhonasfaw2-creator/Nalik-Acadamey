import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Payment status",
  robots: { index: false, follow: false },
};

export default function CheckoutReturnPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-warm-white px-4 py-12">
      <section className="w-full max-w-lg bg-white px-6 py-9 text-center sm:px-9">
        <a href="/" className="text-sm font-bold text-navy">Nalik Academy</a>
        <h1 className="mt-8 text-2xl font-bold text-navy sm:text-3xl">Online checkout has ended</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          New applications are paid by bank transfer or Telebirr. Submit your receipt with your application to complete enrollment.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-gray-600">
          If you completed an online payment before this change, contact the academy before paying again so we can help verify it.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/#contact" className="action-primary inline-flex items-center justify-center">
            Contact the academy
          </Link>
          <Link href="/registration" className="action-secondary inline-flex items-center justify-center">
            Check registration
          </Link>
        </div>
      </section>
    </main>
  );
}
