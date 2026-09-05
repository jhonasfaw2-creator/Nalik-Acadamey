"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, CheckCircle, Loader2, AlertCircle, Calendar, Info, CreditCard } from "lucide-react";

interface CourseOption {
  id: string;
  title: string;
  price: number;
  discountPrice: number | null;
  discountLabel: string | null;
}

interface ScheduleOption {
  id: string;
  batchName: string;
  days: string;
  startTime: string;
  endTime: string;
  startDate: string;
  maxSeats: number;
  enrolled: number;
  course: { id: string; title: string; price: number; discountPrice: number | null; discountLabel: string | null };
}

interface ApplicationFormProps {
  open: boolean;
  onClose: () => void;
  preselectedCourse?: string;
}

interface VerifyResponse {
  status: string; // PENDING / SUCCESS / FAILED / CANCELLED / INCOMPLETE / BLOCKED / AUTH_NEEDED
  error?: string;
  registration?: {
    referenceId: string;
    fullName: string;
    course: string | null;
    schedule: string | null;
    amount: number;
    currency: string;
    paymentStatus: string;
    paymentMethod: string | null;
    merchantReference: string | null;
    chapaReference: string | null;
    registrationStatus: string;
  };
}

const PENDING_KEY = "nalik_pending_payment";

function formatBirr(amount: number) {
  return amount.toLocaleString("en-ET") + " Birr";
}

