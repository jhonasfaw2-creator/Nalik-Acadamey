import type { Metadata } from "next";
import { Suspense } from "react";
import RegistrationLookupClient from "./RegistrationLookupClient";

export const metadata: Metadata = {
  title: "Check Your Registration",
  description:
    "Enter your Nalik Academy registration ID to view your enrollment status and class schedule.",
  alternates: { canonical: "/registration" },
};

export default function RegistrationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-warm-white px-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      }
    >
      <RegistrationLookupClient />
    </Suspense>
  );
}
