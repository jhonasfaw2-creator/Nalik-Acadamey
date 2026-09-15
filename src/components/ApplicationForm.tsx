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

interface VerifyResponse {
  status: string; // PENDING / SUCCESS / FAILED / CANCELLED / INCOMPLETE
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
    txRef: string | null;
    chapaReference: string | null;
    registrationStatus: string;
  };
}

interface CheckoutConfig {
  publicKey: string;
  amount: number;
  currency: string;
  txRef: string;
  mobile: string;
}

type View = "form" | "checkout" | "result";
type ResultKind = "success" | "failed" | "cancelled" | "incomplete";

const INLINE_SCRIPT = "https://js.chapa.co/v1/inline.js";

function loadChapaScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.ChapaCheckout) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${INLINE_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Chapa checkout")));
      return;
    }
    const script = document.createElement("script");
    script.src = INLINE_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Chapa checkout"));
    document.head.appendChild(script);
  });
}

function formatBirr(amount: number) {
  return amount.toLocaleString("en-ET") + " Birr";
}

function getCheckoutBaseUrl(): string | undefined {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (parsed.protocol === "https:" && !/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(parsed.hostname)) {
        return parsed.origin;
      }
    } catch {
      // Fall through to the live origin if the configured URL is invalid.
    }
  }

  if (typeof window !== "undefined") {
    const origin = window.location.origin.replace(/\/$/, "");
    const host = new URL(origin).hostname;
    if (origin.startsWith("https://") && !/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(host)) {
      return origin;
    }
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3001";
  }

  return undefined;
}

function isPublicCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return !/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(parsed.hostname);
  } catch {
    return false;
  }
}