export default function ApplicationForm({ open, onClose, preselectedCourse }: ApplicationFormProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const popupRef = useRef<Window | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [schedules, setSchedules] = useState<ScheduleOption[]>([]);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Wizard state
  const [step, setStep] = useState<"course" | "schedule" | "info" | "summary" | "processing" | "result">("course");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [stepErrors, setStepErrors] = useState<string>("");

  // Student info
  const fullNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const ageRef = useRef<HTMLInputElement>(null);

  // Payment / result state
  const [referenceId, setReferenceId] = useState("");
  const [amount, setAmount] = useState(0);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [pollingStopped, setPollingStopped] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const [pendingSummary, setPendingSummary] = useState<{ courseTitle: string; scheduleText: string } | null>(null);

  const isOpen = open || forceOpen;

  // Resume a pending payment after returning from Chapa (page reload).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return;
      const pending = JSON.parse(raw) as { referenceId: string; amount: number; courseTitle?: string; scheduleText?: string };
      if (pending?.referenceId) {
        setReferenceId(pending.referenceId);
        setAmount(pending.amount || 0);
        setPendingSummary({
          courseTitle: pending.courseTitle || "",
          scheduleText: pending.scheduleText || "",
        });
        setForceOpen(true);
        setStep("processing");
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  // Fetch courses + schedules (independently — a schedules failure must never
  // make courses look unavailable, and vice versa)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadError("");
    setCoursesLoaded(false);

    fetch("/api/courses")
      .then((r) => r.json())
      .then((courseData) => {
        if (cancelled) return;
        if (Array.isArray(courseData)) {
          setCourses(courseData.map((c: CourseOption) => ({
            id: c.id,
            title: c.title,
            price: c.price,
            discountPrice: c.discountPrice,
            discountLabel: c.discountLabel,
          })));
          // Preselect a course when opened with one
          const wanted = preselectedCourse;
          if (wanted) {
            const match = courseData.find((c: CourseOption) => c.title === wanted);
            if (match) setSelectedCourseId(match.id);
          }
          setLoadError("");
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

    fetch("/api/schedules")
      .then((r) => r.json())
      .then((scheduleData) => {
        if (cancelled) return;
        if (Array.isArray(scheduleData)) setSchedules(scheduleData);
      })
      .catch(() => {
        // schedules are optional — the student can still pick a course
      });

    return () => { cancelled = true; };
  }, [isOpen, preselectedCourse, reloadKey]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) dialog.showModal();
    else dialog.close();
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Any close (X button, Escape key, programmatic close) must fully reset
    // the wizard. Before, only the X button reset state — closing with Escape
    // left the previous attempt's order summary (and referenceId) behind, so
    // reopening the form showed a stale summary instead of step 1.
    const handleClose = () => {
      if (step === "result" && result?.status === "SUCCESS") sessionStorage.removeItem(PENDING_KEY);
      resetForm();
      onClose();
      setForceOpen(false);
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
    // re-register so the handler reads current step/result (e.g. to clear a
    // finished payment from sessionStorage); resetForm itself is stable in
    // behavior across renders (it only touches refs + stable setters).
  }, [onClose, step, result]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const filteredSchedules = schedules.filter((s) => s.course.id === selectedCourseId && s.maxSeats - s.enrolled > 0);
  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const selectedSchedule = filteredSchedules.find((s) => s.id === selectedScheduleId) as ScheduleOption | undefined;

  const resetForm = () => {
    setStep("course");
    setStepErrors("");
    setSelectedCourseId("");
    setSelectedScheduleId("");
    setReferenceId("");
    setAmount(0);
    setCheckoutUrl(null);
    setPopupBlocked(false);
    if (popupRef.current) { try { popupRef.current.close(); } catch { /* ignore */ } popupRef.current = null; }
    setPaying(false);
    setPayError("");
    setResult(null);
    setPollingStopped(false);
    setPendingSummary(null);
    setErrors({});
    setServerError("");
    if (fullNameRef.current) fullNameRef.current.value = "";
    if (emailRef.current) emailRef.current.value = "";
    if (phoneRef.current) phoneRef.current.value = "";
    if (ageRef.current) ageRef.current.value = "";
  };

  const handleClose = () => {
    // Keep pending state if the student hasn't finished paying, so returning
    // from Chapa (or a later visit) resumes verification automatically.
    if (step === "result" && result?.status === "SUCCESS") sessionStorage.removeItem(PENDING_KEY);
    resetForm();
    onClose();
    setForceOpen(false);
    dialogRef.current?.close();
  };

  const goTo = (next: typeof step) => { setStepErrors(""); setPayError(""); setStep(next); };

  // ── Registration ──────────────────────────────────────────
  const validateInfo = (): Record<string, string> => {
    const e: Record<string, string> = {};
    const name = fullNameRef.current?.value?.trim() || "";
    if (!name || name.length < 2) e.fullName = "Full name must be at least 2 characters";
    const email = emailRef.current?.value?.trim() || "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Please enter a valid email";
    const phone = phoneRef.current?.value?.trim() || "";
    if (!phone || phone.length < 8) e.phone = "Phone must be at least 8 digits";
    const age = Number(ageRef.current?.value?.trim() || 0);
    if (!age || isNaN(age) || age < 10 || age > 99 || !Number.isInteger(age)) e.age = "Enter a valid age (10–99)";
    return e;
  };

  const submitRegistration = async () => {
    setStepErrors("");
    setServerError("");
    const validationErrors = validateInfo();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    if (!selectedCourse) { setStepErrors("Please select a course."); return; }
    if (filteredSchedules.length > 0 && !selectedScheduleId) { setStepErrors("Please choose a class schedule."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullNameRef.current?.value?.trim(),
          email: emailRef.current?.value?.trim(),
          phone: phoneRef.current?.value?.trim(),
          age: Number(ageRef.current?.value?.trim()),
          courseId: selectedCourseId,
          scheduleId: selectedScheduleId || undefined,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const schedule = selectedSchedule;
        setReferenceId(data.referenceId);
        setAmount(data.amount || 0);
        setPendingSummary({
          courseTitle: selectedCourse.title,
          scheduleText: schedule
            ? `${schedule.batchName} — ${schedule.days}, ${schedule.startTime}–${schedule.endTime} (starts ${new Date(schedule.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })})`
            : "To be confirmed",
        });
        setStep("summary");
      } else if (res.status === 409) {
        setServerError(data.error || "Already registered for this course.");
        if (data.referenceId) {
          // Let them check the existing payment's status
          setReferenceId(data.referenceId);
          setStep("processing");
          setPollingStopped(true);
        }
      } else {
        setServerError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Chapa payment ─────────────────────────────────────────
  const startPayment = async () => {
    if (!referenceId) return;
    setPayError("");
    setPaying(true);
    try {
      const res = await fetch("/api/payments/chapa/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceId }),
      });
      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({
          referenceId,
          amount,
          courseTitle: pendingSummary?.courseTitle || "",
          scheduleText: pendingSummary?.scheduleText || "",
        }));
        setCheckoutUrl(data.checkoutUrl);
        setPayError("");
        setStep("processing");
        // NOTE: the payment window is opened by an explicit student click on
        // the "Open Chapa Payment Window" button below. Browsers only allow
        // window.open during a real user gesture, and opening it after this
        // async init would be silently blocked.
        return;
      }
      setPayError(data.error || "Unable to start payment. Please try again.");
    } catch {
      setPayError("Network error. Please check your connection and try again.");
    } finally {
      setPaying(false);
    }
  };

  const checkStatus = useCallback(async (ref: string): Promise<VerifyResponse | null> => {
    try {
      const res = await fetch(`/api/payments/verify?referenceId=${encodeURIComponent(ref)}`, { cache: "no-store" });
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  const verifyPayment = useCallback(async () => {
    if (!referenceId) return;
    const data = await checkStatus(referenceId);
    if (!data) { setPayError("Could not reach the payment service. Try again."); return; }
    setResult(data);
    if (data.status === "SUCCESS") {
      sessionStorage.removeItem(PENDING_KEY);
      if (popupRef.current) { try { popupRef.current.close(); } catch { /* ignore */ } popupRef.current = null; }
      setStep("result");
    } else if (["FAILED", "CANCELLED", "INCOMPLETE", "BLOCKED"].includes(data.status)) {
      if (popupRef.current) { try { popupRef.current.close(); } catch { /* ignore */ } popupRef.current = null; }
      setStep("result");
    } else {
      // PENDING — keep waiting
      if (step !== "processing") setStep("processing");
      setPollingStopped(false);
    }
  }, [referenceId, checkStatus, step]);

  // Poll while processing (after returning from Chapa or 409 resume)
  useEffect(() => {
    if (step !== "processing" || pollingStopped) return;
    let cancelled = false;
    let attempts = 0;

    const tick = async () => {
      if (cancelled || !referenceId) return;
      const data = await checkStatus(referenceId);
      if (cancelled) return;
      attempts++;
      if (data?.status === "SUCCESS") {
        setResult(data);
        sessionStorage.removeItem(PENDING_KEY);
        if (popupRef.current) { try { popupRef.current.close(); } catch { /* ignore */ } popupRef.current = null; }
        setStep("result");
      } else if (data && ["FAILED", "CANCELLED", "INCOMPLETE", "BLOCKED"].includes(data.status)) {
        if (popupRef.current) { try { popupRef.current.close(); } catch { /* ignore */ } popupRef.current = null; }
        setResult(data);
        setStep("result");
      } else if (attempts >= 120) {
        // ~10 minutes of waiting — give up polling; let the user check manually
        setPollingStopped(true);
      }
    };

    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [step, pollingStopped, referenceId, checkStatus]);

  const fieldClass = "w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy placeholder-gray-400 transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 disabled:bg-gray-50";
  const errorClass = "mt-1 text-xs text-red-500";

  const stepTitles: Record<string, string> = {
    course: "Choose Your Course",
    schedule: "Choose Your Class Schedule",
    info: "Your Details",
    summary: "Order Summary",
    processing: "Payment",
    result: "Payment Result",
  };

  return (
    <dialog ref={dialogRef} className="backdrop:bg-black/60 rounded-xl p-0 max-w-lg w-full max-h-[90vh]">
      <div className="bg-white rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-xl font-bold text-navy">Register for Nalik Academy</h2>
          <button onClick={handleClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {/* Progress indicator */}
          {step !== "result" && (
            <p className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-400">
              Step {["course", "schedule", "info", "summary", "processing"].indexOf(step) + 1} of 4 — {stepTitles[step]}
              {step !== "processing" && step !== "course" && (
                <button onClick={() => goTo(step === "schedule" ? "course" : step === "info" ? "schedule" : step === "summary" ? "info" : "summary")} className="ml-2 normal-case tracking-normal text-gold underline-offset-2 hover:underline">
                  ← Back
                </button>
              )}
            </p>
          )}

          {/* STEP: course */}
          {step === "course" && (
            <div>
              {stepErrors && <p className="mb-3 rounded-lg bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-600">{stepErrors}</p>}
              {!coursesLoaded ? (
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3.5 py-3 text-sm text-gray-400">
                  <Loader2 size={14} className="animate-spin" /> Loading courses...
                </div>
              ) : loadError && courses.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-center">
                  <p className="text-sm font-medium text-amber-800">{loadError}</p>
                  <button
                    onClick={() => setReloadKey((k) => k + 1)}
                    className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {courses.map((c) => {
                    const price = c.discountPrice ?? c.price;
                    const isSelected = selectedCourseId === c.id;
                    return (
                      <label key={c.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-all ${isSelected ? "border-gold bg-gold/5" : "border-gray-200 hover:border-gold/50"}`}>
                        <input
                          type="radio"
                          name="course"
                          value={c.id}
                          checked={isSelected}
                          onChange={(e) => { setSelectedCourseId(e.target.value); setSelectedScheduleId(""); setStepErrors(""); }}
                          className="accent-gold"
                        />
                        <span className="flex-1">
                          <span className="block text-sm font-semibold text-navy">{c.title}</span>
                          <span className="mt-0.5 flex items-baseline gap-2">
                            <span className="text-base font-bold text-gold">{formatBirr(price)}</span>
                            {c.discountPrice && <span className="text-xs text-gray-400 line-through">{formatBirr(c.price)}</span>}
                            {c.discountLabel && <span className="text-[11px] font-medium text-green-600">{c.discountLabel}</span>}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                  {courses.length === 0 && <p className="text-sm text-gray-400">No courses are available right now.</p>}
                </div>
              )}
              <button
                onClick={() => { if (!selectedCourseId) { setStepErrors("Please choose a course to continue."); return; } goTo("schedule"); }}
                disabled={!coursesLoaded}
                className="mt-5 w-full rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover hover:shadow-md disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          )}

          {/* STEP: schedule */}
          {step === "schedule" && (
            <div>
              {stepErrors && <p className="mb-3 rounded-lg bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-600">{stepErrors}</p>}
              {filteredSchedules.length === 0 ? (
                <div className="rounded-lg bg-warm-white px-4 py-3 text-sm text-gray-500">
                  No open batches for {selectedCourse?.title} right now. Pick another course, or continue without a schedule.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSchedules.map((s) => {
                    const spotsLeft = s.maxSeats - s.enrolled;
                    const isFull = spotsLeft <= 0;
                    return (
                      <label key={s.id} className={`flex items-start gap-3 rounded-lg border p-3.5 transition-all ${selectedScheduleId === s.id ? "border-gold bg-gold/5" : "border-gray-200 hover:border-gold/50"}`}>
                        <input
                          type="radio"
                          name="schedule"
                          value={s.id}
                          checked={selectedScheduleId === s.id}
                          onChange={() => setSelectedScheduleId(s.id)}
                          disabled={isFull}
                          className="mt-0.5 accent-gold"
                        />
                        <span className="flex-1">
                          <span className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-navy">{s.batchName}</span>
                            {isFull ? (
                              <span className="text-xs font-medium text-red-500">Full</span>
                            ) : (
                              <span className="text-xs text-gray-400">{spotsLeft} spots left</span>
                            )}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><Calendar size={11} /> {s.days}</span>
                            <span>{s.startTime} – {s.endTime}</span>
                            <span>Starts {new Date(s.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              <button onClick={() => { if (filteredSchedules.length > 0 && !selectedScheduleId) { setStepErrors("Please choose a schedule, or go back and pick 'no schedule'."); return; } goTo("info"); }} className="mt-5 w-full rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover hover:shadow-md">
                Continue
              </button>
            </div>
          )}

          {/* STEP: info */}
          {step === "info" && (
            <div className="space-y-4">
              {serverError && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}
              <div>
                <label htmlFor="reg-name" className="mb-1 block text-sm font-medium text-gray-700">Full Name <span className="text-gold">*</span></label>
                <input ref={fullNameRef} id="reg-name" type="text" placeholder="e.g. Daniel Kebede" autoComplete="name" className={fieldClass} />
                {errors.fullName && <p className={errorClass}>{errors.fullName}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-email" className="mb-1 block text-sm font-medium text-gray-700">Email <span className="text-gold">*</span></label>
                  <input ref={emailRef} id="reg-email" type="email" placeholder="you@example.com" autoComplete="email" className={fieldClass} />
                  {errors.email && <p className={errorClass}>{errors.email}</p>}
                </div>
                <div>
                  <label htmlFor="reg-phone" className="mb-1 block text-sm font-medium text-gray-700">Phone <span className="text-gold">*</span></label>
                  <input ref={phoneRef} id="reg-phone" type="tel" placeholder="+251 9XX XXX XXX" autoComplete="tel" className={fieldClass} />
                  {errors.phone && <p className={errorClass}>{errors.phone}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-age" className="mb-1 block text-sm font-medium text-gray-700">Age <span className="text-gold">*</span></label>
                  <input ref={ageRef} id="reg-age" type="number" min={10} max={99} placeholder="e.g. 22" className={fieldClass} />
                  {errors.age && <p className={errorClass}>{errors.age}</p>}
                </div>
              </div>

              <div className="rounded-lg bg-warm-white px-4 py-3 text-xs text-gray-500">
                <p className="font-medium text-navy">{selectedCourse?.title}</p>
                {selectedSchedule && <p>{selectedSchedule.batchName} — {selectedSchedule.days}, {selectedSchedule.startTime}–{selectedSchedule.endTime}</p>}
                <p className="mt-1">You&apos;ll pay <span className="font-semibold text-gold">{formatBirr(amount || (selectedCourse?.discountPrice ?? selectedCourse?.price) || 0)}</span> via Chapa after review.</p>
              </div>

              <button
                onClick={submitRegistration}
                disabled={submitting}
                className="w-full rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Submitting...</span>
                ) : (
                  "Submit & Continue to Payment"
                )}
              </button>
            </div>
          )}

          {/* STEP: summary */}
          {step === "summary" && (
            <div>
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Order Summary</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-gray-500">Course</dt>
                    <dd className="text-right font-medium text-navy">{pendingSummary?.courseTitle || selectedCourse?.title}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-gray-500">Schedule</dt>
                    <dd className="text-right font-medium text-navy">{pendingSummary?.scheduleText || "To be confirmed"}</dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                    <dt className="font-semibold text-gray-700">Total Amount</dt>
                    <dd className="text-lg font-bold text-gold">{formatBirr(amount || (selectedCourse?.discountPrice ?? selectedCourse?.price) || 0)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-gray-500">Currency</dt>
                    <dd className="font-medium text-navy">ETB</dd>
                  </div>
                </dl>
              </div>

              <div className="mt-4 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-navy">
                  <CreditCard size={16} className="text-gold" /> Pay Securely with Chapa
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  You&apos;ll pay in a secure Chapa window that opens over this page — this page stays open, and your registration is verified and confirmed automatically. Telebirr, CBE Birr, cards and more are supported.
                </p>
              </div>
              <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-white/70 px-3 py-2 text-xs text-gray-500">
                <Info size={13} className="mt-0.5 shrink-0 text-gold" />
                Your reference ID: <span className="font-semibold text-navy">{referenceId}</span>. Keep it — you can check your payment status with it anytime.
              </p>

              {payError && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{payError}</span>
                </div>
              )}

              <button
                onClick={startPayment}
                disabled={paying}
                className="mt-5 w-full rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                {paying ? (
                  <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Starting secure payment...</span>
                ) : (
                  `Pay ${formatBirr(amount || (selectedCourse?.discountPrice ?? selectedCourse?.price) || 0)} with Chapa`
                )}
              </button>
            </div>
          )}

          {/* STEP: processing — Chapa payment in a top-level window + live verification */}
          {step === "processing" && (
            <div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
                  <CreditCard size={26} className="text-gold" />
                </div>
                <h3 className="text-lg font-bold text-navy">Your payment is ready</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
                  Click the button to open Chapa&apos;s secure payment window (Telebirr, CBE Birr, cards and more).
                  This page stays open and your registration confirms here automatically the moment the payment goes through.
                </p>
              </div>

              {checkoutUrl && (
                <div className="mt-4 space-y-2">
                  {popupBlocked ? (
                    <a
                      href={checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setPopupBlocked(false)}
                      className="block w-full rounded-lg bg-gold px-5 py-3 text-center text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover hover:shadow-md"
                    >
                      Open Chapa Payment Window
                    </a>
                  ) : (
                    <button
                      onClick={() => {
                        const w = window.open(checkoutUrl, "chapa_payment", "popup=yes,width=470,height=740");
                        if (w) { popupRef.current = w; setPopupBlocked(false); }
                        else { popupRef.current = null; setPopupBlocked(true); }
                      }}
                      className="w-full rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover hover:shadow-md"
                    >
                      Open Chapa Payment Window
                    </button>
                  )}
                  <p className="text-center text-xs text-gray-400">
                    Window didn&apos;t open?{" "}
                    <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" onClick={() => setPopupBlocked(false)} className="font-medium text-gold underline-offset-2 hover:underline">
                      open it in a new tab
                    </a>
                  </p>
                </div>
              )}

              <div className="mx-auto mt-4 max-w-xs rounded-lg bg-warm-white px-4 py-3 text-left">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Your Reference ID</p>
                <p className="mt-1 text-base font-bold text-gold">{referenceId}</p>
              </div>

              {payError && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 text-left">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{payError}</span>
                </div>
              )}

              <div className="mt-4 space-y-2">
                <button onClick={verifyPayment} className="w-full rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover hover:shadow-md">
                  {pollingStopped ? "Check Payment Status" : "Check Status Now"}
                </button>
                {!pollingStopped && (
                  <button onClick={() => setPollingStopped(true)} className="w-full rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
                    I&apos;ll check later
                  </button>
                )}
              </div>
              <p className="mt-3 text-center text-xs text-gray-400">
                This page keeps watching for the payment — when Chapa confirms it, your registration completes right here. You can close it and continue later from the same page.
              </p>
            </div>
          )}

          {/* STEP: result */}
          {step === "result" && result && (
            <div>
              {result.status === "SUCCESS" ? (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                    <CheckCircle size={28} className="text-green-500" />
                  </div>
                  <h3 className="text-xl font-bold text-navy">Registration Successful!</h3>
                  <p className="mt-1 text-sm text-gray-500">Your spot is confirmed. Welcome to Nalik Academy!</p>

                  <div className="mt-5 space-y-2 rounded-xl border border-gray-200 p-4 text-left">
                    <div className="flex items-center justify-between text-sm">
                      <dt className="text-gray-500">Reference</dt>
                      <dd className="font-semibold text-gold">{result.registration?.referenceId}</dd>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <dt className="text-gray-500">Course</dt>
                      <dd className="font-medium text-navy">{result.registration?.course || "—"}</dd>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <dt className="text-gray-500">Schedule</dt>
                      <dd className="text-right font-medium text-navy">{result.registration?.schedule || "To be confirmed"}</dd>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <dt className="text-gray-500">Amount</dt>
                      <dd className="font-semibold text-navy">{formatBirr(result.registration?.amount || 0)} {result.registration?.currency || "ETB"}</dd>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <dt className="text-gray-500">Payment Status</dt>
                      <dd className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        <CheckCircle size={12} /> {result.registration?.paymentStatus || "SUCCESS"}
                      </dd>
                    </div>
                  </div>

                  <button onClick={handleClose} className="mt-5 w-full rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover hover:shadow-md">
                    Done
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
                    <AlertCircle size={28} className="text-amber-500" />
                  </div>
                  <h3 className="text-lg font-bold text-navy">
                    Payment {result.status === "FAILED" ? "Failed" : result.status === "CANCELLED" ? "Cancelled" : "Not Completed"}
                  </h3>
                  <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500">
                    {result.status === "FAILED"
                      ? "Your payment was not completed. You can try again — no charge is made until the payment is confirmed."
                      : result.status === "CANCELLED"
                        ? "You cancelled the payment. Your registration is still saved — you can pay anytime."
                        : "Your payment did not complete (timeout or was abandoned). You can retry below."}
                  </p>
                  <div className="mx-auto mt-4 max-w-xs rounded-lg bg-warm-white px-4 py-3 text-left">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Reference ID</p>
                    <p className="mt-0.5 text-sm font-bold text-gold">{referenceId}</p>
                  </div>
                  <div className="mt-5 space-y-2">
                    <button onClick={startPayment} disabled={paying} className="w-full rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover hover:shadow-md disabled:opacity-50">
                      {paying ? (<span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Starting...</span>) : "Try Again"}
                    </button>
                    <button onClick={handleClose} className="w-full rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}