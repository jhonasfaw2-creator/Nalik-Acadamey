"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowRight, Play, Search, Loader2, X, CheckCircle2, Clock3, XCircle } from "lucide-react";

interface HeroProps {
  onApplyClick: () => void;
}

const DEFAULTS = {
  eyebrow: "Creative media training",
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
      label: "AWAITING PAYMENT",
      tone: "pending" as const,
      Icon: Clock3,
      message: "Your application is saved. Complete payment and submit your receipt to finish registration. You are not enrolled until payment is approved.",
    };
  };

  const statusInfo = lookupResult
    ? getStatusInfo(lookupResult.registrationStatus, lookupResult.paymentProofStatus)
    : null;
  const StatusIcon = statusInfo?.Icon ?? CheckCircle2;

  return (
    <section
      id="home"
      className="group relative min-h-[44rem] w-full overflow-hidden bg-navy sm:min-h-[680px] md:h-screen"
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
        onPlaying={() => setVideoLoaded(true)}
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
        <div className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-8 sm:py-20 lg:px-10">
          <div className="max-w-3xl">

            {/* Eyebrow */}
            <div className="hero-eyebrow mb-5 sm:mb-7">
              <span className="break-words text-sm font-medium text-gold">
                {content.eyebrow}
              </span>
            </div>

            {/* Main headline */}
            <h1 className="hero-title max-w-3xl text-[clamp(2.4rem,8vw,4.25rem)] font-semibold leading-[1.06] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[4.25rem]">
              {content.title}
            </h1>

            {/* Description */}
            <p className="hero-desc mt-5 max-w-[58ch] text-base leading-7 text-white/80 sm:mt-6 sm:text-lg sm:leading-8">
              {content.description}
            </p>

            {/* CTA */}
            <div className="hero-cta mt-7 flex flex-col items-stretch gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
              <button
                onClick={onApplyClick}
                className="action-primary group/btn inline-flex items-center justify-center gap-3"
              >
                Apply Now

                <ArrowRight
                  size={18}
                  className="transition-transform duration-200 group-hover/btn:translate-x-1"
                />
              </button>

              <button
                onClick={() => setLookupOpen(true)}
                className="inline-flex min-h-11 items-center justify-center gap-2 px-1 py-2 text-sm font-medium text-white/85 underline decoration-white/35 underline-offset-4 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-white sm:text-base"
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
                className="group/about inline-flex min-h-11 items-center justify-center gap-2.5 px-1 py-2 text-sm font-medium text-white/85 underline decoration-white/35 underline-offset-4 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-white sm:text-base"
              >
                <Play size={14} fill="currentColor" />

                Discover Nalik
              </button>
            </div>

            {/* Training highlights */}
            <div className="hero-meta mt-8 max-w-[58ch] text-sm leading-6 text-white/60 sm:mt-10">
              Practical training in Premiere Pro, DaVinci Resolve, and visual storytelling.
            </div>
          </div>
        </div>
      </div>

      {/* Registration lookup modal */}
      {lookupOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:max-h-[90dvh] sm:p-8">
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
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700" aria-label="Close"
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
                className="action-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto"
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
              <div className="mt-6 space-y-3">
                <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-2 py-2 sm:flex sm:justify-between sm:gap-4">
                  <span className="min-w-0 text-xs leading-5 text-gray-500 sm:text-sm">Student</span>
                  <span className="min-w-0 break-words text-right text-sm font-semibold text-navy">
                    {lookupResult.fullName}
                  </span>
                </div>
                <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-2 py-2 sm:flex sm:justify-between sm:gap-4">
                  <span className="min-w-0 text-xs leading-5 text-gray-500 sm:text-sm">Course</span>
                  <span className="min-w-0 break-words text-right text-sm font-medium text-navy">
                    {lookupResult.course || "To be confirmed"}
                  </span>
                </div>
                {lookupResult.schedule && (
                  <>
                    <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-2 py-2 sm:flex sm:justify-between sm:gap-4">
                      <span className="min-w-0 text-xs leading-5 text-gray-500 sm:text-sm">Schedule days</span>
                      <span className="min-w-0 break-words text-right text-sm font-medium text-navy">
                        {lookupResult.schedule.days || "To be confirmed"}
                      </span>
                    </div>
                    <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-2 py-2 sm:flex sm:justify-between sm:gap-4">
                      <span className="min-w-0 text-xs leading-5 text-gray-500 sm:text-sm">Class time</span>
                      <span className="min-w-0 break-words text-right text-sm font-medium text-navy">
                        {lookupResult.schedule.startTime && lookupResult.schedule.endTime
                          ? `${lookupResult.schedule.startTime} – ${lookupResult.schedule.endTime}`
                          : "To be confirmed"}
                      </span>
                    </div>
                    {lookupResult.schedule.startDate && (
                      <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-2 py-2 sm:flex sm:justify-between sm:gap-4">
                        <span className="min-w-0 text-xs leading-5 text-gray-500 sm:text-sm">Start date</span>
                        <span className="min-w-0 break-words text-right text-sm font-medium text-navy">
                          {lookupResult.schedule.startDate}
                        </span>
                      </div>
                    )}
                  </>
                )}
                <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-2 py-2 sm:flex sm:justify-between sm:gap-4">
                  <span className="min-w-0 text-xs leading-5 text-gray-500 sm:text-sm">Registration ID</span>
                  <span className="text-right text-sm font-mono font-semibold text-gold">
                    {lookupResult.referenceId}
                  </span>
                </div>
                <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-2 py-2 sm:flex sm:justify-between sm:gap-4">
                  <span className="min-w-0 text-xs leading-5 text-gray-500 sm:text-sm">Registration status</span>
                  <span className="text-right">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                      statusInfo!.tone === "success"
                        ? "text-green-700"
                        : statusInfo!.tone === "pending"
                          ? "text-amber-700"
                          : "text-red-700"
                    }`}>
                      <StatusIcon size={13} />
                      {statusInfo!.label}
                    </span>
                  </span>
                </div>
                <div className="mt-4 bg-amber-50 px-4 py-3.5">
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