/** Session length in hours/minutes, e.g. "2 hours" or "1h 30m". */
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
  const [reloadKey, setReloadKey] = useState(0);

  // Selections
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");

  // Student information (uncontrolled inputs)
  const fullNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const ageRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  // Payment flow
  const [view, setView] = useState<View>("form");
  const [submitting, setSubmitting] = useState(false);
  const [referenceId, setReferenceId] = useState("");
  const [amount, setAmount] = useState(0);
  const [checkout, setCheckout] = useState<CheckoutConfig | null>(null);
  const [payError, setPayError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{ kind: ResultKind; message?: string; data?: VerifyResponse } | null>(null);
  const [paymentInFlight, setPaymentInFlight] = useState(false);

  // ── Load courses + schedules ──────────────────────────────
  useEffect(() => {
    if (!open) return;
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

    fetch("/api/schedules")
      .then((r) => r.json())
      .then((scheduleData) => {
        if (cancelled) return;
        if (scheduleData && Array.isArray(scheduleData.groups)) setScheduleGroups(scheduleData.groups);
      })
      .catch(() => {
        // schedules are optional until the student reaches that step
      });

    return () => { cancelled = true; };
  }, [open, preselectedCourse, reloadKey]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) dialog.showModal();
    else dialog.close();
  }, [open]);

  // The wizard is kept in memory across close/reopen so a student who steps
  // away returns to exactly where they were. It is only reset once a payment
  // has been confirmed.
  const resetForm = useCallback(() => {
    setView("form");
    setSelectedCourseId("");
    setSelectedGroupId("");
    setSelectedSessionId("");
    setReferenceId("");
    setAmount(0);
    setCheckout(null);
    setPayError("");
    setVerifying(false);
    setResult(null);
    setErrors({});
    setFormError("");
    if (fullNameRef.current) fullNameRef.current.value = "";
    if (emailRef.current) emailRef.current.value = "";
    if (phoneRef.current) phoneRef.current.value = "";
    if (ageRef.current) ageRef.current.value = "";
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onDialogClose = () => {
      if (result?.kind === "success") resetForm();
      onClose();
    };
    dialog.addEventListener("close", onDialogClose);
    return () => dialog.removeEventListener("close", onDialogClose);
  }, [onClose, result, resetForm]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const selectedGroup = scheduleGroups.find((g) => g.group === selectedGroupId) as ScheduleGroup | undefined;
  const selectedSession = selectedGroup?.sessions.find((s) => s.id === selectedSessionId);
  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const price = amount || (selectedCourse ? selectedCourse.discountPrice ?? selectedCourse.price : 0);
  const duration = computeDuration(selectedSession?.startTime, selectedSession?.endTime);
  const scheduleText =
    selectedGroup && selectedSession
      ? `Schedule ${selectedGroup.group}: ${selectedSession.session}`
      : "";
  const scheduleDays = selectedGroup?.days || "";

  const checkStatus = useCallback(async (ref: string): Promise<VerifyResponse | null> => {
    try {
      const res = await fetch(`/api/payments/verify?referenceId=${encodeURIComponent(ref)}`, { cache: "no-store" });
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  const classify = (status: string): ResultKind =>
    status === "SUCCESS" ? "success" : status === "CANCELLED" ? "cancelled" : status === "FAILED" ? "failed" : "incomplete";

  // ── Server-side verification (the only source of "success") ─
  const verify = useCallback(async (ref?: string) => {
    const id = ref || referenceId;
    if (!id) return;
    setVerifying(true);
    const data = await checkStatus(id);
    if (!data) {
      setVerifying(false);
      setPayError("Could not reach the payment service. Please try again.");
      return;
    }
    if (data.status === "SUCCESS") {
      setResult({ kind: "success", data });
      setView("result");
      return;
    }
    if (["FAILED", "CANCELLED", "INCOMPLETE"].includes(data.status)) {
      setResult({ kind: classify(data.status), data });
      setView("result");
      return;
    }
    // Still pending — keep waiting in the checkout view.
    setVerifying(false);
  }, [referenceId, checkStatus]);

  // ── Start / restart the Chapa Inline checkout ─────────────
  const openCheckout = useCallback(async (ref: string, rotate: boolean) => {
    if (paymentInFlight) return;
    setPayError("");
    setResult(null);
    setVerifying(false);
    setView("checkout");
    setPaymentInFlight(true);
    try {
      const res = await fetch("/api/payments/chapa/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceId: ref, rotate }),
      });
      const data = await res.json();

      if (res.ok && data.alreadyPaid) {
        await verify(ref);
        return;
      }
      if (res.ok && data.publicKey && data.txRef) {
        setCheckout({
          publicKey: data.publicKey,
          amount: Number(data.amount) || (selectedCourse ? selectedCourse.discountPrice ?? selectedCourse.price : 0),
          currency: data.currency || "ETB",
          txRef: data.txRef,
          mobile: data.mobile || "",
        });
        return;
      }
      setPayError(data.error || "Unable to start payment. Please try again.");
    } catch {
      setPayError("Network error. Please check your connection and try again.");
    } finally {
      setPaymentInFlight(false);
    }
  }, [paymentInFlight, verify, selectedCourse]);

  // ── PAY NOW: validate → create (or reuse) registration → checkout ─
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

  const payNow = async () => {
    setFormError("");
    const validationErrors = validateInfo();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setFormError("Please complete your information before paying.");
      return;
    }
    if (!selectedCourseId) { setFormError("Please choose a course."); return; }
    if (!selectedGroupId || !selectedSessionId) { setFormError("Please choose a schedule group and session."); return; }

    setSubmitting(true);
    try {
      let ref = referenceId;
      let createdNow = false;

      // Create the registration once. If it already exists (unique email +
      // course), reuse it — never create a duplicate.
      if (!ref) {
        const res = await fetch("/api/registrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: fullNameRef.current?.value?.trim(),
            email: emailRef.current?.value?.trim(),
            phone: phoneRef.current?.value?.trim(),
            age: Number(ageRef.current?.value?.trim()),
            courseId: selectedCourseId,
            scheduleId: selectedSessionId,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          ref = data.referenceId;
          setReferenceId(ref);
          setAmount(data.amount || price);
          createdNow = true;
        } else if (res.status === 409 && data.referenceId) {
          ref = data.referenceId;
          setReferenceId(ref);
          setAmount(price);
        } else {
          setFormError(data.error || "Something went wrong. Please try again.");
          return;
        }
      }

      // Reuse the tx_ref minted at registration only on this first attempt.
      await openCheckout(ref, !createdNow);
    } catch {
      setFormError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Chapa Inline.js mount ─────────────────────────────────
  useEffect(() => {
    if (view !== "checkout" || !checkout) return;
    let cancelled = false;

    loadChapaScript()
      .then(() => {
        if (cancelled) return;
        if (!window.ChapaCheckout) {
          setPayError("We couldn't load the secure payment form. Please try again.");
          return;
        }

        const appUrl = getCheckoutBaseUrl();
        if (!appUrl) {
          setPayError("This deployment is missing a valid HTTPS app URL. Add NEXT_PUBLIC_APP_URL in Vercel and redeploy.");
          return;
        }

        const callbackUrl = isPublicCallbackUrl(appUrl) ? `${appUrl}/api/webhooks/chapa` : undefined;
        const returnUrl = new URL(`/payment/return?referenceId=${encodeURIComponent(referenceId)}`, appUrl);

        const chapa = new window.ChapaCheckout({
          publicKey: checkout.publicKey,
          amount: String(checkout.amount),
          currency: checkout.currency,
          tx_ref: checkout.txRef,
          mobile: checkout.mobile || undefined,
          availablePaymentMethods: ["telebirr", "cbebirr", "ebirr", "mpesa", "chapa"],
          customizations: { buttonText: `Pay ${formatBirr(checkout.amount)}` },
          callbackUrl,
          // A return URL keeps Inline.js from showing its own success popup
          // before our server has verified the payment.
          returnUrl: returnUrl.toString(),
          onSuccessfulPayment: () => { verify(); },
          onPaymentFailure: (message: string) => {
            setResult({ kind: "failed", message: message || "The payment was not completed." });
            setView("result");
          },
          onClose: () => { verify(); },
        });
        chapa.initialize("chapa-inline-form");
      })
      .catch(() => {
        if (!cancelled) setPayError("We couldn't load the secure payment form. Please try again.");
      });

    return () => {
      cancelled = true;
      const container = document.getElementById("chapa-inline-form");
      if (container) container.innerHTML = "";
    };
  }, [view, checkout, referenceId, verify]);

  // Poll while the checkout is open so a delayed webhook still resolves the
  // flow even if Inline.js's callback does not fire.
  useEffect(() => {
    if (view !== "checkout" || !referenceId || result) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const data = await checkStatus(referenceId);
      if (cancelled || !data) return;
      if (data.status === "SUCCESS") {
        setResult({ kind: "success", data });
        setView("result");
      } else if (["FAILED", "CANCELLED", "INCOMPLETE"].includes(data.status)) {
        setResult({ kind: classify(data.status), data });
        setView("result");
      }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [view, referenceId, result, checkStatus]);

  const retry = () => {
    if (paymentInFlight) return;
    setResult(null);
    setPayError("");
    // A retry always mints a fresh tx_ref (reusing one that was already
    // charged is rejected by Chapa).
    if (referenceId) openCheckout(referenceId, true);
  };

  const backToForm = () => {
    setView("form");
    setResult(null);
    setPayError("");
    setCheckout(null);
    setPaymentInFlight(false);
  };

  const fieldClass = "w-full rounded-xl border border-gray-200 bg-[#f9faf8] px-3.5 py-2.75 text-sm text-navy placeholder:text-gray-400 transition-all focus:border-gold focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/20 disabled:bg-gray-50";
  const errorClass = "mt-1 text-xs text-red-500";
  const steps = [
    { label: "Course", done: Boolean(selectedCourseId) },
    { label: "Schedule", done: Boolean(selectedSessionId) },
    { label: "Details", done: Boolean(fullNameRef.current?.value || emailRef.current?.value || phoneRef.current?.value || ageRef.current?.value) },
    { label: "Review", done: false },
  ];

  return (
    <dialog ref={dialogRef} className="backdrop:bg-black/60 rounded-[28px] p-0 max-w-5xl w-[calc(100%-1.5rem)] max-h-[92vh]">
      <div className="bg-white rounded-[28px] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">Nalik Academy</p>
            <h2 className="mt-1 text-xl font-bold text-navy sm:text-2xl">
              {view === "form" ? "Secure your seat" : view === "checkout" ? "Complete payment" : "Registration update"}
            </h2>
          </div>
          <button onClick={() => dialogRef.current?.close()} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {view === "form" && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_360px]">
              <div className="space-y-5">
                <div className="rounded-2xl border border-[#efe7da] bg-[#fffaf1] p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                    <span>Checkout flow</span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] text-gold">Fast & secure</span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {steps.map((step, index) => (
                      <div key={step.label} className="flex items-center gap-2">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${step.done ? "bg-gold text-navy" : index === 0 ? "bg-navy text-white" : "bg-white text-gray-400 border border-gray-200"}`}>
                          {index + 1}
                        </div>
                        <span className={`hidden text-[11px] font-medium sm:block ${step.done ? "text-navy" : "text-gray-500"}`}>{step.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {formError && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Choose a course</h3>
                    <span className="text-[11px] font-medium text-gray-400">{courses.length} options</span>
                  </div>
                  {!coursesLoaded ? (
                    <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-400">
                      <Loader2 size={14} className="animate-spin" /> Loading courses...
                    </div>
                  ) : loadError && courses.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-center">
                      <p className="text-sm font-medium text-amber-800">{loadError}</p>
                      <button onClick={() => setReloadKey((k) => k + 1)} className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-700">
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {courses.map((c) => {
                        const coursePrice = c.discountPrice ?? c.price;
                        const isSelected = selectedCourseId === c.id;
                        return (
                          <label key={c.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-all ${isSelected ? "border-gold bg-[#fffaf1] shadow-sm" : "border-gray-200 hover:border-gold/50 hover:bg-[#fffaf1]/50"}`}>
                            <input
                              type="radio"
                              name="course"
                              value={c.id}
                              checked={isSelected}
                              onChange={(e) => { setSelectedCourseId(e.target.value); setSelectedGroupId(""); setSelectedSessionId(""); setFormError(""); }}
                              className="accent-gold"
                            />
                            <span className="flex-1">
                              <span className="flex items-start justify-between gap-3">
                                <span className="block text-sm font-semibold text-navy">{c.title}</span>
                                <span className="text-right">
                                  <span className="block text-base font-bold text-gold">{formatBirr(coursePrice)}</span>
                                  {c.discountPrice && <span className="block text-[10px] text-gray-400 line-through">{formatBirr(c.price)}</span>}
                                </span>
                              </span>
                              {c.discountLabel && <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{c.discountLabel}</span>}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Choose a schedule</h3>
                    <span className="text-[11px] font-medium text-gray-400">Availability</span>
                  </div>
                  {scheduleGroups.length === 0 ? (
                    <div className="rounded-xl bg-warm-white px-4 py-3 text-sm text-gray-500">
                      No schedule groups are open right now. Please try again later.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {scheduleGroups.map((g) => {
                        const groupSelected = selectedGroupId === g.group;
                        return (
                          <div key={g.group} className={`rounded-2xl border p-3 transition-all ${groupSelected ? "border-gold bg-[#fffaf1]" : "border-gray-200 bg-white"}`}>
                            <label className="flex cursor-pointer items-start gap-3">
                              <input
                                type="radio"
                                name="schedule-group"
                                value={g.group}
                                checked={groupSelected}
                                onChange={() => { setSelectedGroupId(g.group); setSelectedSessionId(""); setFormError(""); }}
                                className="mt-0.5 accent-gold"
                              />
                              <span className="flex-1">
                                <span className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-bold text-navy">Schedule {g.group}</span>
                                  {g.isFull ? <span className="text-[11px] font-bold text-red-500">Full</span> : <span className="text-[11px] text-gray-500">Open</span>}
                                </span>
                                <span className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                                  <Calendar size={11} /> {g.days}
                                </span>
                              </span>
                            </label>

                            {groupSelected && (
                              <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                                {g.sessions.map((s) => {
                                  const isFull = s.isFull;
                                  return (
                                    <label key={s.id} className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${selectedSessionId === s.id ? "border-gold bg-white" : "border-gray-200 hover:border-gold/50"}`}>
                                      <input
                                        type="radio"
                                        name="schedule-session"
                                        value={s.id}
                                        checked={selectedSessionId === s.id}
                                        onChange={() => { setSelectedSessionId(s.id); setFormError(""); }}
                                        disabled={isFull}
                                        className="mt-0.5 accent-gold"
                                      />
                                      <span className="flex-1">
                                        <span className="flex items-center justify-between gap-2">
                                          <span className="text-sm font-semibold text-navy">{s.session}</span>
                                          {isFull ? (
                                            <span className="text-[11px] font-bold text-red-500">Booked</span>
                                          ) : (
                                            <span className="text-[11px] font-medium text-gray-500">{s.seatsAvailable} seats</span>
                                          )}
                                        </span>
                                        <span className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                                          <span>{s.startTime} – {s.endTime}</span>
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

                <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Your details</h3>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label htmlFor="reg-name" className="mb-1.5 block text-sm font-medium text-gray-700">Full name <span className="text-gold">*</span></label>
                      <input ref={fullNameRef} id="reg-name" type="text" placeholder="e.g. Daniel Kebede" autoComplete="name" className={fieldClass} />
                      {errors.fullName && <p className={errorClass}>{errors.fullName}</p>}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="reg-email" className="mb-1.5 block text-sm font-medium text-gray-700">Email <span className="text-gold">*</span></label>
                        <input ref={emailRef} id="reg-email" type="email" placeholder="you@example.com" autoComplete="email" className={fieldClass} />
                        {errors.email && <p className={errorClass}>{errors.email}</p>}
                      </div>
                      <div>
                        <label htmlFor="reg-phone" className="mb-1.5 block text-sm font-medium text-gray-700">Phone <span className="text-gold">*</span></label>
                        <input ref={phoneRef} id="reg-phone" type="tel" placeholder="+251 9XX XXX XXX" autoComplete="tel" className={fieldClass} />
                        {errors.phone && <p className={errorClass}>{errors.phone}</p>}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="reg-age" className="mb-1.5 block text-sm font-medium text-gray-700">Age <span className="text-gold">*</span></label>
                      <input ref={ageRef} id="reg-age" type="number" min={10} max={99} placeholder="22" className={fieldClass} />
                      {errors.age && <p className={errorClass}>{errors.age}</p>}
                    </div>
                  </div>
                </section>
              </div>

              <aside className="lg:pt-2">
                <div className="lg:sticky lg:top-0">
                  <div className="rounded-2xl border border-gray-200 bg-[#fafaf8] p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Order summary</h3>
                      <span className="rounded-full bg-gold/10 px-2 py-1 text-[10px] font-semibold text-navy">Secure</span>
                    </div>

                    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                      <p className="text-sm font-semibold text-navy">{selectedCourse?.title || "Course not selected"}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                        <span>Schedule</span>
                        <span className="font-medium text-navy">{scheduleText || "Not selected"}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                        <span>Days</span>
                        <span className="font-medium text-navy">{scheduleDays || "—"}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                        <span>Duration</span>
                        <span className="font-medium text-navy">{duration || "—"}</span>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-navy p-4 text-white">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-white/70">Total</span>
                        <span className="text-2xl font-bold text-gold">{price ? formatBirr(price) : "—"}</span>
                      </div>
                      <p className="mt-2 text-[11px] text-white/65">Payment is processed securely through Chapa after review.</p>
                    </div>

                    <button
                      onClick={payNow}
                      disabled={submitting || paymentInFlight}
                      className="mt-4 w-full rounded-xl bg-gold px-5 py-3.5 text-base font-bold tracking-wide text-navy transition-all duration-200 hover:bg-gold-hover hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? (
                        <span className="inline-flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /> Processing…</span>
                      ) : (
                        "Continue to payment"
                      )}
                    </button>
                    <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] text-gray-500">
                      <Info size={12} className="mt-0.5 shrink-0 text-gold" />
                      No additional fees. Chapa only charges once your payment is confirmed.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          )}

          {/* ───────────── CHECKOUT (Chapa Inline.js) ───────────── */}
          {view === "checkout" && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
                  <CreditCard size={26} className="text-gold" />
                </div>
                <p className="text-sm text-gray-500">
                  Paying <span className="font-semibold text-gold">{formatBirr(checkout?.amount ?? price)}</span> securely with Chapa
                </p>
              </div>

              {verifying ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-12 text-sm text-gray-500">
                  <Loader2 size={22} className="animate-spin text-gold" />
                  Confirming your payment with Chapa…
                </div>
              ) : checkout ? (
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  {/* Chapa Inline.js mounts its payment form into this container. */}
                  <div id="chapa-inline-form" />
                </div>
              ) : payError ? (
                <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{payError}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-12 text-sm text-gray-500">
                  <Loader2 size={22} className="animate-spin text-gold" />
                  Preparing secure checkout…
                </div>
              )}

              {payError && checkout && (
                <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{payError}</span>
                </div>
              )}

              {payError && (
                <button onClick={retry} className="w-full rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover hover:shadow-md">
                  Try again
                </button>
              )}

              <button onClick={backToForm} className="w-full rounded-lg border border-gray-200 px-5 py-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50">
                Cancel payment
              </button>
            </div>
          )}

          {/* ───────────── RESULT ───────────── */}
          {view === "result" && result && (
            <div>
              {result.kind === "success" ? (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                    <CheckCircle size={28} className="text-green-500" />
                  </div>
                  <h3 className="text-xl font-bold text-navy">Payment Successful</h3>
                  <p className="mt-1 text-sm text-gray-500">Your registration is confirmed. Welcome to Nalik Academy!</p>

                  <div className="mt-5 space-y-2 rounded-xl border border-gray-200 p-4 text-left">
                    <div className="flex items-center justify-between text-sm">
                      <dt className="text-gray-500">Reference</dt>
                      <dd className="font-semibold text-gold">{result.data?.registration?.referenceId || referenceId}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3 text-sm">
                      <dt className="shrink-0 text-gray-500">Course</dt>
                      <dd className="text-right font-medium text-navy">{result.data?.registration?.course || selectedCourse?.title || "N/A"}</dd>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <dt className="text-gray-500">Schedule</dt>
                      <dd className="text-right font-medium text-navy">{scheduleText || "To be confirmed"}</dd>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <dt className="text-gray-500">Duration</dt>
                      <dd className="font-medium text-navy">{duration || "—"}</dd>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <dt className="text-gray-500">Amount</dt>
                      <dd className="font-semibold text-navy">{formatBirr(result.data?.registration?.amount || checkout?.amount || price)}</dd>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <dt className="text-gray-500">Payment Status</dt>
                      <dd className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        <CheckCircle size={12} /> {result.data?.registration?.paymentStatus || "SUCCESS"}
                      </dd>
                    </div>
                  </div>

                  <button onClick={() => dialogRef.current?.close()} className="mt-5 w-full rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover hover:shadow-md">
                    Done
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
                    <AlertCircle size={28} className="text-amber-500" />
                  </div>
                  <h3 className="text-lg font-bold text-navy">
                    {result.kind === "failed" ? "Payment Failed" : result.kind === "cancelled" ? "Payment Cancelled" : "Payment Not Completed"}
                  </h3>
                  <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500">
                    {result.message ||
                      (result.kind === "cancelled"
                        ? "You cancelled the payment. Your registration is still saved and can be paid anytime."
                        : "Your payment was not completed. You can try again — no charge is made until Chapa confirms the payment.")}
                  </p>
                  <p className="mx-auto mt-3 max-w-xs rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Your registration is saved as <span className="font-semibold">Pending Payment</span>. Retrying will not create a new registration.
                  </p>
                  <div className="mx-auto mt-4 max-w-xs rounded-lg bg-warm-white px-4 py-3 text-left">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Reference ID</p>
                    <p className="mt-0.5 text-sm font-bold text-gold">{referenceId}</p>
                  </div>
                  <div className="mt-5 space-y-2">
                    <button onClick={retry} className="w-full rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover hover:shadow-md">
                      Retry payment
                    </button>
                    <button onClick={backToForm} className="w-full rounded-lg border border-gray-200 px-5 py-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50">
                      ← Back to registration
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
