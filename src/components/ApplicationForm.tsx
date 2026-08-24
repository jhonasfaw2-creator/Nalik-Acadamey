"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, CheckCircle, Loader2, AlertCircle, RefreshCw } from "lucide-react";

interface CourseOption {
  id: string;
  title: string;
  price: string;
}

const FALLBACK_COURSES: CourseOption[] = [
  { id: "1", title: "Adobe Illustrator + Photoshop", price: "6,000 Birr" },
  { id: "2", title: "DaVinci Resolve", price: "8,000 Birr" },
  { id: "3", title: "Adobe Premiere", price: "8,000 Birr" },
];

interface ApplicationFormProps {
  open: boolean;
  onClose: () => void;
  preselectedCourse?: string;
}

const EXPERIENCE_OPTIONS = [
  "No experience",
  "Beginner — I've edited a few personal videos",
  "Intermediate — I edit regularly for social media or work",
  "Advanced — I have professional editing experience",
];

export default function ApplicationForm({
  open,
  onClose,
  preselectedCourse,
}: ApplicationFormProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [referenceId, setReferenceId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [networkError, setNetworkError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const [courseList, setCourseList] = useState<CourseOption[]>(FALLBACK_COURSES);
  const [coursesLoaded, setCoursesLoaded] = useState(false);

  const fullNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const ageRef = useRef<HTMLInputElement>(null);
  const courseRef = useRef<HTMLSelectElement>(null);
  const experienceRef = useRef<HTMLSelectElement>(null);
  const motivationRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/courses")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load courses");
        return r.json();
      })
      .then((d) => {
        if (!cancelled && Array.isArray(d) && d.length > 0) {
          setCourseList(d.map((c: { id: string; title: string; price: string }) => ({ id: c.id, title: c.title, price: c.price })));
        }
        setCoursesLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setCoursesLoaded(true);
      });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (open && preselectedCourse && courseRef.current) {
      courseRef.current.value = preselectedCourse;
    }
  }, [open, preselectedCourse]);

  const resetForm = useCallback(() => {
    setSubmitted(false);
    setReferenceId("");
    setErrors({});
    setServerError("");
    setNetworkError(false);
    setRetryCount(0);
    if (fullNameRef.current) fullNameRef.current.value = "";
    if (emailRef.current) emailRef.current.value = "";
    if (phoneRef.current) phoneRef.current.value = "";
    if (ageRef.current) ageRef.current.value = "";
    if (courseRef.current) courseRef.current.value = "";
    if (experienceRef.current) experienceRef.current.value = "";
    if (motivationRef.current) motivationRef.current.value = "";
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    dialogRef.current?.close();
  }, [resetForm]);

  const validate = useCallback((): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    const fullName = fullNameRef.current?.value?.trim() || "";
    if (!fullName || fullName.length < 2)
      newErrors.fullName = "Full name must be at least 2 characters";

    const email = emailRef.current?.value?.trim() || "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = "Please enter a valid email address";

    const phone = phoneRef.current?.value?.trim() || "";
    if (!phone || phone.length < 8)
      newErrors.phone = "Phone number must be at least 8 digits";

    const age = ageRef.current?.value?.trim() || "";
    const ageNum = Number(age);
    if (!age || isNaN(ageNum) || ageNum < 10 || ageNum > 99 || !Number.isInteger(ageNum))
      newErrors.age = "Please enter a valid age (10-99)";

    const courseSelection = courseRef.current?.value?.trim() || "";
    if (!courseSelection) newErrors.courseSelection = "Please select a course";

    const previousExperience = experienceRef.current?.value?.trim() || "";
    if (!previousExperience)
      newErrors.previousExperience = "Please describe your experience level";

    const motivation = motivationRef.current?.value?.trim() || "";
    if (motivation.length < 10)
      newErrors.motivation = "Please tell us a bit more about your motivation";
    if (motivation.length > 500)
      newErrors.motivation = "Motivation must be at most 500 characters";

    return newErrors;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    setNetworkError(false);
    setErrors({});

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);

    const values = {
      fullName: fullNameRef.current?.value?.trim() || "",
      email: emailRef.current?.value?.trim() || "",
      phone: phoneRef.current?.value?.trim() || "",
      age: Number(ageRef.current?.value?.trim() || 0),
      courseSelection: courseRef.current?.value?.trim() || "",
      previousExperience: experienceRef.current?.value?.trim() || "",
      motivation: motivationRef.current?.value?.trim() || "",
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: { success?: boolean; referenceId?: string; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        data = { error: "Invalid response from server" };
      }

      if (res.ok && data.success) {
        setReferenceId(data.referenceId || "");
        setSubmitted(true);
      } else if (res.status === 409) {
        setServerError(data.error || "You have already applied for this course.");
        if (data.referenceId) setReferenceId(data.referenceId);
      } else if (res.status >= 500) {
        setServerError(data.error || "Server error. Please try again later.");
      } else {
        setServerError(data.error || "Something went wrong. Please try again.");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setServerError("Request timed out. Please check your connection and try again.");
      } else {
        setNetworkError(true);
        setServerError("Network error. Please check your connection and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setServerError("");
    setNetworkError(false);
    setRetryCount((c) => c + 1);
  };

  const fieldClass =
    "w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy placeholder-gray-400 transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 disabled:bg-gray-50";

  const errorClass = "mt-1 text-xs text-red-500";

  return (
    <dialog
      ref={dialogRef}
      className="backdrop:bg-black/60 rounded-xl p-0 max-w-lg w-full max-h-[90vh]"
    >
      <div className="bg-white rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-xl font-bold text-navy">Apply to Nalik Academy</h2>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {submitted ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                <CheckCircle size={32} className="text-green-500" />
              </div>
              <h3 className="text-lg font-bold text-navy">Application Submitted Successfully</h3>
              {referenceId && (
                <div className="mt-4 rounded-lg bg-warm-white px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Your Reference ID</p>
                  <p className="mt-1 text-lg font-bold text-gold">{referenceId}</p>
                </div>
              )}
              <p className="mt-4 text-sm text-gray-500">
                Please save your reference ID. We will contact you shortly to discuss next steps.
              </p>
              <button
                onClick={handleClose}
                className="mt-6 rounded-lg bg-navy px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-light"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} key={retryCount} className="space-y-4">
              {serverError && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              {networkError && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/5 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/10"
                >
                  <RefreshCw size={14} /> Retry
                </button>
              )}

              <div>
                <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-gray-700">
                  Full Name <span className="text-gold">*</span>
                </label>
                <input
                  ref={fullNameRef}
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="e.g. Daniel Kebede"
                  autoComplete="name"
                  className={fieldClass}
                />
                {errors.fullName && <p className={errorClass}>{errors.fullName}</p>}
              </div>

              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                  Email <span className="text-gold">*</span>
                </label>
                <input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={fieldClass}
                />
                {errors.email && <p className={errorClass}>{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
                  Phone <span className="text-gold">*</span>
                </label>
                <input
                  ref={phoneRef}
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+251 9XX XXX XXX"
                  autoComplete="tel"
                  className={fieldClass}
                />
                {errors.phone && <p className={errorClass}>{errors.phone}</p>}
              </div>

              <div className="sm:w-1/2">
                <label htmlFor="age" className="mb-1 block text-sm font-medium text-gray-700">
                  Age <span className="text-gold">*</span>
                </label>
                <input
                  ref={ageRef}
                  id="age"
                  name="age"
                  type="number"
                  min={10}
                  max={99}
                  placeholder="e.g. 22"
                  className={fieldClass}
                />
                {errors.age && <p className={errorClass}>{errors.age}</p>}
              </div>

              <div>
                <label htmlFor="courseSelection" className="mb-1 block text-sm font-medium text-gray-700">
                  Course Selection <span className="text-gold">*</span>
                </label>
                <select
                  ref={courseRef}
                  id="courseSelection"
                  name="courseSelection"
                  className={fieldClass}
                  disabled={!coursesLoaded}
                >
                  <option value="">{coursesLoaded ? "Select a course" : "Loading courses..."}</option>
                  {courseList.map((c) => (
                    <option key={c.id} value={c.title}>{c.title} — {c.price}</option>
                  ))}
                </select>
                {errors.courseSelection && <p className={errorClass}>{errors.courseSelection}</p>}
              </div>

              <div>
                <label htmlFor="previousExperience" className="mb-1 block text-sm font-medium text-gray-700">
                  Previous Experience <span className="text-gold">*</span>
                </label>
                <select
                  ref={experienceRef}
                  id="previousExperience"
                  name="previousExperience"
                  className={fieldClass}
                >
                  <option value="">Select your level</option>
                  {EXPERIENCE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {errors.previousExperience && <p className={errorClass}>{errors.previousExperience}</p>}
              </div>

              <div>
                <label htmlFor="motivation" className="mb-1 block text-sm font-medium text-gray-700">
                  Why do you want to join? <span className="text-gold">*</span>
                </label>
                <textarea
                  ref={motivationRef}
                  id="motivation"
                  name="motivation"
                  rows={3}
                  maxLength={500}
                  placeholder="Tell us why you're interested in this course..."
                  className={fieldClass + " resize-none"}
                />
                {errors.motivation && <p className={errorClass}>{errors.motivation}</p>}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  "Submit Application"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </dialog>
  );
}
