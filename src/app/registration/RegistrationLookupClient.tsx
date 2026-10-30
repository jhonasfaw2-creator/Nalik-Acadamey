"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  CalendarPlus,
  Printer,
  AlertCircle,
  Loader2,
  Download,
  Upload,
  Clock3,
} from "lucide-react";
import RegistrationDetails from "@/components/RegistrationDetails";
import { formatPaymentDeadline } from "@/lib/paymentDeadline";
import type { RegistrationSummary } from "@/lib/registration";

type LookupState = "idle" | "loading" | "found" | "error";

interface CourseMaterial {
  id: string;
  title: string;
  fileUrl: string;
  fileType: string;
}

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function RegistrationLookupClient() {
  const searchParams = useSearchParams();
  const [id, setId] = useState("");
  const [state, setState] = useState<LookupState>("idle");
  const [error, setError] = useState("");
  const [registration, setRegistration] = useState<RegistrationSummary | null>(null);
  const [canSubmitProof, setCanSubmitProof] = useState(false);

  // Return-visit payment-proof submission (no re-registration).
  const [proofPhone, setProofPhone] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState("");

  const lookup = useCallback(async (rawId: string, silent = false): Promise<boolean> => {
    const trimmed = rawId.trim().toUpperCase();
    if (!trimmed) {
      if (!silent) {
        setError("Please enter your registration ID.");
        setState("error");
      }
      return false;
    }
    if (!silent) {
      setState("loading");
      setError("");
    }
    try {
      const res = await fetch(`/api/registrations/lookup?id=${encodeURIComponent(trimmed)}`, { cache: "no-store" });
      const data = await res.json();
      if (data.found && data.registration) {
        const reg = data.registration;
        let courseMaterials: CourseMaterial[] = [];
        let courseMaterialsError: string | null = null;
        if (reg.downloadToken && reg.courseId) {
          try {
            const materialsResponse = await fetch(
              `/api/courses/${encodeURIComponent(reg.courseId)}/materials?token=${encodeURIComponent(reg.downloadToken)}`,
              { cache: "no-store" },
            );
            if (!materialsResponse.ok) throw new Error(`Materials request failed (${materialsResponse.status})`);
            const materialsData = await materialsResponse.json();
            if (!Array.isArray(materialsData.materials)) throw new Error("Invalid course materials response");
            courseMaterials = materialsData.materials;
          } catch (materialsError) {
            console.error("Could not load enrolled course materials", materialsError);
            courseMaterialsError = "Course materials could not be loaded. Please try checking your registration again.";
          }
        }
        setRegistration({
          referenceId: reg.referenceId,
          fullName: reg.fullName,
          course: reg.course,
          courseId: reg.courseId,
          downloadToken: reg.downloadToken ?? null,
          courseMaterials,
          courseMaterialsError,
          scheduleDays: reg.schedule?.days ?? null,
          scheduleSession: reg.schedule ? { group: reg.schedule.group, label: reg.schedule.session } : null,
          startTime: reg.schedule?.startTime ?? null,
          endTime: reg.schedule?.endTime ?? null,
          startDate: reg.schedule?.startDate ?? null,
          registrationStatus: reg.registrationStatus,
          paymentProofStatus: reg.paymentProofStatus ?? null,
          paymentProofNote: reg.paymentProofNote ?? null,
          paymentProofDeadline: reg.proofDeadlineAt ?? null,
        });
        setCanSubmitProof(reg.canSubmitPaymentProof === true);
        setProofError("");
        setState("found");
        return true;
      }
      setError(data.error || "We couldn't find a registration with that ID.");
      setRegistration(null);
      setCanSubmitProof(false);
      setState("error");
      return false;
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
      setRegistration(null);
      setState("error");
      return false;
    }
  }, []);

  useEffect(() => {
    const prefill = searchParams.get("id");
    if (prefill) {
      setId(prefill.toUpperCase());
      lookup(prefill);
    }
  }, [searchParams, lookup]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    lookup(id);
  };

  const submitProof = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!registration || proofBusy) return;
    setProofError("");

    if (!proofPhone.trim()) {
      setProofError("Enter the phone number you registered with.");
      return;
    }
    if (!proofFile) {
      setProofError("Choose a screenshot of your bank transfer.");
      return;
    }
    if (!ALLOWED_PROOF_TYPES.includes(proofFile.type)) {
      setProofError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (proofFile.size > MAX_PROOF_BYTES) {
      setProofError("The screenshot must be no larger than 5 MB.");
      return;
    }

    setProofBusy(true);
    try {
      const data = new FormData();
      data.append("file", proofFile);
      data.append("phone", proofPhone.trim());
      const response = await fetch(
        `/api/registrations/${encodeURIComponent(registration.referenceId)}/payment-proof`,
        { method: "POST", body: data },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setProofError(result.error || "Upload failed. Please try again.");
        return;
      }
      setProofFile(null);
      await lookup(registration.referenceId, true);
    } catch {
      setProofError("Network problem. Check your connection and try again.");
    } finally {
      setProofBusy(false);
    }
  };

  const pending = registration?.registrationStatus === "PENDING";
  const expired = registration?.registrationStatus === "EXPIRED";
  const awaitingReview = registration?.paymentProofStatus === "PENDING_REVIEW";
  const proofRejected = registration?.paymentProofStatus === "REJECTED";
  const deadlineText = registration?.paymentProofDeadline
    ? formatPaymentDeadline(registration.paymentProofDeadline)
    : "";

  return (
    <div className="flex min-h-screen flex-col bg-warm-white">
      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md">
          <div className="text-center">
            <a href="/" className="inline-flex items-center gap-2.5">
              <img src="/assets/logo.jpeg" alt="Nalik Academy" className="h-9 w-9 rounded-lg object-cover" />
              <span className="text-lg font-bold text-navy">Nalik Academy</span>
            </a>
            <h1 className="mt-6 text-2xl font-bold text-navy sm:text-3xl">Check Your Registration</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Enter your registration ID to view your enrollment and submit payment proof.
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-8">
            <label htmlFor="reg-id" className="mb-1.5 block text-sm font-medium text-gray-700">
              Registration ID
            </label>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input
                id="reg-id"
                name="reg-id"
                value={id}
                onChange={(e) => setId(e.target.value.toUpperCase())}
                placeholder="NA-2026-XXXXXX"
                autoComplete="off"
                spellCheck={false}
                className="w-full flex-1 rounded-lg border border-gray-200 bg-white px-4 py-3 font-mono text-sm tracking-wide text-navy placeholder:font-sans placeholder:tracking-normal placeholder:text-gray-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
              />
              <button
                type="submit"
                disabled={state === "loading" || !id.trim()}
                className="action-primary inline-flex items-center justify-center gap-2 disabled:opacity-50 sm:shrink-0"
              >
                {state === "loading" ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                {state === "loading" ? "Checking…" : "Check Registration"}
              </button>
            </div>
          </form>

          {state === "error" && (
            <div className="mt-5 flex items-start gap-2.5 bg-red-50 px-4 py-3.5" role="alert">
              <AlertCircle size={17} className="mt-0.5 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-700">{error}</p>
                <p className="mt-1 text-xs text-red-600/80">
                  Your registration ID was shown after you registered (format: NA-YYYY-XXXXXX).
                </p>
              </div>
            </div>
          )}

          {state === "found" && registration && (
            <div className="mt-8">
              <RegistrationDetails registration={registration} highlightReference />

              {expired && (
                <div className="mt-4 bg-red-50 px-4 py-4 text-sm text-red-700" role="alert">
                  <p className="font-semibold">Registration expired</p>
                  <p className="mt-1 leading-relaxed">
                    Payment proof was not submitted within the 24-hour window, so this registration is no
                    longer active. If you already sent the bank transfer, contact us at
                    info@nalikacademy.com or +251979989079.
                  </p>
                </div>
              )}

              {pending && canSubmitProof && deadlineText && (
                <div className="mt-4 flex items-start gap-2.5 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                  <Clock3 size={17} className="mt-0.5 shrink-0" />
                  <p className="leading-relaxed">
                    Submit your bank-transfer payment proof by{" "}
                    <span className="font-semibold">{deadlineText}</span>. That is 24 hours after you
                    registered; after that the registration expires.
                  </p>
                </div>
              )}

              {proofRejected && canSubmitProof && (
                <div className="mt-4 bg-red-50 px-4 py-4 text-sm text-red-700" role="alert">
                  Your payment proof was rejected. Submit a corrected screenshot before the deadline.
                </div>
              )}

              {awaitingReview && (
                <div className="mt-4 bg-green-50 px-4 py-4 text-sm text-green-800">
                  Your payment proof is awaiting review. You are not enrolled until it is approved.
                </div>
              )}

              {pending && canSubmitProof && (
                <form onSubmit={submitProof} className="mt-5 space-y-3 bg-white px-4 py-4">
                  <div>
                    <h2 className="text-sm font-semibold text-navy">Submit payment proof</h2>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Already registered? Confirm the phone number on your registration and upload your
                      bank-transfer screenshot. You do not need to register again.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="proof-phone" className="mb-1.5 block text-xs font-medium text-gray-700">
                      Phone number used at registration
                    </label>
                    <input
                      id="proof-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={proofPhone}
                      onChange={(e) => setProofPhone(e.target.value)}
                      placeholder="09XX XXX XXX"
                      className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-navy placeholder:text-gray-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      We check this against your registration before accepting the screenshot.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="proof-file" className="mb-1.5 block text-xs font-medium text-gray-700">
                      Bank transfer screenshot
                    </label>
                    <input
                      id="proof-file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setProofFile(e.currentTarget.files?.[0] ?? null)}
                      className="block w-full text-xs text-gray-600 file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-warm-white file:px-3 file:text-xs file:font-semibold file:text-navy"
                    />
                    <p className="mt-1 text-xs text-gray-500">JPG, PNG, or WebP up to 5 MB.</p>
                  </div>

                  {proofError && (
                    <p className="text-sm text-red-700" role="alert">
                      {proofError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={proofBusy}
                    className="action-primary inline-flex w-full items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {proofBusy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    {proofBusy ? "Uploading…" : "Submit payment proof"}
                  </button>
                </form>
              )}

              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <a
                  href={`/api/registrations/lookup/ics?id=${encodeURIComponent(registration.referenceId)}`}
                  className="action-secondary inline-flex items-center justify-center gap-2"
                >
                  <CalendarPlus size={15} /> Add Schedule to Calendar
                </a>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="action-secondary inline-flex items-center justify-center gap-2"
                >
                  <Printer size={15} /> Print Confirmation
                </button>
              </div>

              {registration.downloadToken && (
                <section className="mt-5 bg-white py-4">
                  <h2 className="text-sm font-semibold text-navy">Course materials</h2>
                  {registration.courseMaterialsError ? (
                    <p className="mt-2 text-xs text-red-600">{registration.courseMaterialsError}</p>
                  ) : registration.courseMaterials.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {registration.courseMaterials.map((material) => (
                        <li key={material.id}>
                          <a
                            href={material.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-medium text-navy hover:text-gold"
                          >
                            <Download size={15} /> {material.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-gray-500">No course materials are available yet.</p>
                  )}
                </section>
              )}
            </div>
          )}

          <p className="mt-10 text-center text-xs text-gray-400">
            Lost your registration ID? Contact us at info@nalikacademy.com or +251979989079.
          </p>
        </div>
      </main>
    </div>
  );
}
