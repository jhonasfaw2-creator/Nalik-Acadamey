import type { Metadata } from "next";
import CheckoutReturnClient from "./CheckoutReturnClient";

export const metadata: Metadata = {
  title: "Payment status",
  robots: { index: false, follow: false },
};

export default function CheckoutReturnPage() {
  return <CheckoutReturnClient />;
}
