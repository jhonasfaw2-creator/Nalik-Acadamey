"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
import { X, CheckCircle, Loader2 } from "lucide-react";

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

  const [courseList, setCourseList] = useState<CourseOption[]>(FALLBACK_COURSES);

  useEffect(() => {
    fetch("/api/courses")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d) && d.length > 0) {
          setCourseList(d.map((c: { id: string; title: string; price: string }) => ({ id: c.id, title: c.title, price: c.price })));
        }
      })
      .catch(() => {});
  }, []);

  const courseSelectRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (open && preselectedCourse && courseSelectRef.current) {
      courseSelectRef.current.value = preselectedCourse;
    }
  }, [open, preselectedCourse]);

  const resetForm = useCallback(() => {
    setSubmitted(false);
    setReferenceId("");
    setErrors({});
    setServerError("");
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    dialogRef.current?.close();
  }, [resetForm]);

  const validate = (data: Record<string, unknown>): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    const fullName = String(data.fullName || "").trim();
    if (!fullName || fullName.length < 2)
      newErrors.fullName = "Full name must be at least 2 characters";

    const email = String(data.email || "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = "Please enter a valid email address";

    const phone = String(data.phone || "").trim();
    if (!phone || phone.length < 8)
      newErrors.phone = "Phone number must be at least 8 digits";

    const age = Number(data.age);
    if (!age || age < 10 || age > 99 || !Number.isInteger(age))
      newErrors.age = "Please enter a valid age (10-99)";

    const courseSelection = String(data.courseSelection || "").trim();
    if (!courseSelection) newErrors.courseSelection = "Please select a course";

    const previousExperience = String(data.previousExperience || "").trim();
    if (!previousExperience)
      newErrors.previousExperience = "Please describe your experience level";

    const motivation = String(data.motivation || "").trim();
    if (motivation.length < 10)
      newErrors.motivation = "Please tell us a bit more about your motivation";
    if (motivation.length > 500)
      newErrors.motivation = "Motivation must be at most 500 characters";

    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError("");

    const form = e.currentTarget;
    const formData = new FormData(form);

    const values = {
      fullName: String(formData.get("fullName") || ""),
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || ""),
      age: Number(formData.get("age") || 0),
      courseSelection: String(formData.get("courseSelection") || ""),
      previousExperience: String(formData.get("previousExperience") || ""),
      motivation: String(formData.get("motivation") || ""),

    };

    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setReferenceId(data.referenceId);
        setSubmitted(true);
      } else if (res.status === 409) {
        setServerError(data.error || "You have already applied for this course.");
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

  const fieldClass =
    "w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-navy placeholder-gray-400 transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20";

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
            <form onSubmit={handleSubmit} className="space-y-4">
              {serverError && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                  {serverError}
                </div>
              )}

              <div>
                <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-gray-700">
                  Full Name <span className="text-gold">*</span>
                </label>
                <input id="fullName" name="fullName" type="text" placeholder="e.g. Daniel Kebede" autoComplete="name" className={fieldClass} />
                {errors.fullName && <p className={errorClass}>{errors.fullName}</p>}
              </div>

              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                  Email <span className="text-gold">*</span>
                </label>
                <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" className={fieldClass} />
                {errors.email && <p className={errorClass}>{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
                  Phone <span className="text-gold">*</span>
                </label>
                <input id="phone" name="phone" type="tel" placeholder="+251 9XX XXX XXX" autoComplete="tel" className={fieldClass} />
                {errors.phone && <p className={errorClass}>{errors.phone}</p>}
              </div>

              <div className="sm:w-1/2">
                <label htmlFor="age" className="mb-1 block text-sm font-medium text-gray-700">
                  Age <span className="text-gold">*</span>
                </label>
                <input id="age" name="age" type="number" min={10} max={99} placeholder="e.g. 22" className={fieldClass} />
                {errors.age && <p className={errorClass}>{errors.age}</p>}
              </div>

              <div>
                <label htmlFor="courseSelection" className="mb-1 block text-sm font-medium text-gray-700">
                  Course Selection <span className="text-gold">*</span>
                </label>
                <select id="courseSelection" name="courseSelection" ref={courseSelectRef} className={fieldClass}>
                  <option value="">Select a course</option>
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
                <select id="previousExperience" name="previousExperience" className={fieldClass}>
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
