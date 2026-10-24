"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowRight, Play, ChevronDown, Search, Loader2, X, CheckCircle2, Clock3, XCircle, User, School, CalendarDays, GraduationCap, Hash } from "lucide-react";

interface HeroProps {
  onApplyClick: () => void;
}

const DEFAULTS = {
  eyebrow: "NALIK ACADEMY · CREATIVE MEDIA",
  title: "Master the Art of Visual Storytelling",
  description:
    "Learn professional video editing and media production through practical training built around real creative work.",
  video: "/assets/hero/hero.mp4",
  poster: "/assets/hero/poster.jpg",
};

type LookupState = "idle" | "loading" | "found" | "error";

interface RegistrationLookupResult {
  referenceId: string;
  fullName: string;
  course: string | null;
  registrationStatus: string;
  paymentProofStatus: string | null;
  paymentProofNote: string | null;
  schedule: {
    days: string | null;
    session: string | null;
    group: string | null;
    startTime: string | null;
    endTime: string | null;
    startDate: string | null;
  } | null;
}

export default function Hero({ onApplyClick }: HeroProps) {
  const [content, setContent] = useState(DEFAULTS);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Registration lookup modal state
  const [lookupOpen, setLookupOpen] = useState(false);
  const [referenceId, setReferenceId] = useState("");
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [lookupError, setLookupError] = useState("");
  const [lookupResult, setLookupResult] = useState<RegistrationLookupResult | null>(null);

  useEffect(() => {
    fetch("/api/content?section=hero")
      .then((r) => r.json())
      .then((d) => {
        setContent((prev) => ({
          eyebrow: d.eyebrow || prev.eyebrow,
          title: d.title || prev.title,
          description: d.description || prev.description,
          video: d.video || prev.video,
          poster: d.poster || prev.poster,
        }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    const attemptPlay = () => {
      video.play().catch(() => {});
    };

    attemptPlay();

    video.addEventListener("canplay", attemptPlay);

    return () => {
      video.removeEventListener("canplay", attemptPlay);
    };
  }, [content.video]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = referenceId.trim().toUpperCase();
    if (!trimmed) {
      setLookupError("Please enter your registration ID.");
      setLookupState("error");
      return;
    }
    setLookupState("loading");
    setLookupError("");
    setLookupResult(null);
    try {
      const res = await fetch(
        `/api/registrations/lookup?id=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (data.found && data.registration) {
        setLookupResult({
          referenceId: data.registration.referenceId,
          fullName: data.registration.fullName,
          course: data.registration.course,
          registrationStatus: data.registration.registrationStatus,
          paymentProofStatus: data.registration.paymentProofStatus ?? null,
          paymentProofNote: data.registration.paymentProofNote ?? null,
          schedule: data.registration.schedule
            ? {
                days: data.registration.schedule.days ?? null,
                session: data.registration.schedule.session ?? null,
                group: data.registration.schedule.group ?? null,
                startTime: data.registration.schedule.startTime ?? null,
                endTime: data.registration.schedule.endTime ?? null,
                startDate: data.registration.schedule.startDate ?? null,
              }
            : null,
        });
        setLookupState("found");
      } else {
        setLookupError(data.error || "We couldn't find a registration with that ID.");
        setLookupState("error");
      }
    } catch {
      setLookupError("Something went wrong. Please check your connection and try again.");
      setLookupState("error");
    }
  };

  const getStatusInfo = (status: string, proofStatus: string | null) => {
    const enrolled = status === "PAID" || status === "CONFIRMED";
    if (enrolled) {
      return {
        label: "ENROLLED",
        tone: "success" as const,
        Icon: CheckCircle2,
        message: "Your registration is confirmed. You're enrolled and ready to start.",
      };
    }
    if (proofStatus === "PENDING_REVIEW") {
      return {
        label: "PAYMENT UNDER REVIEW",
        tone: "pending" as const,
        Icon: Clock3,
        message: "Your payment screenshot has been submitted and is awaiting admin review. Your place is not confirmed until approved.",
      };
    }
    if (proofStatus === "REJECTED") {
      return {
        label: "PAYMENT REJECTED",
        tone: "failed" as const,
        Icon: XCircle,
        message: `Your payment screenshot was rejected.${lookupResult?.paymentProofNote ? ` Reason: ${lookupResult.paymentProofNote}` : ""} You can upload a replacement screenshot to re-submit.`,
      };
    }
    return {
      label: "PENDING",
      tone: "pending" as const,
      Icon: Clock3,
      message: "Your registration has been received and is pending confirmation. Submit your payment screenshot to proceed.",
    };
  };

  const statusInfo = lookupResult
    ? getStatusInfo(lookupResult.registrationStatus, lookupResult.paymentProofStatus)
    : null;
  const StatusIcon = statusInfo?.Icon ?? CheckCircle2;

  return (
    <section
      id="home"
      className="group relative h-screen min-h-[680px] w-full overflow-hidden bg-navy"
    >
      {/* Background video */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={content.poster}
        onCanPlay={() => setVideoLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
          videoLoaded ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      >
        <source src={content.video} type="video/mp4" />
      </video>

      {/* Cinematic background fallback */}
      <img
        src={content.poster}
        alt=""
        loading="eager"
        fetchPriority="high"
        decoding="async"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
          videoLoaded ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* Readability overlay */}
      <div className="absolute inset-0 bg-navy/60" />

      {/* Main content */}
      <div className="relative z-10 flex h-full items-center">
        <div className="mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-10">
          <div className="max-w-3xl">

            {/* Eyebrow */}
            <div className="hero-eyebrow flex items-center gap-2 mb-8">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">
                {content.eyebrow}
              </span>
              <span className="h-px w-6 bg-gold shrink-0" />
            </div>

            {/* Main headline */}
            <h1 className="hero-title max-w-3xl text-5xl font-bold leading-[1.02] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[4.5rem]">
              {content.title}
            </h1>

            {/* Description */}
            <p className="hero-desc mt-8 max-w-xl text-lg leading-8 text-white/80">
              {content.description}
            </p>

            {/* CTA */}
            <div className="hero-cta mt-12 flex flex-wrap items-center gap-6">
              <button
                onClick={onApplyClick}
                className="group/btn inline-flex items-center justify-center gap-3 rounded-md bg-gold px-8 py-4 text-base font-semibold text-navy shadow-sm hover:bg-gold-hover transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-navy"
              >
                Apply Now

                <ArrowRight
                  size={18}
                  className="transition-transform duration-200 group-hover/btn:translate-x-1"
                />
              </button>

              <button
                onClick={() => setLookupOpen(true)}
                className="inline-flex items-center gap-2.5 rounded-md border border-white/30 px-7 py-4 text-base font-medium text-white transition-colors duration-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-navy"
              >
                <Search size={16} />
                Check Registration Status
              </button>

              <button
                onClick={() => {
                  document
                    .getElementById("about")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="group/about inline-flex items-center gap-2.5 rounded-md bg-white/10 px-7 py-4 text-base font-medium text-white transition-colors duration-200 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-navy"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 transition-all duration-200 group-hover/about:border-white/60">
                  <Play size={14} fill="currentColor" />
                </span>

                Discover Nalik
              </button>
            </div>

            {/* Training highlights */}
            <div className="hero-meta mt-16 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-white/15 pt-6">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-white/55">
                Premiere Pro
              </span>

              <span className="h-1 w-1 rounded-full bg-white/30" />

              <span className="text-xs font-medium uppercase tracking-[0.16em] text-white/55">
                DaVinci Resolve
              </span>

              <span className="h-1 w-1 rounded-full bg-white/30" />

              <span className="text-xs font-medium uppercase tracking-[0.16em] text-white/55">
                Practical Training
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 right-8 z-10 hidden items-center gap-3 sm:flex">
        <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/45">
          Scroll
        </span>

        <div className="flex h-9 w-6 items-start justify-center rounded-full border border-white/25 pt-2">
          <ChevronDown
            size={13}
            className="animate-bounce text-white/60"
          />
        </div>
      </div>

      {/* Mobile scroll indicator */}
      <div className="absolute bottom-7 left-1/2 z-10 -translate-x-1/2 sm:hidden">
        <ChevronDown
          size={20}
          className="animate-bounce text-white/60"
        />
      </div>

      {/* Registration lookup modal */}
      {lookupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-sm">
          <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2 mb-6">
              <h2 className="text-lg font-bold text-navy">Check Registration Status</h2>
              <button
                onClick={() => {
                  setLookupOpen(false);
                  setLookupState("idle");
                  setLookupResult(null);
                  setLookupError("");
                  setReferenceId("");
                }}
                className="text-gray-400 hover:text-gray-600" aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              Enter your registration ID to check your enrollment and payment review status.
            </p>

            <form onSubmit={handleLookup} className="space-y-4">
              <div>
                <label htmlFor="lookup-ref" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Registration ID
                </label>
                <input
                  id="lookup-ref"
                  name="lookup-ref"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value.toUpperCase())}
                  placeholder="NA-2026-XXXXXX"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 font-mono text-sm tracking-wide text-navy placeholder:font-sans placeholder:tracking-normal placeholder:text-gray-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                />
              </div>

              <button
                type="submit"
                disabled={lookupState === "loading" || !referenceId.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-6 py-3 text-sm font-bold text-navy transition-all duration-200 hover:bg-gold-hover disabled:opacity-50 w-full sm:w-auto"
              >
                {lookupState === "loading" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Search size={16} />
                )}
                {lookupState === "loading" ? "Checking…" : "Check Status"}
              </button>
            </form>

            {lookupError && (
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50 px-4 py-3.5" role="alert">
                <XCircle size={17} className="mt-0.5 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-red-700">{lookupError}</p>
                  <p className="mt-1 text-xs text-red-600/80">
                    Your registration ID was shown after you registered (format: NA-YYYY-XXXXXX).
                  </p>
                </div>
              </div>
            )}

            {lookupState === "found" && lookupResult && (
              <div className="mt-6 divide-y divide-gray-100">
                <div className="flex items-start justify-between gap-4 px-5 py-3.5">
                  <span className="flex shrink-0 items-center gap-2 text-sm text-gray-500">
                    <User size={15} className="text-gold" />
                    Student
                  </span>
                  <span className="text-right text-sm font-semibold text-navy">
                    {lookupResult.fullName}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4 px-5 py-3.5">
                  <span className="flex shrink-0 items-center gap-2 text-sm text-gray-500">
                    <School size={15} className="text-gold" />
                    Course
                  </span>
                  <span className="text-right text-sm font-medium text-navy">
                    {lookupResult.course || "To be confirmed"}
                  </span>
                </div>
                {lookupResult.schedule && (
                  <>
                    <div className="flex items-start justify-between gap-4 px-5 py-3.5">
                      <span className="flex shrink-0 items-center gap-2 text-sm text-gray-500">
                        <CalendarDays size={15} className="text-gold" />
                        Schedule days
                      </span>
                      <span className="text-right text-sm font-medium text-navy">
                        {lookupResult.schedule.days || "To be confirmed"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4 px-5 py-3.5">
                      <span className="flex shrink-0 items-center gap-2 text-sm text-gray-500">
                        <Clock3 size={15} className="text-gold" />
                        Class time
                      </span>
                      <span className="text-right text-sm font-medium text-navy">
                        {lookupResult.schedule.startTime && lookupResult.schedule.endTime
                          ? `${lookupResult.schedule.startTime} – ${lookupResult.schedule.endTime}`
                          : "To be confirmed"}
                      </span>
                    </div>
                    {lookupResult.schedule.startDate && (
                      <div className="flex items-start justify-between gap-4 px-5 py-3.5">
                        <span className="flex shrink-0 items-center gap-2 text-sm text-gray-500">
                          <GraduationCap size={15} className="text-gold" />
                          Start date
                        </span>
                        <span className="text-right text-sm font-medium text-navy">
                          {lookupResult.schedule.startDate}
                        </span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex items-start justify-between gap-4 px-5 py-3.5">
                  <span className="flex shrink-0 items-center gap-2 text-sm text-gray-500">
                    <Hash size={15} className="text-gold" />
                    Registration ID
                  </span>
                  <span className="text-right text-sm font-mono font-semibold text-gold">
                    {lookupResult.referenceId}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4 px-5 py-3.5">
                  <span className="flex shrink-0 items-center gap-2 text-sm text-gray-500">
                    <GraduationCap size={15} className="text-gold" />
                    Registration status
                  </span>
                  <span className="text-right">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      statusInfo!.tone === "success"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : statusInfo!.tone === "pending"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-red-50 text-red-700 border-red-200"
                    }`}>
                      <StatusIcon size={13} />
                      {statusInfo!.label}
                    </span>
                  </span>
                </div>
                <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3.5">
                  <p className="text-sm text-amber-700">
                    {statusInfo!.message}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}