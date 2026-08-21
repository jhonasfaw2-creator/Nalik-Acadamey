"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useCallback } from "react";
import { CheckCircle, Send, Loader2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Zod schema ────────────────────────────────
const applicationSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  email: z.string().email("Please enter a valid email address"),
  age: z
    .string()
    .min(1, "Please enter your age")
    .refine((val) => !isNaN(Number(val)) && Number.isInteger(Number(val)), {
      message: "Please enter a valid age",
    })
    .refine((val) => Number(val) >= 14 && Number(val) <= 80, {
      message: "Age must be between 14 and 80",
    }),
  location: z.string().min(2, "Please enter your location"),
  program: z.string().min(1, "Please select a program"),
  skillLevel: z.string().min(1, "Please select your skill level"),
  previousExperience: z.string().min(1, "Please select your experience level"),
  schedule: z.string().min(1, "Please select a preferred schedule"),
  motivation: z
    .string()
    .min(20, "Please tell us a bit more (at least 20 characters)")
    .max(500, "Please keep your response under 500 characters"),

});

type ApplicationFormData = z.infer<typeof applicationSchema>;

const PROGRAMS = [
  { value: "davinci-resolve", label: "DaVinci Resolve" },
  { value: "adobe-premiere-pro", label: "Adobe Premiere Pro" },
];

const SKILL_LEVELS = [
  "Complete Beginner",
  "Some Experience",
  "Intermediate",
  "Advanced",
];

const EXPERIENCE_LEVELS = [
  "None - I'm just starting out",
  "Hobbyist - I've edited personal projects",
  "Freelancer - I've done paid work",
  "Professional - I work in the industry",
];

const SCHEDULES = [
  "Weekday Mornings",
  "Weekday Afternoons",
  "Weekday Evenings",
  "Weekends",
  "Flexible - I can adapt",
];

// ── Shared input classes ──────────────────────
const inputBase =
  "w-full rounded border border-navy/15 bg-white px-3.5 py-3 text-sm leading-normal text-navy placeholder:text-navy/30 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 transition-colors";

const labelBase = "block text-xs font-semibold text-navy/70 uppercase tracking-wider mb-1.5";

interface ApplicationFormProps {
  onSuccess?: (applicationId?: string) => void;
}

type SubmissionStatus = "idle" | "submitting" | "success" | "error";

