"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  ChevronDown,
  Search,
  Loader2,
  X,
  CheckCircle2,
  Clock3,
  XCircle,
  Pause,
  Play,
} from "lucide-react";
import CopyButton from "@/components/CopyButton";
import { useLang, type Lang } from "@/hooks/useLang";

/* -------------------------------------------------------------------------- */
/*  Types and constants                                                        */
/* -------------------------------------------------------------------------- */

interface HeroProps {
  onApplyClick: () => void;
}

type LookupState = "idle" | "loading" | "found" | "error";
type Tone = "success" | "pending" | "failed";

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

interface LookupError {
  key?: "enterId" | "notFound" | "network";
  text?: string; // message supplied by the server
}

const PENDING_KEY = "nalik:pending-registration";
// Connections slower than this never start the background video.
const SKIP_VIDEO_CONNECTIONS = ["slow-2g", "2g"];

const DEFAULTS = {
  eyebrow: "Creative media training",
  title: "Master the Art of Visual Storytelling",
  description:
    "Learn professional video editing and media production through practical training built around real creative work.",
  video: "/assets/hero/hero.mp4",
  poster: "/assets/hero/poster.jpg",
  eyebrowAm: "",
  titleAm: "",
  descriptionAm: "",
};

const AM_DEFAULTS = {
  eyebrow: "የፈጠራ ሚዲያ ሥልጠና",
  title: "የምስል ታሪክ አተራረክ ጥበብን ይቆጣጠሩ",
  description:
    "በእውነተኛ የፈጠራ ሥራ ላይ በተመሠረተ ተግባራዊ ሥልጠና ሙያዊ የቪዲዮ ኤዲቲንግ እና የሚዲያ ፕሮዳክሽን ይማሩ።",
};

/** Amharic text if the CMS has it; the Amharic default only while the English text is still the default. */
function localize(lang: Lang, current: string, currentAm: string, defaultEn: string, defaultAm: string) {
  if (lang !== "am") return current;
  if (currentAm) return currentAm;
  return current === defaultEn ? defaultAm : current;
}

function readPendingId(): string {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return typeof parsed?.referenceId === "string" ? parsed.referenceId : "";
  } catch {
    return "";
  }
}

/* -------------------------------------------------------------------------- */
/*  Copy (English / Amharic). Have a native speaker review the Amharic.        */
/* -------------------------------------------------------------------------- */

const en = {
  apply: "Apply now",
  checkStatus: "Check registration status",
  discover: "Discover Nalik",
  highlightsLabel: "Practical training in",
  highlights: ["Premiere Pro", "DaVinci Resolve", "Visual storytelling"],
  lookupTitle: "Check registration status",
  lookupIntro: "Enter your registration ID to check your enrollment and payment review status.",
  idLabel: "Registration ID",
  idPlaceholder: "NA-2026-XXXXXX",
  idPrefilled: "We filled in the ID saved on this device.",
  check: "Check status",
  checking: "Checking…",
  enterId: "Please enter your registration ID.",
  notFound: "We couldn't find a registration with that ID.",
  network: "Something went wrong. Please check your connection and try again.",
  idHint: "Your registration ID was shown after you registered (format: NA-YYYY-XXXXXX).",
  student: "Student",
  course: "Course",
  scheduleDays: "Schedule days",
  classTime: "Class time",
  startDate: "Start date",
  regId: "Registration ID",
  regStatus: "Registration status",
  tbc: "To be confirmed",
  openRegistration: "Open registration page",
  close: "Close",
  pauseVideo: "Pause background video",
  playVideo: "Play background video",
  copy: "Copy",
  copied: "Copied",
  statusEnrolled: "Enrolled",
  statusEnrolledMsg: "Your registration is confirmed. You're enrolled and ready to start.",
  statusReview: "Payment under review",
  statusReviewMsg:
    "Your payment screenshot has been submitted and is awaiting admin review. Your place is not confirmed until approved.",
  statusRejected: "Payment rejected",
  statusRejectedMsg: (note: string | null) =>
    `Your payment screenshot was rejected.${note ? ` Reason: ${note}` : ""} You can upload a replacement screenshot to re-submit.`,
  statusAwaiting: "Awaiting payment",
  statusAwaitingMsg:
    "Your application is saved. Complete payment and submit your receipt to finish registration. You are not enrolled until payment is approved.",
};

