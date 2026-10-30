"use client";

import { usePathname } from "next/navigation";
import { ApplicationFormProvider } from "@/components/ApplicationFormProvider";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { ReactNode } from "react";

export function ClientShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The admin area has its own layout; hide the public site chrome there.
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <ApplicationFormProvider>
      {!isAdmin && <Navbar />}
      {children}
      {!isAdmin && <Footer />}
    </ApplicationFormProvider>
  );
}