export function ApplicationForm({ onSuccess }: ApplicationFormProps) {
  const [status, setStatus] = useState<SubmissionStatus>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    mode: "onBlur",
  });

  const clearError = useCallback(() => {
    setServerError(null);
    if (status === "error") {
      setStatus("idle");
    }
  }, [status]);

  const onSubmit = useCallback(
    async (data: ApplicationFormData) => {
      // Guard against duplicate submissions
      if (status === "submitting" || status === "success") return;

      setStatus("submitting");
      setServerError(null);

      try {
        const response = await fetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok) {
          const errorMessage =
            result.error || "Something went wrong. Please try again.";
          setServerError(errorMessage);
          setStatus("error");
          return;
        }

        // Success — reset form state and show confirmation
        reset();
        setApplicationId(result.applicationId || null);
        setStatus("success");
      } catch (err) {
        // Network error or unexpected failure
        console.error("Application submission failed:", err);
        setServerError(
          "Network error. Please check your connection and try again."
        );
        setStatus("error");
      }
    },
    [status, reset]
  );

  // ── Success state ─────────────────────────────
  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
        {/* Animated checkmark */}
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle className="h-10 w-10 text-emerald-500" aria-hidden="true" />
          </div>
          <div className="absolute -inset-2 rounded-full border-2 border-emerald-500/20" />
        </div>

        <h3 className="mt-6 text-2xl font-bold text-navy">
          Application Submitted!
        </h3>

        <p className="mt-4 max-w-md text-sm leading-relaxed text-navy/60">
          Thank you for applying to{" "}
          <span className="font-semibold text-navy">Nalik Academy</span>. Your
          application has been received and is being reviewed.
        </p>

        {applicationId && (
          <div className="mt-5 rounded border border-gold/20 bg-gold/5 px-5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-navy/40">
              Your Application Reference
            </p>
            <p className="mt-1 font-mono text-base font-bold text-gold">
              {applicationId.slice(0, 12)}
            </p>
          </div>
        )}

        <p className="mt-4 max-w-sm text-xs leading-relaxed text-navy/40">
          Our team will review your application and contact you within 2–3
          business days. You will receive an email once your application has been
          processed.
        </p>

        <button
          type="button"
          onClick={() => onSuccess?.(applicationId || undefined)}
          className="mt-7 inline-flex h-12 items-center gap-2 rounded bg-navy px-6 text-sm font-semibold text-white transition-colors duration-150 hover:bg-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4 p-5 sm:p-6"
      aria-label="Application form"
    >
      {/* ── Full Name ──────────────────────────── */}
      <div>
        <label htmlFor="fullName" className={labelBase}>
          Full Name *
        </label>
        <input
          id="fullName"
          type="text"
          autoComplete="name"
          placeholder="e.g. Abel Mekonnen"
          className={cn(inputBase, errors.fullName && "border-red-500 focus:border-red-500 focus:ring-red-200")}
          {...register("fullName")}
          onChange={(e) => {
            register("fullName").onChange(e);
            clearError();
          }}
          aria-invalid={!!errors.fullName}
          aria-describedby={errors.fullName ? "fullName-error" : undefined}
        />
        {errors.fullName && (
          <p id="fullName-error" className="mt-1 text-xs text-red-600" role="alert">
            {errors.fullName.message}
          </p>
        )}
      </div>

      {/* ── Phone + Email row ──────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className={labelBase}>
            Phone Number *
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+251 9XX XXX XXX"
            className={cn(inputBase, errors.phone && "border-red-500 focus:border-red-500 focus:ring-red-200")}
            {...register("phone")}
            onChange={(e) => {
              register("phone").onChange(e);
              clearError();
            }}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "phone-error" : undefined}
          />
          {errors.phone && (
            <p id="phone-error" className="mt-1 text-xs text-red-600" role="alert">
              {errors.phone.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="email" className={labelBase}>
            Email *
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={cn(inputBase, errors.email && "border-red-500 focus:border-red-500 focus:ring-red-200")}
            {...register("email")}
            onChange={(e) => {
              register("email").onChange(e);
              clearError();
            }}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p id="email-error" className="mt-1 text-xs text-red-600" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>
      </div>

      {/* ── Age + Location row ─────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="age" className={labelBase}>
            Age *
          </label>
          <input
            id="age"
            type="number"
            inputMode="numeric"
            min={14}
            max={80}
            placeholder="e.g. 22"
            className={cn(inputBase, errors.age && "border-red-500 focus:border-red-500 focus:ring-red-200")}
            {...register("age")}
            onChange={(e) => {
              register("age").onChange(e);
              clearError();
            }}
            aria-invalid={!!errors.age}
            aria-describedby={errors.age ? "age-error" : undefined}
          />
          {errors.age && (
            <p id="age-error" className="mt-1 text-xs text-red-600" role="alert">
              {errors.age.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="location" className={labelBase}>
            Location *
          </label>
          <input
            id="location"
            type="text"
            autoComplete="address-level2"
            placeholder="e.g. Addis Ababa"
            className={cn(inputBase, errors.location && "border-red-500 focus:border-red-500 focus:ring-red-200")}
            {...register("location")}
            onChange={(e) => {
              register("location").onChange(e);
              clearError();
            }}
            aria-invalid={!!errors.location}
            aria-describedby={errors.location ? "location-error" : undefined}
          />
          {errors.location && (
            <p id="location-error" className="mt-1 text-xs text-red-600" role="alert">
              {errors.location.message}
            </p>
          )}
        </div>
      </div>

      {/* ── Program ────────────────────────────── */}
      <div>
        <label htmlFor="program" className={labelBase}>
          Program / Course *
        </label>
        <select
          id="program"
          className={cn(
            inputBase,
            "appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23666%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_0.75rem_center] bg-no-repeat pr-10",
            errors.program && "border-red-500 focus:border-red-500 focus:ring-red-200"
          )}
          {...register("program")}
          onChange={(e) => {
            register("program").onChange(e);
            clearError();
          }}
          aria-invalid={!!errors.program}
          aria-describedby={errors.program ? "program-error" : undefined}
          defaultValue=""
        >
          <option value="" disabled>
            Select a program
          </option>
          {PROGRAMS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {errors.program && (
          <p id="program-error" className="mt-1 text-xs text-red-600" role="alert">
            {errors.program.message}
          </p>
        )}
      </div>

      {/* ── Skill Level ────────────────────────── */}
      <div>
        <label htmlFor="skillLevel" className={labelBase}>
          Current Skill Level *
        </label>
        <select
          id="skillLevel"
          className={cn(
            inputBase,
            "appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23666%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_0.75rem_center] bg-no-repeat pr-10",
            errors.skillLevel && "border-red-500 focus:border-red-500 focus:ring-red-200"
          )}
          {...register("skillLevel")}
          onChange={(e) => {
            register("skillLevel").onChange(e);
            clearError();
          }}
          aria-invalid={!!errors.skillLevel}
          aria-describedby={errors.skillLevel ? "skillLevel-error" : undefined}
          defaultValue=""
        >
          <option value="" disabled>
            Select your skill level
          </option>
          {SKILL_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        {errors.skillLevel && (
          <p id="skillLevel-error" className="mt-1 text-xs text-red-600" role="alert">
            {errors.skillLevel.message}
          </p>
        )}
      </div>

      {/* ── Previous Experience ─────────────────── */}
      <div>
        <label htmlFor="previousExperience" className={labelBase}>
          Previous Editing Experience *
        </label>
        <select
          id="previousExperience"
          className={cn(
            inputBase,
            "appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23666%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_0.75rem_center] bg-no-repeat pr-10",
            errors.previousExperience && "border-red-500 focus:border-red-500 focus:ring-red-200"
          )}
          {...register("previousExperience")}
          onChange={(e) => {
            register("previousExperience").onChange(e);
            clearError();
          }}
          aria-invalid={!!errors.previousExperience}
          aria-describedby={errors.previousExperience ? "previousExperience-error" : undefined}
          defaultValue=""
        >
          <option value="" disabled>
            Select your experience
          </option>
          {EXPERIENCE_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        {errors.previousExperience && (
          <p id="previousExperience-error" className="mt-1 text-xs text-red-600" role="alert">
            {errors.previousExperience.message}
          </p>
        )}
      </div>

      {/* ── Schedule ────────────────────────────── */}
      <div>
        <label htmlFor="schedule" className={labelBase}>
          Preferred Learning Schedule *
        </label>
        <select
          id="schedule"
          className={cn(
            inputBase,
            "appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23666%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_0.75rem_center] bg-no-repeat pr-10",
            errors.schedule && "border-red-500 focus:border-red-500 focus:ring-red-200"
          )}
          {...register("schedule")}
          onChange={(e) => {
            register("schedule").onChange(e);
            clearError();
          }}
          aria-invalid={!!errors.schedule}
          aria-describedby={errors.schedule ? "schedule-error" : undefined}
          defaultValue=""
        >
          <option value="" disabled>
            Select a schedule
          </option>
          {SCHEDULES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {errors.schedule && (
          <p id="schedule-error" className="mt-1 text-xs text-red-600" role="alert">
            {errors.schedule.message}
          </p>
        )}
      </div>

      {/* ── Motivation ─────────────────────────── */}
      <div>
        <label htmlFor="motivation" className={labelBase}>
          Why do you want to learn video editing? *
        </label>
        <textarea
          id="motivation"
          rows={3}
          maxLength={500}
          placeholder="Tell us about your goals and what drives your interest..."
          className={cn(
            inputBase,
            "resize-none",
            errors.motivation && "border-red-500 focus:border-red-500 focus:ring-red-200"
          )}
          {...register("motivation")}
          onChange={(e) => {
            register("motivation").onChange(e);
            clearError();
          }}
          aria-invalid={!!errors.motivation}
          aria-describedby={errors.motivation ? "motivation-error" : undefined}
        />
        <div className="flex items-center justify-between mt-1">
          {errors.motivation ? (
            <p id="motivation-error" className="text-xs text-red-600" role="alert">
              {errors.motivation.message}
            </p>
          ) : (
            <span />
          )}
        </div>
      </div>

      {/* ── Server error ────────────────────── */}
      {serverError && (
        <div
          className="flex items-start gap-2.5 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className="flex-1">{serverError}</span>
          <button
            type="button"
            onClick={clearError}
            className="flex-shrink-0 rounded p-0.5 text-red-400 transition-colors hover:text-red-600"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Submit ──────────────────────────────── */}
      <button
        type="submit"
        disabled={status === "submitting"}
        className={cn(
          "mt-2 flex h-12 items-center justify-center gap-2 rounded bg-gold px-6 text-sm font-bold text-navy transition-all duration-150",
          "hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
          "disabled:pointer-events-none disabled:opacity-60"
        )}
      >
        {status === "submitting" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" aria-hidden="true" />
            Submit Application
          </>
        )}
      </button>

      <p className="text-center text-[11px] text-navy/40">
        By submitting, you agree to be contacted regarding your application.
      </p>
    </form>
  );
}
