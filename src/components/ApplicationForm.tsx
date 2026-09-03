"use client";

import { useState, useRef, useEffect } from "react";
import { X, CheckCircle, Loader2, AlertCircle, Calendar } from "lucide-react";

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

const EXPERIENCE_OPTIONS = [
  "No experience",
  "Beginner — I've edited a few personal videos",
  "Intermediate — I edit regularly for social media or work",
  "Advanced — I have professional editing experience",
];

function formatBirr(amount: number) {
  return amount.toLocaleString("en-ET") + " Birr";
}

export default function ApplicationForm({ open, onClose, preselectedCourse }: ApplicationFormProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [referenceId, setReferenceId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [schedules, setSchedules] = useState<ScheduleOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [coursesLoaded, setCoursesLoaded] = useState(false);

  const fullNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const ageRef = useRef<HTMLInputElement>(null);
  const experienceRef = useRef<HTMLSelectElement>(null);
  const motivationRef = useRef<HTMLTextAreaElement>(null);

  // Fetch courses + schedules
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    Promise.all([
      fetch("/api/courses").then((r) => r.json()),
      fetch("/api/schedules").then((r) => r.json()),
    ]).then(([courseData, scheduleData]) => {
      if (cancelled) return;
      if (Array.isArray(courseData) && courseData.length > 0) {
        setCourses(courseData.map((c: CourseOption) => ({
          id: c.id,
          title: c.title,
          price: c.price,
          discountPrice: c.discountPrice,
          discountLabel: c.discountLabel,
        })));
      }
      if (Array.isArray(scheduleData)) {
        setSchedules(scheduleData);
      }
      setCoursesLoaded(true);
    }).catch(() => {
      if (!cancelled) setCoursesLoaded(true);
    });

    return () => { cancelled = true; };
  }, [open]);

  // Preselect course
  useEffect(() => {
    if (open && preselectedCourse && courses.length > 0) {
      const match = courses.find((c) => c.title === preselectedCourse || c.id === preselectedCourse);
      if (match) setSelectedCourseId(match.id);
    }
  }, [open, preselectedCourse, courses]);

  // Filter schedules for selected course
  const filteredSchedules = schedules.filter((s) => s.course.id === selectedCourseId);
  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  useEffect(() => {
    setSelectedScheduleId("");
  }, [selectedCourseId]);

  // Dialog management
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) dialog.showModal();
    else dialog.close();
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

  const resetForm = () => {
    setSubmitted(false);
    setReferenceId("");
    setErrors({});
    setServerError("");
    setSelectedCourseId("");
    setSelectedScheduleId("");
    if (fullNameRef.current) fullNameRef.current.value = "";
    if (emailRef.current) emailRef.current.value = "";
    if (phoneRef.current) phoneRef.current.value = "";
    if (ageRef.current) ageRef.current.value = "";
    if (experienceRef.current) experienceRef.current.value = "";
    if (motivationRef.current) motivationRef.current.value = "";
  };

  const handleClose = () => {
    resetForm();
    dialogRef.current?.close();
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    const name = fullNameRef.current?.value?.trim() || "";
    if (!name || name.length < 2) e.fullName = "Full name must be at least 2 characters";
    const email = emailRef.current?.value?.trim() || "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Please enter a valid email";
    const phone = phoneRef.current?.value?.trim() || "";
    if (!phone || phone.length < 8) e.phone = "Phone must be at least 8 digits";
    const age = Number(ageRef.current?.value?.trim() || 0);
    if (!age || isNaN(age) || age < 10 || age > 99 || !Number.isInteger(age)) e.age = "Enter a valid age (10–99)";
    if (!selectedCourseId) e.course = "Please select a course";
    const exp = experienceRef.current?.value?.trim() || "";
    if (!exp) e.experience = "Please select your experience level";
    const mot = motivationRef.current?.value?.trim() || "";
    if (mot.length < 10) e.motivation = "Tell us a bit more about your motivation";
    if (mot.length > 500) e.motivation = "Max 500 characters";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    setErrors({});

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

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
          previousExperience: experienceRef.current?.value?.trim(),
          motivation: motivationRef.current?.value?.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setReferenceId(data.referenceId || "");
        setSubmitted(true);
      } else if (res.status === 409) {
        setServerError(data.error || "Already registered for this course.");
        if (data.referenceId) setReferenceId(data.referenceId);
      } else {
        setServerError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = "w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy placeholder-gray-400 transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 disabled:bg-gray-50";
  const errorClass = "mt-1 text-xs text-red-500";

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
          {submitted ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                <CheckCircle size={32} className="text-green-500" />
              </div>
              <h3 className="text-lg font-bold text-navy">Registration Submitted</h3>
              {referenceId && (
                <div className="mt-4 rounded-lg bg-warm-white px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Your Reference ID</p>
                  <p className="mt-1 text-lg font-bold text-gold">{referenceId}</p>
                </div>
              )}
              <p className="mt-4 text-sm text-gray-500">
                Please save your reference ID. Complete payment to confirm your spot. We&apos;ll contact you shortly.
              </p>
              <button onClick={handleClose} className="mt-6 rounded-lg bg-navy px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-light">
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {serverError && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              {/* Course selection */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Course <span className="text-gold">*</span>
                </label>
                {!coursesLoaded ? (
                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-400">
                    <Loader2 size={14} className="animate-spin" /> Loading courses...
                  </div>
                ) : (
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="">Select a course</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} — {c.discountPrice ? `${formatBirr(c.discountPrice)} (${c.discountLabel})` : formatBirr(c.price)}
                      </option>
                    ))}
                  </select>
                )}
                {errors.course && <p className={errorClass}>{errors.course}</p>}
                {selectedCourse && (
                  <div className="mt-2 rounded-lg bg-warm-white px-3 py-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-gold">{formatBirr(selectedCourse.discountPrice ?? selectedCourse.price)}</span>
                      {selectedCourse.discountPrice && (
                        <span className="text-sm text-gray-400 line-through">{formatBirr(selectedCourse.price)}</span>
                      )}
                    </div>
                    {selectedCourse.discountLabel && (
                      <p className="mt-0.5 text-xs font-medium text-green-600">{selectedCourse.discountLabel}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Schedule selection */}
              {filteredSchedules.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Class Schedule
                  </label>
                  <div className="space-y-2">
                    {filteredSchedules.map((s) => {
                      const spotsLeft = s.maxSeats - s.enrolled;
                      const isFull = spotsLeft <= 0;
                      return (
                        <label
                          key={s.id}
                          className={`flex items-start gap-3 rounded-lg border p-3 transition-all cursor-pointer ${
                            selectedScheduleId === s.id
                              ? "border-gold bg-gold/5"
                              : isFull
                                ? "border-gray-100 bg-gray-50 opacity-60"
                                : "border-gray-200 hover:border-gold/50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="schedule"
                            value={s.id}
                            checked={selectedScheduleId === s.id}
                            onChange={(e) => setSelectedScheduleId(e.target.value)}
                            disabled={isFull}
                            className="mt-0.5 accent-gold"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-navy">{s.batchName}</p>
                              {isFull ? (
                                <span className="text-xs font-medium text-red-500">Full</span>
                              ) : (
                                <span className="text-xs text-gray-400">{spotsLeft} spots left</span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1"><Calendar size={11} /> {s.days}</span>
                              <span>{s.startTime} – {s.endTime}</span>
                              <span>Starts {new Date(s.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Personal fields */}
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
                <div>
                  <label htmlFor="reg-exp" className="mb-1 block text-sm font-medium text-gray-700">Experience <span className="text-gold">*</span></label>
                  <select ref={experienceRef} id="reg-exp" className={fieldClass}>
                    <option value="">Select level</option>
                    {EXPERIENCE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {errors.experience && <p className={errorClass}>{errors.experience}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="reg-motivation" className="mb-1 block text-sm font-medium text-gray-700">Why do you want to join? <span className="text-gold">*</span></label>
                <textarea ref={motivationRef} id="reg-motivation" rows={3} maxLength={500} placeholder="Tell us why you're interested..." className={fieldClass + " resize-none"} />
                {errors.motivation && <p className={errorClass}>{errors.motivation}</p>}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-gold px-5 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Submitting...</span>
                ) : (
                  "Submit Registration"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </dialog>
  );
}
