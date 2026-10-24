"use client";

import { useState, useRef, useEffect, useCallback, type ChangeEvent } from "react";
import { X, Loader2, Calendar, AlertCircle, ArrowRight, Check, Upload } from "lucide-react";
import PaymentInstructions from "@/components/PaymentInstructions";

interface CourseOption {
  id: string;
  title: string;
  price: number;
  discountPrice: number | null;
  discountLabel: string | null;
}

interface ScheduleSession {
  id: string;
  session: string;
  startTime: string;
  endTime: string;
  maxSeats: number;
  enrolled: number;
  seatsAvailable: number;
  isFull: boolean;
}

interface ScheduleGroup {
  group: "A" | "B";
  days: string;
  sessions: ScheduleSession[];
  isFull: boolean;
}

interface ApplicationFormProps {
  open: boolean;
  onClose: () => void;
  preselectedCourse?: string;
}

function formatBirr(amount: number) {
  return amount.toLocaleString("en-ET") + " Birr";
}

function computeDuration(startTime?: string, endTime?: string): string {
  if (!startTime || !endTime) return "";
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return "";
  const minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins} min`;
  return mins ? `${hours}h ${mins}m` : `${hours} hour${hours === 1 ? "" : "s"}`;
}

export default function ApplicationForm({ open, onClose, preselectedCourse }: ApplicationFormProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Course & schedule data
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [scheduleGroups, setScheduleGroups] = useState<ScheduleGroup[]>([]);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Selections
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");

  // Student information (uncontrolled inputs)
  const fullNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const ageRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
const [registrationCreated, setRegistrationCreated] = useState<{
  referenceId: string;
} | null>(null);
const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
const [proofPreview, setProofPreview] = useState<string | null>(null);
const [isUploadingProof, setIsUploadingProof] = useState(false);
const [proofUploaded, setProofUploaded] = useState(false);
const [proofUploadError, setProofUploadError] = useState("");
const [proofNotificationFailed, setProofNotificationFailed] = useState(false);
const [proofImageDeliveryFailed, setProofImageDeliveryFailed] = useState(false);
const [proofReviewStatus, setProofReviewStatus] = useState<"PENDING_REVIEW" | "APPROVED" | "REJECTED" | null>(null);
const [proofReviewNote, setProofReviewNote] = useState<string | null>(null);

  useEffect(() => {
    if (!proofPreview) return;
    return () => URL.revokeObjectURL(proofPreview);
  }, [proofPreview]);

  const handlePaymentProofChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    setProofUploadError("");
    setProofNotificationFailed(false);

    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setPaymentProofFile(null);
      setProofPreview(null);
      setProofUploadError("Choose an image smaller than 5 MB.");
      return;
    }

    setPaymentProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  };

  // Load courses + schedules
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadError("");
    setScheduleError("");
    setCoursesLoaded(false);

    fetch("/api/courses")
      .then((r) => r.json())
      .then((courseData) => {
        if (cancelled) return;
        if (Array.isArray(courseData)) {
          setCourses(
            courseData.map((c: CourseOption) => ({
              id: c.id,
              title: c.title,
              price: c.price,
              discountPrice: c.discountPrice,
              discountLabel: c.discountLabel,
            }))
          );
          const wanted = preselectedCourse;
          if (wanted) {
            const match = courseData.find((c: CourseOption) => c.title === wanted);
            if (match) setSelectedCourseId((current) => current || match.id);
          }
        } else {
          setLoadError("We couldn't load the courses right now.");
        }
        setCoursesLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("We couldn't load the courses right now. Please check your connection.");
        setCoursesLoaded(true);
      });

    const loadSchedules = async () => {
      for (let attempt = 0; attempt < 2 && !cancelled; attempt += 1) {
        try {
          const response = await fetch("/api/schedules");
          if (!response.ok) throw new Error(`Schedules request failed (${response.status})`);
          const scheduleData = await response.json();
          if (!scheduleData || !Array.isArray(scheduleData.groups)) {
            throw new Error("Invalid schedules response");
          }
          if (!cancelled) {
            setScheduleGroups(scheduleData.groups);
            setScheduleError("");
          }
          return;
        } catch {
          if (attempt === 0 && !cancelled) {
            await new Promise((resolve) => setTimeout(resolve, 1_000));
          }
        }
      }
      if (!cancelled) setScheduleError("We couldn't load schedules. Please check your connection and try again.");
    };
    void loadSchedules();

    return () => {
      cancelled = true;
    };
  }, [open, preselectedCourse, reloadKey]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      setRegistrationCreated(null);
      setPaymentProofFile(null);
      setProofPreview(null);
      setProofUploaded(false);
      setProofNotificationFailed(false);
      setProofImageDeliveryFailed(false);
      setProofReviewStatus(null);
      setProofReviewNote(null);
      setProofUploadError("");
      dialog.showModal();
    }
    else dialog.close();
  }, [open]);

  useEffect(() => {
    const referenceId = registrationCreated?.referenceId;
    if (!open || !proofUploaded || !referenceId) return;

    let stopped = false;
    let timer: number | undefined;
    let delay = 3_000;

    const checkReviewStatus = async () => {
      try {
        const response = await fetch(
          `/api/registrations/lookup?id=${encodeURIComponent(referenceId)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("Registration status is unavailable.");
        const data = await response.json();
        const registration = data?.registration;
        const status = registration?.paymentProofStatus;

        if (status === "APPROVED" || registration?.registrationStatus === "CONFIRMED") {
          stopped = true;
          setProofReviewStatus("APPROVED");
          return;
        }
        if (status === "REJECTED") {
          stopped = true;
          setProofReviewStatus("REJECTED");
          setProofReviewNote(typeof registration.paymentProofNote === "string" ? registration.paymentProofNote : null);
          setProofUploaded(false);
          setPaymentProofFile(null);
          setProofPreview(null);
          return;
        }
        if (status === "PENDING_REVIEW") setProofReviewStatus("PENDING_REVIEW");
      } catch {
        // Keep the pending state visible and retry; lookup errors should not
        // imply a failed payment or force the student to upload again.
      } finally {
        if (!stopped) {
          timer = window.setTimeout(checkReviewStatus, delay);
          delay = Math.min(15_000, Math.round(delay * 1.5));
        }
      }
    };

    void checkReviewStatus();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [open, proofUploaded, registrationCreated?.referenceId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onDialogClose = () => {
      onClose();
    };
    dialog.addEventListener("close", onDialogClose);
    return () => dialog.removeEventListener("close", onDialogClose);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const selectedGroup = scheduleGroups.find((g) => g.group === selectedGroupId) as ScheduleGroup | undefined;
  const selectedSession = selectedGroup?.sessions.find((s) => s.id === selectedSessionId);
  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const duration = computeDuration(selectedSession?.startTime, selectedSession?.endTime);
  const scheduleText =
    selectedGroup && selectedSession
      ? `Schedule ${selectedGroup.group}: ${selectedSession.session}`
      : "";
  const scheduleDays = selectedGroup?.days || "";

  const fieldClass =
    "w-full rounded-xl border border-gray-200 bg-[#f9faf8] px-3.5 py-2.75 text-sm text-navy placeholder:text-gray-400 transition-all focus:border-gold focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/20 disabled:bg-gray-50";

  useEffect(() => {
    setFormError("");
  }, [selectedCourseId, selectedSessionId]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;

    if (!selectedCourseId || !selectedSessionId) {
      setFormError("Choose a course and a schedule before continuing.");
      return;
    }

    const requiredFields = [fullNameRef.current, phoneRef.current, ageRef.current];
    const invalidField = requiredFields.find((field) => !field?.checkValidity());
    if (invalidField !== undefined) {
      invalidField?.reportValidity();
      setFormError("Complete your name, phone number, and age before continuing.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const rawFullName = fullNameRef.current?.value.trim() ?? "";

      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: rawFullName,
          phone: phoneRef.current?.value.trim() ?? "",
          age: Number(ageRef.current?.value),
          courseId: selectedCourseId,
          scheduleId: selectedSessionId,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFormError(data.error || "We couldn't submit your registration. Please try again.");
        setIsSubmitting(false);
        return;
      }

      if (typeof data.referenceId !== "string") {
        setFormError("Your registration was submitted, but we couldn't retrieve its reference ID. Please contact support.");
        setIsSubmitting(false);
        return;
      }

      setRegistrationCreated({ referenceId: data.referenceId });
      setIsSubmitting(false);
    } catch {
      setFormError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }, [isSubmitting, selectedCourseId, selectedSessionId]);

  return (
    <dialog ref={dialogRef} className={`w-[calc(100%-1rem)] ${registrationCreated ? "h-[calc(100dvh-1rem)] max-w-3xl sm:h-[92dvh]" : "max-w-5xl"} max-h-[calc(100dvh-1rem)] overflow-hidden rounded-xl bg-white p-0 backdrop:bg-black/60 sm:w-[calc(100%-2rem)] sm:max-h-[92dvh]`}>
      <div className={`flex ${registrationCreated ? "h-full" : "max-h-[calc(100dvh-1rem)] sm:max-h-[92dvh]"} flex-col overflow-hidden bg-white`}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <p className="text-sm text-gray-500">Nalik Academy</p>
            <h2 className="mt-1 text-xl font-bold text-navy sm:text-2xl">Register for a course</h2>
          </div>
          <button
            onClick={() => dialogRef.current?.close()}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-500 transition-colors hover:text-navy"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {registrationCreated ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-0 text-center sm:px-6 sm:pb-5 sm:pt-1">
            <h3 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">Application saved</h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">
              To complete registration, pay using the details below and submit your receipt. You are not enrolled until your payment is approved. Save your reference ID to check your status.
            </p>
            <p className="mx-auto mt-4 max-w-full break-all font-mono text-base font-semibold text-navy sm:w-fit sm:text-lg">
              {registrationCreated.referenceId}
            </p>
            {proofUploaded ? (
              <div className="mx-auto mt-6 max-w-lg text-center">
                {proofReviewStatus === "APPROVED" ? (
                  <>
                    <Check size={30} className="mx-auto mb-4 text-green-700" />
                    <h4 className="text-xl font-semibold text-green-900">Registration confirmed</h4>
                    <p className="mt-3 text-sm text-green-800">
                      Your payment was approved and your enrollment is complete.
                    </p>
                  </>
                ) : (
                  <>
                    <Check size={28} className="mx-auto mb-4 text-green-700" />
                    <h4 className="text-xl font-semibold text-green-900">Payment submitted</h4>
                    {proofNotificationFailed ? (
                      <p className="mt-3 text-sm text-amber-800">
                        Your proof is saved, but the academy could not be notified automatically. Please <a href="/#contact" className="font-semibold underline underline-offset-2">contact the academy</a> to make sure it is reviewed.
                      </p>
                    ) : proofImageDeliveryFailed ? (
                      <p className="mt-3 text-sm text-amber-800">
                        The academy was notified, but Telegram could not display the receipt image. The proof is saved in the admin dashboard for review.
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-green-800">
                        Your proof is awaiting review. This page will update automatically if your payment is approved while you&apos;re here.
                      </p>
                    )}
                  </>
                )}
                <a
                  href={`/registration?id=${encodeURIComponent(registrationCreated.referenceId)}`}
                  className="action-primary mt-8 inline-flex w-full items-center justify-center gap-2"
                >
                  {proofReviewStatus === "APPROVED" ? "View enrollment confirmation" : "View registration status"}
                </a>
              </div>
            ) : (
              <div className="mx-auto mt-0 max-w-3xl space-y-4 sm:space-y-5">
                {proofReviewStatus === "REJECTED" && (
                  <div className="text-left text-sm text-red-800" role="alert">
                    <p className="font-semibold">The receipt was rejected. Upload a corrected image to request another review.</p>
                    {proofReviewNote && <p className="mt-1">Admin note: {proofReviewNote}</p>}
                  </div>
                )}
                <PaymentInstructions amount={selectedCourse?.discountPrice ?? selectedCourse?.price ?? 0} />

                <form
                  className="space-y-3 text-left sm:space-y-4"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (!paymentProofFile || !registrationCreated || isUploadingProof) return;
                    setIsUploadingProof(true);
                    setProofUploadError("");
                    try {
                      const data = new FormData();
                      data.append("file", paymentProofFile);
                      const response = await fetch(
                        `/api/registrations/${encodeURIComponent(registrationCreated.referenceId)}/payment-proof`,
                        { method: "POST", body: data }
                      );
                      let result: { error?: string; success?: boolean; status?: string; notificationSent?: boolean; proofSent?: boolean };
                      const contentType = response.headers.get("content-type") ?? "";
                      if (contentType.includes("application/json")) {
                        result = await response.json();
                      } else {
                        const text = await response.text();
                        result = { error: text || "Upload failed." };
                      }
                      if (!response.ok) throw new Error(result.error || "Upload failed.");
                      setProofNotificationFailed(result.notificationSent === false);
                      setProofImageDeliveryFailed(result.notificationSent !== false && result.proofSent === false);
                      setProofReviewStatus("PENDING_REVIEW");
                      setProofReviewNote(null);
                      setProofUploaded(true);
                    } catch (error) {
                      setProofUploadError(error instanceof Error ? error.message : "Upload failed. Try again.");
                    } finally {
                      setIsUploadingProof(false);
                    }
                  }}
                >
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-base font-semibold text-navy">Upload your payment receipt</h4>
                      <p id="payment-proof-helper" className="mt-1 text-sm leading-5 text-gray-500">
                        Use a clear screenshot or photo. JPG, PNG, or WebP up to 5 MB.
                      </p>
                    </div>

                    <label
                      htmlFor="payment-proof-file"
                      className="group flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-gray-300 bg-warm-white px-4 py-5 text-center transition-colors hover:border-gold hover:bg-[#f8f6ef] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-gold sm:min-h-48 sm:px-8"
                    >
                      <input
                        id="payment-proof-file"
                        type="file"
                        className="sr-only"
                        accept="image/jpeg,image/png,image/webp"
                        aria-describedby="payment-proof-helper"
                        disabled={isUploadingProof}
                        onChange={handlePaymentProofChange}
                      />
                      {proofPreview ? (
                        <>
                          <img
                            src={proofPreview}
                            alt="Selected payment receipt preview"
                            className="max-h-44 max-w-full rounded-lg object-contain sm:max-h-52"
                          />
                          <span className="max-w-full break-all text-sm font-medium text-navy">
                            {paymentProofFile?.name}
                          </span>
                          <span className="text-xs text-gray-500">Tap to choose a different image</span>
                        </>
                      ) : (
                        <>
                          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-navy">
                            <Upload size={20} />
                          </span>
                          <span className="inline-flex min-h-10 items-center rounded-md bg-white px-4 text-sm font-semibold text-navy transition-colors group-hover:bg-gold/15">
                            Choose an image
                          </span>
                        </>
                      )}
                    </label>

                    {proofUploadError && (
                      <p className="text-sm text-red-700" role="alert">
                        {proofUploadError}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={!paymentProofFile || isUploadingProof}
                      className="action-primary inline-flex w-full items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isUploadingProof && <Loader2 size={16} className="animate-spin" />}
                      {isUploadingProof ? "Uploading receipt…" : "Submit payment proof"}
                    </button>
                  </div>
                </form>
              </div>
            )}
            {formError && (
              <p className="mx-auto mt-6 max-w-md text-sm text-red-600" role="alert">
                {formError}
              </p>
            )}
            {!proofUploaded && <a
              href={`/registration?id=${encodeURIComponent(registrationCreated.referenceId)}`}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 px-1 py-3.5 text-sm font-medium text-navy underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gold"
            >
              View registration
            </a>}
          </div>
        ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-6 sm:py-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_360px]">
            <div className="space-y-5">
              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-navy">Choose a course</h3>
                  <span className="text-sm text-gray-500">{courses.length} available</span>
                </div>
                {!coursesLoaded ? (
                  <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-400">
                    <Loader2 size={14} className="animate-spin" /> Loading courses...
                  </div>
                ) : loadError && courses.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-center">
                    <p className="text-sm font-medium text-amber-800">{loadError}</p>
                    <button
                      onClick={() => setReloadKey((k) => k + 1)}
                      className="action-secondary mt-3"
                    >
                      Try Again
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {courses.map((c) => {
                      const coursePrice = c.discountPrice ?? c.price;
                      const isSelected = selectedCourseId === c.id;
                      return (
                        <label
                          key={c.id}
                          className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-md p-3 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-gold sm:gap-4 sm:p-4 ${
                            isSelected ? "bg-[#fffaf1]" : "hover:bg-warm-white"
                          }`}
                        >
                          <div className={`mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center ${isSelected ? "border-gold bg-gold" : "border-gray-300"}`}>
                            {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                          </div>
                          <input
                            type="radio"
                            name="course"
                            value={c.id}
                            checked={isSelected}
                            onChange={(e) => {
                              setSelectedCourseId(e.target.value);
                              setSelectedGroupId("");
                              setSelectedSessionId("");
                            }}
                            className="sr-only"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2 sm:gap-4">
                              <span className="min-w-0 break-words text-sm font-semibold text-navy sm:text-base">{c.title}</span>
                              <span className="shrink-0 text-right">
                                <span className="block text-base font-bold text-navy sm:text-lg">{formatBirr(coursePrice)}</span>
                                {c.discountPrice && (
                                  <span className="block text-xs text-gray-400 line-through">{formatBirr(c.price)}</span>
                                )}
                              </span>
                            </span>
                            {c.discountLabel && (
                              <span className="mt-2 inline-flex text-xs font-medium text-emerald-700">
                                {c.discountLabel}
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-navy">Choose a schedule</h3>
                </div>
                {scheduleGroups.length === 0 ? (
                  scheduleError ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-center">
                      <p className="text-sm font-medium text-amber-800">{scheduleError}</p>
                      <button
                        onClick={() => setReloadKey((key) => key + 1)}
                        className="action-secondary mt-3"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-warm-white px-4 py-3 text-sm text-gray-500">
                      No schedule groups are open right now. Please try again later.
                    </div>
                  )
                ) : (
                  <div className="space-y-3">
                    {scheduleGroups.map((g) => {
                      const groupSelected = selectedGroupId === g.group;
                      return (
                        <div
                          key={g.group}
                          className={`rounded-md p-3 transition-colors ${
                            groupSelected ? "bg-[#fffaf1]" : "hover:bg-warm-white"
                          }`}
                        >
                          <label className="flex cursor-pointer items-start gap-3">
                            <input
                              type="radio"
                              name="schedule-group"
                              value={g.group}
                              checked={groupSelected}
                              onChange={() => {
                                setSelectedGroupId(g.group);
                                setSelectedSessionId("");
                              }}
                              className="mt-0.5 accent-gold"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className="text-sm font-bold text-navy">Schedule {g.group}</span>
                                {g.isFull ? (
                                  <span className="text-[11px] font-bold text-red-500">Full</span>
                                ) : (
                                  <span className="text-[11px] text-gray-500">Open</span>
                                )}
                              </span>
                              <span className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                                <Calendar size={11} /> {g.days}
                              </span>
                            </span>
                          </label>

                          {groupSelected && (
                            <div className="mt-3 space-y-2">
                              {g.sessions.map((s) => {
                                const isFull = s.isFull;
                                return (
                                  <label
                                    key={s.id}
                                    className={`flex min-h-14 items-start gap-3 rounded-md p-3 transition-colors ${
                                      selectedSessionId === s.id ? "bg-white" : "hover:bg-white"
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name="schedule-session"
                                      value={s.id}
                                      checked={selectedSessionId === s.id}
                                      onChange={() => setSelectedSessionId(s.id)}
                                      disabled={isFull}
                                      className="mt-0.5 accent-gold"
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-semibold text-navy">{s.session}</span>
                                        {isFull ? (
                                          <span className="text-[11px] font-bold text-red-500">Full</span>
                                        ) : (
                                          <span className="text-[11px] font-medium text-gray-500">{s.seatsAvailable} seats</span>
                                        )}
                                      </span>
                                      <span className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                                        <span>
                                          {s.startTime} – {s.endTime}
                                        </span>
                                        <span>•</span>
                                        <span>{computeDuration(s.startTime, s.endTime)}</span>
                                      </span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section>
                <h3 className="text-base font-semibold text-navy">Your details</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="reg-name" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Full name <span className="text-gold">*</span>
                    </label>
                    <input ref={fullNameRef} id="reg-name" type="text" placeholder="e.g. Daniel Kebede" autoComplete="name" required className={fieldClass} />
                  </div>
                  <div>
                    <label htmlFor="reg-phone" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Phone <span className="text-gold">*</span>
                    </label>
                    <input ref={phoneRef} id="reg-phone" type="tel" placeholder="+251 9XX XXX XXX" autoComplete="tel" required className={fieldClass} />
                  </div>
                  <div>
                    <label htmlFor="reg-age" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Age <span className="text-gold">*</span>
                    </label>
                    <input ref={ageRef} id="reg-age" type="number" min={10} max={99} placeholder="22" required className={fieldClass} />
                  </div>
                </div>
              </section>
            </div>

            <aside className="lg:pt-2">
              <div className="lg:sticky lg:top-0">
                <div className="p-1 sm:p-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-navy">Registration summary</h3>
                  </div>

                  <div className="mt-4">
                    <p className="break-words text-sm font-semibold text-navy">{selectedCourse?.title || "Course not selected"}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>Schedule</span>
                      <span className="min-w-0 text-right font-medium text-navy">{scheduleText || "Not selected"}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>Days</span>
                      <span className="min-w-0 text-right font-medium text-navy">{scheduleDays || "—"}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>Duration</span>
                      <span className="min-w-0 text-right font-medium text-navy">{duration || "—"}</span>
                    </div>
                  </div>

                  <div className="mt-5 text-sm text-gray-600">
                    <p className="font-semibold text-navy">Next steps</p>
                    <p className="mt-1 leading-relaxed">
                      Submit your payment screenshot for admin review. Enrollment is confirmed only after your payment is approved.
                    </p>
                  </div>

                  {formError && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[11px] text-red-600" role="alert">
                      <AlertCircle size={12} className="mt-0.5 shrink-0 text-red-500" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                    className="action-primary mt-4 flex w-full items-center justify-center gap-2 text-base disabled:opacity-60"
                  >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                    {isSubmitting ? "Saving application…" : "Save application"}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
        )}
      </div>
    </dialog>
  );
}
