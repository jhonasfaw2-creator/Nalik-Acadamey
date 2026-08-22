"use client";

import { useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { ModalDrawer } from "@/components/motion/ModalDrawer";
import { useApplicationModal } from "@/components/application/ApplicationContext";
import { SITE_NAME } from "@/lib/constants";

// Lazy-load the form so its JS is only fetched when the modal opens
const ApplicationForm = dynamic(
  () =>
    import("@/components/application/ApplicationForm").then(
      (m) => m.ApplicationForm
    ),
  { ssr: false }
);

export function ApplicationModal() {
  const { isOpen, closeModal } = useApplicationModal();
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const storeTrigger = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      triggerRef.current = document.activeElement;
    }
  }, []);

  // ── Body scroll lock when modal open ──────────
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const prevBody = document.body.style.cssText;
    const prevHtml = document.documentElement.style.cssText;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.cssText = prevBody;
      document.documentElement.style.cssText = prevHtml;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeModal]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const container = modalRef.current;
    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ");

    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
      );

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusable = getFocusable();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    // Focus first focusable element after a short delay to let the modal animate in
    const timer = setTimeout(() => {
      const focusable = getFocusable();
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    }, 100);

    window.addEventListener("keydown", handleTab);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleTab);
    };
  }, [isOpen]);

  // Return focus on close
  useEffect(() => {
    if (!isOpen && triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <ModalDrawer isOpen={isOpen} onClose={closeModal} direction="center">
          <div
            ref={modalRef}
            className="flex max-h-[85dvh] flex-col sm:max-h-[80vh]"
            onMouseDown={storeTrigger}
          >
            {/* ── Header ─────────────────────────── */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-navy/10 bg-white px-4 py-3 sm:px-6 sm:py-4">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-navy sm:text-lg">
                  Apply to {SITE_NAME}
                </h2>
                <p className="mt-0.5 text-[11px] text-navy/50 sm:text-xs">
                  Fill out the form below and we&apos;ll be in touch.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded text-navy/40 transition-colors hover:bg-navy/5 hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                aria-label="Close application form"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* ── Form body (scrollable) ─────────── */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <ApplicationForm onSuccess={closeModal} />
            </div>
          </div>
        </ModalDrawer>
      )}
    </AnimatePresence>
  );
}