const am: typeof en = {
  apply: "አሁን ያመልክቱ",
  checkStatus: "የምዝገባ ሁኔታ ይመልከቱ",
  discover: "ናሊክን ይወቁ",
  highlightsLabel: "ተግባራዊ ሥልጠና በ",
  highlights: ["Premiere Pro", "DaVinci Resolve", "የምስል ታሪክ አተራረክ"],
  lookupTitle: "የምዝገባ ሁኔታ ይመልከቱ",
  lookupIntro: "የምዝገባ እና የክፍያ ግምገማ ሁኔታዎን ለማየት የምዝገባ ቁጥርዎን ያስገቡ።",
  idLabel: "የምዝገባ ቁጥር",
  idPlaceholder: "NA-2026-XXXXXX",
  idPrefilled: "በዚህ መሳሪያ ላይ የተቀመጠውን ቁጥር ሞልተናል።",
  check: "ሁኔታን ተመልከት",
  checking: "በመፈተሽ ላይ…",
  enterId: "እባክዎ የምዝገባ ቁጥርዎን ያስገቡ።",
  notFound: "በዚህ ቁጥር የተመዘገበ ምዝገባ አላገኘንም።",
  network: "የሆነ ችግር ተፈጥሯል። ግንኙነትዎን አረጋግጠው እንደገና ይሞክሩ።",
  idHint: "የምዝገባ ቁጥርዎ ከተመዘገቡ በኋላ ታይቷል (ቅርጸት፦ NA-YYYY-XXXXXX)።",
  student: "ተማሪ",
  course: "ኮርስ",
  scheduleDays: "የመርሐ ግብር ቀናት",
  classTime: "የክፍል ሰዓት",
  startDate: "የመጀመሪያ ቀን",
  regId: "የምዝገባ ቁጥር",
  regStatus: "የምዝገባ ሁኔታ",
  tbc: "ይረጋገጣል",
  openRegistration: "የምዝገባ ገጽ ክፈት",
  close: "ዝጋ",
  pauseVideo: "የጀርባ ቪዲዮን አቁም",
  playVideo: "የጀርባ ቪዲዮን አጫውት",
  copy: "ቅዳ",
  copied: "ተቀድቷል",
  statusEnrolled: "ተመዝግበዋል",
  statusEnrolledMsg: "ምዝገባዎ ተረጋግጧል። ተመዝግበዋል፤ ለመጀመር ዝግጁ ነዎት።",
  statusReview: "ክፍያ በግምገማ ላይ",
  statusReviewMsg:
    "የክፍያ ስክሪንሾትዎ ገብቶ የአስተዳዳሪ ግምገማ እየጠበቀ ነው። እስኪጸድቅ ድረስ ቦታዎ አልተረጋገጠም።",
  statusRejected: "ክፍያ ውድቅ ሆኗል",
  statusRejectedMsg: (note) =>
    `የክፍያ ስክሪንሾትዎ ውድቅ ሆኗል።${note ? ` ምክንያት፦ ${note}` : ""} እንደገና ለማስገባት ምትክ ስክሪንሾት መላክ ይችላሉ።`,
  statusAwaiting: "ክፍያ በመጠባበቅ ላይ",
  statusAwaitingMsg:
    "ማመልከቻዎ ተቀምጧል። ምዝገባውን ለማጠናቀቅ ክፍያ ፈጽመው ደረሰኝዎን ያስገቡ። ክፍያ እስኪጸድቅ ድረስ አልተመዘገቡም።",
};

const STRINGS: Record<Lang, typeof en> = { en, am };

function getStatusInfo(t: typeof en, status: string, proofStatus: string | null, note: string | null) {
  if (status === "PAID" || status === "CONFIRMED") {
    return { label: t.statusEnrolled, tone: "success" as Tone, Icon: CheckCircle2, message: t.statusEnrolledMsg };
  }
  if (proofStatus === "PENDING_REVIEW") {
    return { label: t.statusReview, tone: "pending" as Tone, Icon: Clock3, message: t.statusReviewMsg };
  }
  if (proofStatus === "REJECTED") {
    return { label: t.statusRejected, tone: "failed" as Tone, Icon: XCircle, message: t.statusRejectedMsg(note) };
  }
  return { label: t.statusAwaiting, tone: "pending" as Tone, Icon: Clock3, message: t.statusAwaitingMsg };
}

const TONE_TEXT: Record<Tone, string> = {
  success: "text-green-700",
  pending: "text-amber-700",
  failed: "text-red-700",
};
const TONE_BOX: Record<Tone, string> = {
  success: "bg-green-50 text-green-800",
  pending: "bg-amber-50 text-amber-800",
  failed: "bg-red-50 text-red-800",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="min-w-0 text-sm text-gray-500">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-medium text-navy">{children}</dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function Hero({ onApplyClick }: HeroProps) {
  const { lang } = useLang();
  const t = STRINGS[lang];

  // Hero content from the CMS
  const [content, setContent] = useState(DEFAULTS);
  const [contentReady, setContentReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/content?section=hero")
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: Partial<typeof DEFAULTS>) => {
        if (cancelled) return;
        setContent((prev) => ({
          eyebrow: d.eyebrow || prev.eyebrow,
          title: d.title || prev.title,
          description: d.description || prev.description,
          video: d.video || prev.video,
          poster: d.poster || prev.poster,
          eyebrowAm: d.eyebrowAm || prev.eyebrowAm,
          titleAm: d.titleAm || prev.titleAm,
          descriptionAm: d.descriptionAm || prev.descriptionAm,
        }));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setContentReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const eyebrow = localize(lang, content.eyebrow, content.eyebrowAm, DEFAULTS.eyebrow, AM_DEFAULTS.eyebrow);
  const title = localize(lang, content.title, content.titleAm, DEFAULTS.title, AM_DEFAULTS.title);
  const description = localize(
    lang,
    content.description,
    content.descriptionAm,
    DEFAULTS.description,
    AM_DEFAULTS.description,
  );

  // Background video: opt-in only when the visitor's device and connection allow it
  const videoRef = useRef<HTMLVideoElement>(null);
  const [allowVideo, setAllowVideo] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoPaused, setVideoPaused] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    const saveData = connection?.saveData === true;
    const slow = SKIP_VIDEO_CONNECTIONS.includes(connection?.effectiveType ?? "");
    setAllowVideo(!reduceMotion && !saveData && !slow);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !allowVideo || videoPaused) return;
    const attemptPlay = () => {
      video.play().catch(() => {});
    };
    attemptPlay();
    video.addEventListener("canplay", attemptPlay);
    return () => video.removeEventListener("canplay", attemptPlay);
  }, [content.video, allowVideo, contentReady, videoPaused]);

  const toggleVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setVideoPaused(false);
      video.play().catch(() => {});
    } else {
      setVideoPaused(true);
      video.pause();
    }
  };

  // Registration lookup
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pointerDownOnBackdrop = useRef(false);
  const lookupSeq = useRef(0);

  const [lookupOpen, setLookupOpen] = useState(false);
  const [referenceId, setReferenceId] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [lookupError, setLookupError] = useState<LookupError | null>(null);
  const [lookupResult, setLookupResult] = useState<RegistrationLookupResult | null>(null);

  const runLookup = useCallback(async (rawId: string) => {
    const id = rawId.replace(/\s+/g, "").toUpperCase();
    if (!id) {
      setLookupError({ key: "enterId" });
      setLookupState("error");
      return;
    }
    const seq = ++lookupSeq.current; // ignore responses from older lookups
    setLookupState("loading");
    setLookupError(null);
    setLookupResult(null);
    try {
      const res = await fetch(`/api/registrations/lookup?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (seq !== lookupSeq.current) return;
      if (data.found && data.registration) {
        const r = data.registration;
        setLookupResult({
          referenceId: r.referenceId,
          fullName: r.fullName,
          course: r.course,
          registrationStatus: r.registrationStatus,
          paymentProofStatus: r.paymentProofStatus ?? null,
          paymentProofNote: r.paymentProofNote ?? null,
          schedule: r.schedule
            ? {
                days: r.schedule.days ?? null,
                session: r.schedule.session ?? null,
                group: r.schedule.group ?? null,
                startTime: r.schedule.startTime ?? null,
                endTime: r.schedule.endTime ?? null,
                startDate: r.schedule.startDate ?? null,
              }
            : null,
        });
        setLookupState("found");
      } else {
        setLookupError(typeof data.error === "string" && data.error ? { text: data.error } : { key: "notFound" });
        setLookupState("error");
      }
    } catch {
      if (seq !== lookupSeq.current) return;
      setLookupError({ key: "network" });
      setLookupState("error");
    }
  }, []);

  const openLookup = () => {
    const pending = readPendingId();
    if (pending) {
      setReferenceId(pending);
      setPrefilled(true);
      void runLookup(pending);
    } else {
      setPrefilled(false);
    }
    setLookupOpen(true);
  };

  const resetLookup = () => {
    lookupSeq.current += 1;
    setLookupOpen(false);
    setLookupState("idle");
    setLookupResult(null);
    setLookupError(null);
    setReferenceId("");
    setPrefilled(false);
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (lookupOpen && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => {
        if (inputRef.current && !inputRef.current.value) inputRef.current.focus();
      });
    } else if (!lookupOpen && dialog.open) {
      dialog.close();
    }
  }, [lookupOpen]);

  useEffect(() => {
    document.body.style.overflow = lookupOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [lookupOpen]);

  const handleLookupSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPrefilled(false);
    void runLookup(referenceId);
  };

  const statusInfo = lookupResult
    ? getStatusInfo(t, lookupResult.registrationStatus, lookupResult.paymentProofStatus, lookupResult.paymentProofNote)
    : null;
  const StatusIcon = statusInfo?.Icon ?? CheckCircle2;
  const lookupErrorMessage = lookupError ? (lookupError.text ?? (lookupError.key ? t[lookupError.key] : "")) : "";

  const scrollToAbout = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("about")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section
      id="home"
      className="relative flex min-h-[44rem] w-full items-center overflow-hidden bg-navy sm:min-h-[680px] md:h-[100svh]"
    >
      {/* Background video (only when allowed; waits for CMS so it never downloads twice) */}
      {allowVideo && contentReady && (
        <video
          key={content.video}
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={content.poster}
          onPlaying={() => setVideoLoaded(true)}
          onError={() => setVideoLoaded(false)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
            videoLoaded ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden="true"
        >
          <source src={content.video} type="video/mp4" />
        </video>
      )}

      {/* Poster: the full background when video is off, and the fallback while it loads */}
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

      {/* Readability overlay: stronger behind the text */}
      <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/60 to-navy/55 sm:bg-gradient-to-r sm:from-navy/85 sm:via-navy/60 sm:to-navy/30" />

      {/* Main content */}
      <div className="relative z-10 w-full">
        <div className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-8 sm:py-20 lg:px-10">
          <div className="max-w-3xl">
            <div className="hero-eyebrow mb-5 sm:mb-7">
              <span className="break-words text-sm font-medium text-gold">{eyebrow}</span>
            </div>

            <h1 className="hero-title max-w-3xl text-[clamp(2.4rem,8vw,4.25rem)] font-semibold leading-[1.06] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[4.25rem]">
              {title}
            </h1>

            <p className="hero-desc mt-5 max-w-[58ch] text-base leading-7 text-white/85 sm:mt-6 sm:text-lg sm:leading-8">
              {description}
            </p>

            {/* CTAs: one primary, one secondary, one text link */}
            <div className="hero-cta mt-7 flex flex-col items-stretch gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <button
                onClick={onApplyClick}
                className="action-primary group/btn inline-flex items-center justify-center gap-3"
              >
                {t.apply}
                <ArrowRight
                  size={18}
                  className="transition-transform duration-200 group-hover/btn:translate-x-1"
                />
              </button>

              <button
                onClick={openLookup}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/40 px-5 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-base"
              >
                <Search size={16} />
                {t.checkStatus}
              </button>

              <a
                href="#about"
                onClick={scrollToAbout}
                className="inline-flex min-h-11 items-center justify-center gap-2 px-2 py-2 text-sm font-medium text-white/85 underline decoration-white/35 underline-offset-4 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-base"
              >
                {t.discover}
                <ChevronDown size={16} />
              </a>
            </div>

            {/* Training highlights */}
            <div className="hero-meta mt-8 sm:mt-10">
              <p className="text-xs text-white/70">{t.highlightsLabel}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {t.highlights.map((item) => (
                  <li
                    key={item}
                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Pause / play control for the background video (WCAG 2.2.2) */}
      {allowVideo && videoLoaded && (
        <button
          type="button"
          onClick={toggleVideo}
          aria-label={videoPaused ? t.playVideo : t.pauseVideo}
          className="absolute bottom-4 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-navy/60 text-white backdrop-blur transition-colors hover:bg-navy/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {videoPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
        </button>
      )}

      {/* Registration lookup dialog */}
      <dialog
        ref={dialogRef}
        lang={lang}
        aria-labelledby="lookup-title"
        onClose={resetLookup}
        onMouseDown={(event) => {
          pointerDownOnBackdrop.current = event.target === event.currentTarget;
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && pointerDownOnBackdrop.current) dialogRef.current?.close();
        }}
        className="m-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-md overflow-y-auto rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm sm:max-h-[90dvh]"
      >
        <div className="p-4 sm:p-8">
          <div className="mb-5 flex items-start justify-between gap-2">
            <h2 id="lookup-title" className="text-lg font-bold text-navy">
              {t.lookupTitle}
            </h2>
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label={t.close}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <p className="mb-5 text-sm text-gray-600">{t.lookupIntro}</p>

          <form onSubmit={handleLookupSubmit} className="space-y-4">
            <div>
              <label htmlFor="lookup-ref" className="mb-1.5 block text-sm font-medium text-gray-700">
                {t.idLabel}
              </label>
              <input
                ref={inputRef}
                id="lookup-ref"
                name="lookup-ref"
                value={referenceId}
                onChange={(e) => {
                  setPrefilled(false);
                  setReferenceId(e.target.value.replace(/\s+/g, "").toUpperCase());
                }}
                placeholder={t.idPlaceholder}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-describedby={prefilled ? "lookup-prefilled" : undefined}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 font-mono text-sm tracking-wide text-navy placeholder:font-sans placeholder:tracking-normal placeholder:text-gray-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
              />
              {prefilled && (
                <p id="lookup-prefilled" className="mt-1.5 text-xs text-gray-500">
                  {t.idPrefilled}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={lookupState === "loading" || !referenceId.trim()}
              className="action-primary inline-flex w-full items-center justify-center gap-2 disabled:opacity-60 sm:w-auto"
            >
              {lookupState === "loading" ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {lookupState === "loading" ? t.checking : t.check}
            </button>
          </form>

          {lookupError && (
            <div
              className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50 px-4 py-3.5"
              role="alert"
            >
              <XCircle size={17} className="mt-0.5 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-700">{lookupErrorMessage}</p>
                {lookupError.key !== "enterId" && <p className="mt-1 text-xs text-red-600/80">{t.idHint}</p>}
              </div>
            </div>
          )}

          <div aria-live="polite">
            {lookupState === "found" && lookupResult && statusInfo && (
              <div className="mt-6">
                <dl className="divide-y divide-gray-100">
                  <Row label={t.student}>
                    <span className="font-semibold">{lookupResult.fullName}</span>
                  </Row>
                  <Row label={t.course}>{lookupResult.course || t.tbc}</Row>
                  {lookupResult.schedule && (
                    <>
                      <Row label={t.scheduleDays}>{lookupResult.schedule.days || t.tbc}</Row>
                      <Row label={t.classTime}>
                        {lookupResult.schedule.startTime && lookupResult.schedule.endTime
                          ? `${lookupResult.schedule.startTime} – ${lookupResult.schedule.endTime}`
                          : t.tbc}
                      </Row>
                      {lookupResult.schedule.startDate && (
                        <Row label={t.startDate}>{lookupResult.schedule.startDate}</Row>
                      )}
                    </>
                  )}
                  <Row label={t.regId}>
                    <span className="inline-flex flex-wrap items-center justify-end gap-2">
                      <span className="break-all font-mono font-semibold text-gold">{lookupResult.referenceId}</span>
                      <CopyButton value={lookupResult.referenceId} label={t.copy} copiedLabel={t.copied} />
                    </span>
                  </Row>
                  <Row label={t.regStatus}>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${TONE_TEXT[statusInfo.tone]}`}>
                      <StatusIcon size={14} />
                      {statusInfo.label}
                    </span>
                  </Row>
                </dl>

                <div className={`mt-4 rounded-lg px-4 py-3.5 ${TONE_BOX[statusInfo.tone]}`}>
                  <p className="text-sm">{statusInfo.message}</p>
                </div>

                <a
                  href={`/registration?id=${encodeURIComponent(lookupResult.referenceId)}`}
                  className="action-secondary mt-4 inline-flex w-full items-center justify-center gap-2"
                >
                  {t.openRegistration}
                  <ArrowRight size={16} />
                </a>
              </div>
            )}
          </div>
        </div>
      </dialog>
    </section>
  );
}
