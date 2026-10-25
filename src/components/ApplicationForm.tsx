"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  X,
  Loader2,
  Calendar,
  AlertCircle,
  ArrowRight,
  Check,
  Upload,
} from "lucide-react";
import PaymentInstructions from "@/components/PaymentInstructions";
import CopyButton from "@/components/CopyButton";
import { useLang, type Lang } from "@/hooks/useLang";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

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

interface CreatedRegistration {
  referenceId: string;
  amount: number;
  courseTitle?: string;
  /** Optional ISO date from the API if seats are held until a deadline. */
  holdUntil?: string;
}

type ReviewStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";
type FieldErrors = { name?: string; phone?: string; age?: string };

interface ApplicationFormProps {
  open: boolean;
  onClose: () => void;
  preselectedCourse?: string;
}

/* -------------------------------------------------------------------------- */
/*  Constants and helpers                                                      */
/* -------------------------------------------------------------------------- */

const PENDING_KEY = "nalik:pending-registration";
const LOW_SEATS_THRESHOLD = 5;
const MAX_RAW_IMAGE_BYTES = 25 * 1024 * 1024; // accepted before compression
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // enforced after compression
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Ethiopian mobile numbers: 09XXXXXXXX, 07XXXXXXXX, +2519XXXXXXXX, 2519XXXXXXXX, 9XXXXXXXX
const PHONE_RE = /^(?:\+251|251|0)?[79]\d{8}$/;

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

function readPending(): CreatedRegistration | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.referenceId === "string") {
      return {
        referenceId: parsed.referenceId,
        amount: typeof parsed.amount === "number" ? parsed.amount : 0,
        courseTitle: typeof parsed.courseTitle === "string" ? parsed.courseTitle : undefined,
        holdUntil: typeof parsed.holdUntil === "string" ? parsed.holdUntil : undefined,
      };
    }
  } catch {
    // storage unavailable or corrupt: behave as if nothing is stored
  }
  return null;
}

function writePending(value: CreatedRegistration) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function clearPending() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

/** Shrinks big phone screenshots/photos to a JPEG that comfortably fits the 5 MB limit. */
async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  if (file.type === "image/jpeg" && file.size <= 800 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff"; // flatten transparency (PNG/WebP) onto white
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "receipt";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

interface UploadResponse {
  ok: boolean;
  contentType: string;
  body: string;
}

function postReceipt(url: string, file: File, onProgress: (pct: number) => void): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = 90_000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        contentType: xhr.getResponseHeader("content-type") ?? "",
        body: xhr.responseText,
      });
    xhr.onerror = () => reject(new Error("NETWORK"));
    xhr.ontimeout = () => reject(new Error("NETWORK"));
    const data = new FormData();
    data.append("file", file);
    xhr.send(data);
  });
}

/* -------------------------------------------------------------------------- */
/*  Copy (English / Amharic). Have a native speaker review the Amharic.        */
/* -------------------------------------------------------------------------- */

const en = {
  academy: "Nalik Academy",
  titleRegister: "Register for a course",
  titlePay: "Complete your payment",
  close: "Close",
  steps: ["Course & schedule", "Your details", "Pay"],
  stepOf: (n: number) => `Step ${n} of 3`,
  chooseCourse: "Choose a course",
  available: (n: number) => `${n} available`,
  coursesFail: "We couldn't load the courses right now.",
  coursesFailConn: "We couldn't load the courses right now. Please check your connection.",
  tryAgain: "Try again",
  chooseSchedule: "Choose a schedule",
  schedulesFail: "We couldn't load schedules. Please check your connection and try again.",
  noSchedules: "No schedule groups are open right now. Please try again later.",
  scheduleLabel: (g: string) => `Schedule ${g}`,
  full: "Full",
  seats: (n: number) => `${n} seats`,
  lowSeats: (n: number) => `Only ${n} left`,
  yourDetails: "Your details",
  fullName: "Full name",
  phone: "Phone",
  age: "Age",
  namePh: "e.g. Daniel Kebede",
  phonePh: "09XX XXX XXX",
  nameInvalid: "Enter your full name.",
  phoneInvalid: "Enter a valid Ethiopian phone number, like 09XXXXXXXX.",
  ageInvalid: "Age must be between 10 and 99.",
  registrationSummary: "Registration summary",
  courseNotSelected: "Course not selected",
  schedule: "Schedule",
  days: "Days",
  duration: "Duration",
  total: "Total",
  notSelected: "Not selected",
  summaryNext: "You'll pay and upload your receipt on the next step.",
  save: "Save application",
  saving: "Saving application…",
  chooseFirst: "Choose a course and a schedule before continuing.",
  completeDetails: "Fix the highlighted fields before continuing.",
  applicationSaved: "Application saved",
  savedBody:
    "To complete registration, pay using the details below and submit your receipt. You are not enrolled until your payment is approved. Save your reference ID to check your status.",
  refId: "Reference ID",
  copy: "Copy",
  copied: "Copied",
  startNew: "Start a new registration",
  confirmNew:
    "Starting a new registration removes this reference ID from this device. Have you saved it?",
  payBy: (d: string) => `Pay by ${d} to keep your seat.`,
  uploadReceipt: "Upload your payment receipt",
  receiptHelp: "Use a clear screenshot or photo. JPG, PNG, or WebP. Large images are shrunk automatically.",
  chooseImage: "Choose an image",
  chooseDifferent: "Tap to choose a different image",
  preparing: "Preparing image…",
  submitProof: "Submit payment proof",
  uploading: (pct: number) => `Uploading receipt… ${pct}%`,
  wrongType: "Choose a JPG, PNG, or WebP image.",
  tooBig: "That image is still over 5 MB after shrinking. Choose a smaller one.",
  rawTooBig: "That file is too large. Choose an image under 25 MB.",
  receiptRejected: "The receipt was rejected. Upload a corrected image to request another review.",
  adminNote: "Admin note",
  paymentSubmitted: "Payment submitted",
  notifFailed:
    "Your proof is saved, but the academy could not be notified automatically. Please contact the academy to make sure it is reviewed.",
  contactAcademy: "Contact the academy",
  imageFailed:
    "The academy was notified, but Telegram could not display the receipt image. The proof is saved in the admin dashboard for review.",
  awaiting: (eta: string) =>
    `Your proof is awaiting review. Reviews usually take ${eta}. This page updates automatically if your payment is approved while you're here.`,
  eta: "a few hours",
  confirmed: "Registration confirmed",
  approvedBody: "Your payment was approved and your enrollment is complete.",
  viewStatus: "View registration status",
  viewConfirmation: "View enrollment confirmation",
  stalled:
    "We can't check your status automatically right now. Open your registration page to check it manually.",
  confirmClose:
    "You haven't submitted your payment yet. Your reference ID is saved on this device, so you can continue later. Close now?",
  submitFail: "We couldn't submit your registration. Please try again.",
  noRef:
    "Your registration was submitted, but we couldn't retrieve its reference ID. Please contact support.",
  wentWrong: "Something went wrong. Please try again.",
  uploadFail: "Upload failed. Try again.",
  networkError: "Network problem. Check your connection and try again.",
};

const am: typeof en = {
  academy: "ናሊክ አካዳሚ",
  titleRegister: "ለኮርስ ይመዝገቡ",
  titlePay: "ክፍያዎን ያጠናቅቁ",
  close: "ዝጋ",
  steps: ["ኮርስ እና መርሐ ግብር", "የእርስዎ መረጃ", "ክፍያ"],
  stepOf: (n) => `ደረጃ ${n} ከ 3`,
  chooseCourse: "ኮርስ ይምረጡ",
  available: (n) => `${n} ኮርሶች አሉ`,
  coursesFail: "ኮርሶችን አሁን መጫን አልተቻለም።",
  coursesFailConn: "ኮርሶችን አሁን መጫን አልተቻለም። እባክዎ ግንኙነትዎን ያረጋግጡ።",
  tryAgain: "እንደገና ይሞክሩ",
  chooseSchedule: "መርሐ ግብር ይምረጡ",
  schedulesFail: "መርሐ ግብሮችን መጫን አልተቻለም። ግንኙነትዎን አረጋግጠው እንደገና ይሞክሩ።",
  noSchedules: "አሁን ክፍት የሆነ መርሐ ግብር የለም። እባክዎ ቆይተው እንደገና ይሞክሩ።",
  scheduleLabel: (g) => `መርሐ ግብር ${g}`,
  full: "ሞልቷል",
  seats: (n) => `${n} መቀመጫዎች`,
  lowSeats: (n) => `${n} መቀመጫ ብቻ ቀርቷል`,
  yourDetails: "የእርስዎ መረጃ",
  fullName: "ሙሉ ስም",
  phone: "ስልክ",
  age: "ዕድሜ",
  namePh: "ለምሳሌ ዳንኤል ከበደ",
  phonePh: "09XX XXX XXX",
  nameInvalid: "ሙሉ ስምዎን ያስገቡ።",
  phoneInvalid: "ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ፣ ለምሳሌ 09XXXXXXXX።",
  ageInvalid: "ዕድሜ ከ10 እስከ 99 መሆን አለበት።",
  registrationSummary: "የምዝገባ ማጠቃለያ",
  courseNotSelected: "ኮርስ አልተመረጠም",
  schedule: "መርሐ ግብር",
  days: "ቀናት",
  duration: "የቆይታ ጊዜ",
  total: "ጠቅላላ",
  notSelected: "አልተመረጠም",
  summaryNext: "በሚቀጥለው ደረጃ ክፍያ ፈጽመው ደረሰኝዎን ይልካሉ።",
  save: "ማመልከቻ አስቀምጥ",
  saving: "ማመልከቻ በማስቀመጥ ላይ…",
  chooseFirst: "ከመቀጠልዎ በፊት ኮርስ እና መርሐ ግብር ይምረጡ።",
  completeDetails: "ከመቀጠልዎ በፊት ምልክት የተደረገባቸውን መስኮች ያስተካክሉ።",
  applicationSaved: "ማመልከቻዎ ተቀምጧል",
  savedBody:
    "ምዝገባውን ለማጠናቀቅ ከታች ባሉት መረጃዎች ክፍያ ፈጽመው ደረሰኝዎን ያስገቡ። ክፍያዎ እስኪጸድቅ ድረስ አልተመዘገቡም። ሁኔታዎን ለመከታተል የማጣቀሻ ቁጥርዎን ያስቀምጡ።",
  refId: "የማጣቀሻ ቁጥር",
  copy: "ቅዳ",
  copied: "ተቀድቷል",
  startNew: "አዲስ ምዝገባ ጀምር",
  confirmNew: "አዲስ ምዝገባ መጀመር የአሁኑን ማጣቀሻ ቁጥር ከዚህ መሳሪያ ያስወግዳል። ቁጥሩን አስቀምጠዋል?",
  payBy: (d) => `መቀመጫዎን ለማስጠበቅ እስከ ${d} ድረስ ይክፈሉ።`,
  uploadReceipt: "የክፍያ ደረሰኝዎን ያስገቡ",
  receiptHelp: "ግልጽ ስክሪንሾት ወይም ፎቶ ይጠቀሙ። JPG፣ PNG ወይም WebP። ትላልቅ ምስሎች በራስ-ሰር ይጨመቃሉ።",
  chooseImage: "ምስል ይምረጡ",
  chooseDifferent: "ሌላ ምስል ለመምረጥ ይንኩ",
  preparing: "ምስሉን በማዘጋጀት ላይ…",
  submitProof: "የክፍያ ማስረጃ ላክ",
  uploading: (pct) => `ደረሰኝ በመላክ ላይ… ${pct}%`,
  wrongType: "JPG፣ PNG ወይም WebP ምስል ብቻ ይምረጡ።",
  tooBig: "ምስሉ ከተጨመቀ በኋላም ከ5 ሜባ በላይ ነው። ትንሽ ምስል ይምረጡ።",
  rawTooBig: "ፋይሉ በጣም ትልቅ ነው። ከ25 ሜባ በታች የሆነ ምስል ይምረጡ።",
  receiptRejected: "ደረሰኙ ውድቅ ሆኗል። ሌላ ግምገማ ለመጠየቅ የተስተካከለ ምስል ያስገቡ።",
  adminNote: "የአስተዳዳሪ ማስታወሻ",
  paymentSubmitted: "ክፍያ ገብቷል",
  notifFailed:
    "ማስረጃዎ ተቀምጧል፤ ነገር ግን አካዳሚውን በራስ-ሰር ማሳወቅ አልተቻለም። እንዲገመገም እባክዎ አካዳሚውን ያነጋግሩ።",
  contactAcademy: "አካዳሚውን ያነጋግሩ",
  imageFailed:
    "አካዳሚው ተነግሮታል፤ ነገር ግን ቴሌግራም የደረሰኙን ምስል ማሳየት አልቻለም። ማስረጃው በአስተዳዳሪ ዳሽቦርድ ውስጥ ተቀምጧል።",
  awaiting: (eta) =>
    `ማስረጃዎ ግምገማ እየጠበቀ ነው። ብዙውን ጊዜ ግምገማ ${eta} ይወስዳል። እዚህ ሳሉ ክፍያዎ ከጸደቀ ይህ ገጽ በራስ-ሰር ይዘምናል።`,
  eta: "ጥቂት ሰዓታት",
  confirmed: "ምዝገባ ተረጋግጧል",
  approvedBody: "ክፍያዎ ጸድቋል፤ ምዝገባዎም ተጠናቋል።",
  viewStatus: "የምዝገባ ሁኔታ ይመልከቱ",
  viewConfirmation: "የምዝገባ ማረጋገጫ ይመልከቱ",
  stalled: "ሁኔታዎን በራስ-ሰር መፈተሽ አልተቻለም። እባክዎ የምዝገባ ገጽዎን ከፍተው ራስዎ ይመልከቱ።",
  confirmClose:
    "ክፍያዎን ገና አላስገቡም። የማጣቀሻ ቁጥርዎ በዚህ መሳሪያ ላይ ተቀምጧል፤ በኋላ መቀጠል ይችላሉ። አሁን መዝጋት ይፈልጋሉ?",
  submitFail: "ምዝገባዎን ማስገባት አልተቻለም። እባክዎ እንደገና ይሞክሩ።",
  noRef: "ምዝገባዎ ገብቷል፤ ነገር ግን የማጣቀሻ ቁጥሩን ማግኘት አልተቻለም። እባክዎ ድጋፍን ያነጋግሩ።",
  wentWrong: "የሆነ ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።",
  uploadFail: "መላክ አልተሳካም። እንደገና ይሞክሩ።",
  networkError: "የአውታረ መረብ ችግር። ግንኙነትዎን አረጋግጠው እንደገና ይሞክሩ።",
};

const STRINGS: Record<Lang, typeof en> = { en, am };

/* -------------------------------------------------------------------------- */
/*  Small presentational pieces                                                */
/* -------------------------------------------------------------------------- */

function RadioDot({ selected, disabled }: { selected: boolean; disabled?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
        selected ? "border-gold bg-gold" : disabled ? "border-gray-200 bg-gray-100" : "border-gray-300 bg-white"
      }`}
    >
      {selected && <div className="h-2 w-2 rounded-full bg-white" />}
    </div>
  );
}

function Stepper({ current, labels, stepOf }: { current: number; labels: string[]; stepOf: (n: number) => string }) {
  return (
    <div className="px-4 pb-3 sm:px-6" aria-label={stepOf(current)}>
      <div className="flex gap-1.5" aria-hidden="true">
        {labels.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i + 1 <= current ? "bg-gold" : "bg-gray-200"}`}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        <span className="font-semibold text-navy">{stepOf(current)}</span>
        {": "}
        {labels[current - 1]}
      </p>
    </div>
  );
}

function SkeletonRows({ count, className = "h-16" }: { count: number; className?: string }) {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${className} animate-pulse rounded-xl bg-gray-100`} />
      ))}
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-xs text-red-600" role="alert">
      {message}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function ApplicationForm({ open, onClose, preselectedCourse }: ApplicationFormProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pointerDownOnBackdrop = useRef(false);

  const { lang } = useLang();
  const t = useMemo(() => STRINGS[lang], [lang]);

  // Course & schedule data
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [scheduleGroups, setScheduleGroups] = useState<ScheduleGroup[]>([]);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Selections
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");

  // Student information (uncontrolled inputs)
  const fullNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const ageRef = useRef<HTMLInputElement>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [registrationCreated, setRegistrationCreated] = useState<CreatedRegistration | null>(null);

  // Payment proof
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isPreparingProof, setIsPreparingProof] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [proofUploaded, setProofUploaded] = useState(false);
  const [proofUploadError, setProofUploadError] = useState("");
  const [proofNotificationFailed, setProofNotificationFailed] = useState(false);
  const [proofImageDeliveryFailed, setProofImageDeliveryFailed] = useState(false);
  const [proofReviewStatus, setProofReviewStatus] = useState<ReviewStatus | null>(null);
  const [proofReviewNote, setProofReviewNote] = useState<string | null>(null);
  const [statusCheckStalled, setStatusCheckStalled] = useState(false);

  /* ----------------------------- derived values ---------------------------- */

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const selectedGroup = scheduleGroups.find((g) => g.sessions.some((s) => s.id === selectedSessionId));
  const selectedSession = selectedGroup?.sessions.find((s) => s.id === selectedSessionId);
  const duration = computeDuration(selectedSession?.startTime, selectedSession?.endTime);
  const scheduleText =
    selectedGroup && selectedSession ? `${t.scheduleLabel(selectedGroup.group)}: ${selectedSession.session}` : "";
  const scheduleDays = selectedGroup?.days || "";
  const coursePrice = selectedCourse ? (selectedCourse.discountPrice ?? selectedCourse.price) : null;

  const currentStep = registrationCreated ? 3 : selectedCourseId && selectedSessionId ? 2 : 1;

  const fieldClass =
    "w-full rounded-xl border border-gray-200 bg-[#f9faf8] px-3.5 py-3 text-sm text-navy placeholder:text-gray-400 transition-all focus:border-gold focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/20 disabled:bg-gray-50 aria-[invalid=true]:border-red-400 aria-[invalid=true]:bg-red-50/40";

  const sectionCardClass = "rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5";

  /* ------------------------------ close handling --------------------------- */

  const requestClose = useCallback(() => {
    const needsConfirm = Boolean(registrationCreated) && !proofUploaded;
    if (needsConfirm && !window.confirm(t.confirmClose)) return;
    dialogRef.current?.close();
  }, [registrationCreated, proofUploaded, t]);

  const startNewRegistration = () => {
    if (!window.confirm(t.confirmNew)) return;
    clearPending();
    setRegistrationCreated(null);
    resetProofState();
    setFormError("");
  };

  function resetProofState() {
    setPaymentProofFile(null);
    setProofPreview(null);
    setProofUploaded(false);
    setProofNotificationFailed(false);
    setProofImageDeliveryFailed(false);
    setProofReviewStatus(null);
    setProofReviewNote(null);
    setProofUploadError("");
    setStatusCheckStalled(false);
    setUploadProgress(0);
  }

  /* ------------------------------ proof picking ---------------------------- */

  useEffect(() => {
    if (!proofPreview) return;
    return () => URL.revokeObjectURL(proofPreview);
  }, [proofPreview]);

  const handlePaymentProofChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    setProofUploadError("");
    setProofNotificationFailed(false);

    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setPaymentProofFile(null);
      setProofPreview(null);
      setProofUploadError(t.wrongType);
      return;
    }
    if (file.size > MAX_RAW_IMAGE_BYTES) {
      setPaymentProofFile(null);
      setProofPreview(null);
      setProofUploadError(t.rawTooBig);
      return;
    }

    setIsPreparingProof(true);
    const prepared = await compressImage(file);
    setIsPreparingProof(false);

    if (prepared.size > MAX_UPLOAD_BYTES) {
      setPaymentProofFile(null);
      setProofPreview(null);
      setProofUploadError(t.tooBig);
      return;
    }

    setPaymentProofFile(prepared);
    setProofPreview(URL.createObjectURL(prepared));
  };

  /* --------------------------- load courses + schedules -------------------- */

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadError("");
    setScheduleError("");
    setCoursesLoaded(false);
    setSchedulesLoaded(false);

    fetch("/api/courses")
      .then((r) => r.json())
      .then((courseData) => {
        if (cancelled) return;
        if (Array.isArray(courseData)) {
          const mapped: CourseOption[] = courseData.map((c: CourseOption) => ({
            id: c.id,
            title: c.title,
            price: c.price,
            discountPrice: c.discountPrice,
            discountLabel: c.discountLabel,
          }));
          setCourses(mapped);
          const match = preselectedCourse ? mapped.find((c) => c.title === preselectedCourse) : undefined;
          // keep a still-valid selection, otherwise fall back to the preselected course
          setSelectedCourseId((current) =>
            current && mapped.some((c) => c.id === current) ? current : (match?.id ?? ""),
          );
        } else {
          setLoadError(t.coursesFail);
        }
        setCoursesLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(t.coursesFailConn);
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
            const groups: ScheduleGroup[] = scheduleData.groups;
            const openSessions = groups.flatMap((g) => g.sessions).filter((s) => !s.isFull);
            setScheduleGroups(groups);
            setScheduleError("");
            // drop a selection that is gone or full; auto-pick when only one session is open
            setSelectedSessionId((current) =>
              openSessions.some((s) => s.id === current)
                ? current
                : openSessions.length === 1
                  ? openSessions[0].id
                  : "",
            );
            setSchedulesLoaded(true);
          }
          return;
        } catch {
          if (attempt === 0 && !cancelled) {
            await new Promise((resolve) => setTimeout(resolve, 1_000));
          }
        }
      }
      if (!cancelled) {
        setScheduleError(t.schedulesFail);
        setSchedulesLoaded(true);
      }
    };
    void loadSchedules();

    return () => {
      cancelled = true;
    };
    // `t` is intentionally excluded: switching language must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselectedCourse, reloadKey]);

  /* ------------------------------- dialog open ----------------------------- */

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      // restore an unfinished registration so closing the dialog never loses the reference ID
      setRegistrationCreated(readPending());
      resetProofState();
      setFormError("");
      setFieldErrors({});
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // When resuming a stored registration, find out whether a receipt was already sent.
  useEffect(() => {
    if (!open) return;
    const stored = readPending();
    if (!stored) return;
    let cancelled = false;

    fetch(`/api/registrations/lookup?id=${encodeURIComponent(stored.referenceId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const registration = data.registration;
        const status = registration?.paymentProofStatus;
        if (status === "APPROVED" || registration?.registrationStatus === "CONFIRMED") {
          setProofReviewStatus("APPROVED");
          setProofUploaded(true);
          clearPending();
        } else if (status === "PENDING_REVIEW") {
          setProofReviewStatus("PENDING_REVIEW");
          setProofUploaded(true);
        } else if (status === "REJECTED") {
          setProofReviewStatus("REJECTED");
          setProofReviewNote(typeof registration.paymentProofNote === "string" ? registration.paymentProofNote : null);
        }
      })
      .catch(() => {
        // offline: the student can still upload; nothing to do
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Move focus to the heading when the payment stage appears.
  useEffect(() => {
    if (!registrationCreated?.referenceId) return;
    const id = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [registrationCreated?.referenceId]);

  /* ------------------------- review-status polling ------------------------- */

  useEffect(() => {
    const referenceId = registrationCreated?.referenceId;
    if (!open || !proofUploaded || !referenceId) return;

    let stopped = false;
    let timer: number | undefined;
    let delay = 3_000;
    let failures = 0;
    setStatusCheckStalled(false);

    const schedule = () => {
      if (!stopped) timer = window.setTimeout(checkReviewStatus, delay);
    };

    const checkReviewStatus = async () => {
      // don't burn data while the tab is in the background
      if (document.hidden) {
        schedule();
        return;
      }
      try {
        const response = await fetch(`/api/registrations/lookup?id=${encodeURIComponent(referenceId)}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Registration status is unavailable.");
        const data = await response.json();
        failures = 0;
        setStatusCheckStalled(false);
        const registration = data?.registration;
        const status = registration?.paymentProofStatus;

        if (status === "APPROVED" || registration?.registrationStatus === "CONFIRMED") {
          stopped = true;
          setProofReviewStatus("APPROVED");
          clearPending();
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
        failures += 1;
        if (failures >= 5) setStatusCheckStalled(true);
      } finally {
        if (!stopped) {
          delay = Math.min(15_000, Math.round(delay * 1.5));
          schedule();
        }
      }
    };

    const onVisibility = () => {
      if (!document.hidden && !stopped) {
        window.clearTimeout(timer);
        void checkReviewStatus();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    void checkReviewStatus();
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [open, proofUploaded, registrationCreated?.referenceId]);

  /* --------------------------- dialog plumbing ----------------------------- */

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

  useEffect(() => {
    setFormError("");
  }, [selectedCourseId, selectedSessionId]);

  /* ------------------------------ validation ------------------------------- */

  const validateName = useCallback(
    (value: string) => (value.trim().length >= 3 ? undefined : t.nameInvalid),
    [t],
  );
  const validatePhone = useCallback(
    (value: string) => (PHONE_RE.test(value.replace(/[\s-]/g, "")) ? undefined : t.phoneInvalid),
    [t],
  );
  const validateAge = useCallback(
    (value: string) => {
      const age = Number(value);
      return Number.isInteger(age) && age >= 10 && age <= 99 ? undefined : t.ageInvalid;
    },
    [t],
  );

  const validators = { name: validateName, phone: validatePhone, age: validateAge } as const;

  const handleFieldBlur = (key: keyof FieldErrors) => (event: { currentTarget: HTMLInputElement }) => {
    const message = validators[key](event.currentTarget.value);
    setFieldErrors((prev) => ({ ...prev, [key]: message }));
  };

  const handleFieldChange = (key: keyof FieldErrors) => (event: ChangeEvent<HTMLInputElement>) => {
    if (!fieldErrors[key]) return;
    const message = validators[key](event.currentTarget.value);
    setFieldErrors((prev) => ({ ...prev, [key]: message }));
  };

  /* -------------------------------- submit --------------------------------- */

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;

    if (!selectedCourseId || !selectedSessionId) {
      setFormError(t.chooseFirst);
      return;
    }

    const nameValue = fullNameRef.current?.value ?? "";
    const phoneValue = phoneRef.current?.value ?? "";
    const ageValue = ageRef.current?.value ?? "";
    const errors: FieldErrors = {
      name: validateName(nameValue),
      phone: validatePhone(phoneValue),
      age: validateAge(ageValue),
    };
    setFieldErrors(errors);
    if (errors.name || errors.phone || errors.age) {
      const firstInvalid = errors.name ? fullNameRef.current : errors.phone ? phoneRef.current : ageRef.current;
      firstInvalid?.focus();
      setFormError(t.completeDetails);
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: nameValue.trim(),
          phone: phoneValue.trim(),
          age: Number(ageValue),
          courseId: selectedCourseId,
          scheduleId: selectedSessionId,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFormError(data.error || t.submitFail);
        setIsSubmitting(false);
        return;
      }

      if (typeof data.referenceId !== "string") {
        setFormError(t.noRef);
        setIsSubmitting(false);
        return;
      }

      // Prefer the server's amount: it is authoritative if a discount changes mid-flow.
      const created: CreatedRegistration = {
        referenceId: data.referenceId,
        amount: typeof data.amount === "number" ? data.amount : (coursePrice ?? 0),
        courseTitle: selectedCourse?.title,
        holdUntil: typeof data.holdUntil === "string" ? data.holdUntil : undefined,
      };
      writePending(created);
      setFormError("");
      setRegistrationCreated(created);
      setIsSubmitting(false);
    } catch {
      setFormError(t.wentWrong);
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    selectedCourseId,
    selectedSessionId,
    selectedCourse?.title,
    coursePrice,
    t,
    validateName,
    validatePhone,
    validateAge,
  ]);

  const handleUploadProof = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paymentProofFile || !registrationCreated || isUploadingProof) return;
    setIsUploadingProof(true);
    setUploadProgress(0);
    setProofUploadError("");

    try {
      const response = await postReceipt(
        `/api/registrations/${encodeURIComponent(registrationCreated.referenceId)}/payment-proof`,
        paymentProofFile,
        setUploadProgress,
      );

      let result: { error?: string; notificationSent?: boolean; proofSent?: boolean } = {};
      if (response.contentType.includes("application/json")) {
        try {
          result = JSON.parse(response.body);
        } catch {
          result = {};
        }
      } else if (!response.ok) {
        const text = response.body.trim();
        result = { error: text && text.length < 200 && !text.startsWith("<") ? text : undefined };
      }

      if (!response.ok) throw new Error(result.error || t.uploadFail);

      setProofNotificationFailed(result.notificationSent === false);
      setProofImageDeliveryFailed(result.notificationSent !== false && result.proofSent === false);
      setProofReviewStatus("PENDING_REVIEW");
      setProofReviewNote(null);
      setProofUploaded(true);
    } catch (error) {
      if (error instanceof Error && error.message === "NETWORK") setProofUploadError(t.networkError);
      else setProofUploadError(error instanceof Error ? error.message : t.uploadFail);
    } finally {
      setIsUploadingProof(false);
    }
  };

  /* -------------------------------- render --------------------------------- */

  const statusPath = registrationCreated
    ? `/registration?id=${encodeURIComponent(registrationCreated.referenceId)}`
    : "/registration";

  let holdUntilText = "";
  if (registrationCreated?.holdUntil) {
    const date = new Date(registrationCreated.holdUntil);
    if (!Number.isNaN(date.getTime())) {
      try {
        holdUntilText = date.toLocaleString(lang === "am" ? "am-ET" : "en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        });
      } catch {
        holdUntilText = date.toLocaleString();
      }
    }
  }

  const errorBox = formError ? (
    <div
      className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-600"
      role="alert"
    >
      <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-500" />
      <span>{formError}</span>
    </div>
  ) : null;

  const submitLabel = isSubmitting ? t.saving : t.save;
  const submitIcon = isSubmitting ? (
    <Loader2 size={18} className="animate-spin" />
  ) : (
    <ArrowRight size={18} />
  );

  return (
    <dialog
      ref={dialogRef}
      lang={lang}
      onCancel={(event) => {
        // Esc key: route through the same confirm as the close button
        event.preventDefault();
        requestClose();
      }}
      onMouseDown={(event: ReactMouseEvent<HTMLDialogElement>) => {
        pointerDownOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event: ReactMouseEvent<HTMLDialogElement>) => {
        // backdrop click (and the press must have started on the backdrop too)
        if (event.target === event.currentTarget && pointerDownOnBackdrop.current) requestClose();
      }}
      className={`w-[calc(100%-1rem)] ${registrationCreated ? "h-[calc(100dvh-1rem)] max-w-3xl sm:h-[92dvh]" : "max-w-5xl"} max-h-[calc(100dvh-1rem)] overflow-hidden rounded-xl bg-white p-0 backdrop:bg-black/60 sm:w-[calc(100%-2rem)] sm:max-h-[92dvh]`}
    >
      <div
        className={`flex ${registrationCreated ? "h-full" : "max-h-[calc(100dvh-1rem)] sm:max-h-[92dvh]"} flex-col overflow-hidden bg-white`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-sm text-gray-500">{t.academy}</p>
            <h2 className="mt-1 text-xl font-bold text-navy sm:text-2xl">
              {registrationCreated ? t.titlePay : t.titleRegister}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={requestClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-500 transition-colors hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
              aria-label={t.close}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <Stepper current={currentStep} labels={t.steps} stepOf={t.stepOf} />

        {registrationCreated ? (
          /* ------------------------------ payment stage ------------------------------ */
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-0 text-center sm:px-6 sm:pb-5 sm:pt-1">
            <h3
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl font-bold tracking-tight text-navy outline-none sm:text-3xl"
            >
              {t.applicationSaved}
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">{t.savedBody}</p>

            <p className="mt-4 text-xs text-gray-500">{t.refId}</p>
            <div className="mx-auto mt-1 flex max-w-full flex-wrap items-center justify-center gap-2">
              <span className="break-all font-mono text-base font-semibold text-navy sm:text-lg">
                {registrationCreated.referenceId}
              </span>
              <CopyButton value={registrationCreated.referenceId} label={t.copy} copiedLabel={t.copied} />
            </div>
            {holdUntilText && !proofUploaded && (
              <p className="mx-auto mt-3 max-w-md rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                {t.payBy(holdUntilText)}
              </p>
            )}

            {proofUploaded ? (
              <div className="mx-auto mt-6 max-w-lg text-center" aria-live="polite">
                {proofReviewStatus === "APPROVED" ? (
                  <>
                    <Check size={30} className="mx-auto mb-4 text-green-700" />
                    <h4 className="text-xl font-semibold text-green-900">{t.confirmed}</h4>
                    <p className="mt-3 text-sm text-green-800">{t.approvedBody}</p>
                  </>
                ) : (
                  <>
                    <Check size={28} className="mx-auto mb-4 text-green-700" />
                    <h4 className="text-xl font-semibold text-green-900">{t.paymentSubmitted}</h4>
                    {proofNotificationFailed ? (
                      <p className="mt-3 text-sm text-amber-800">
                        {t.notifFailed}{" "}
                        <a href="/#contact" className="font-semibold underline underline-offset-2">
                          {t.contactAcademy}
                        </a>
                      </p>
                    ) : proofImageDeliveryFailed ? (
                      <p className="mt-3 text-sm text-amber-800">{t.imageFailed}</p>
                    ) : (
                      <p className="mt-3 text-sm text-green-800">{t.awaiting(t.eta)}</p>
                    )}
                    {statusCheckStalled && (
                      <p className="mt-3 text-sm text-amber-800" role="status">
                        {t.stalled}
                      </p>
                    )}
                  </>
                )}
                <a href={statusPath} className="action-primary mt-8 inline-flex w-full items-center justify-center gap-2">
                  {proofReviewStatus === "APPROVED" ? t.viewConfirmation : t.viewStatus}
                </a>
              </div>
            ) : (
              <div className="mx-auto mt-4 max-w-3xl space-y-4 sm:space-y-5">
                {proofReviewStatus === "REJECTED" && (
                  <div className="text-left text-sm text-red-800" role="alert">
                    <p className="font-semibold">{t.receiptRejected}</p>
                    {proofReviewNote && (
                      <p className="mt-1">
                        {t.adminNote}: {proofReviewNote}
                      </p>
                    )}
                  </div>
                )}

                <PaymentInstructions amount={registrationCreated.amount} />

                <form className="space-y-3 text-left sm:space-y-4" onSubmit={handleUploadProof}>
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-base font-semibold text-navy">{t.uploadReceipt}</h4>
                      <p id="payment-proof-helper" className="mt-1 text-sm leading-5 text-gray-500">
                        {t.receiptHelp}
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
                        disabled={isUploadingProof || isPreparingProof}
                        onChange={handlePaymentProofChange}
                      />
                      {isPreparingProof ? (
                        <span className="flex items-center gap-2 text-sm text-gray-500">
                          <Loader2 size={16} className="animate-spin" /> {t.preparing}
                        </span>
                      ) : proofPreview ? (
                        <>
                          <img
                            src={proofPreview}
                            alt=""
                            className="max-h-44 max-w-full rounded-lg object-contain sm:max-h-52"
                          />
                          <span className="max-w-full break-all text-sm font-medium text-navy">
                            {paymentProofFile?.name}
                          </span>
                          <span className="text-xs text-gray-500">{t.chooseDifferent}</span>
                        </>
                      ) : (
                        <>
                          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-navy">
                            <Upload size={20} />
                          </span>
                          <span className="inline-flex min-h-10 items-center rounded-md bg-white px-4 text-sm font-semibold text-navy transition-colors group-hover:bg-gold/15">
                            {t.chooseImage}
                          </span>
                        </>
                      )}
                    </label>

                    {proofUploadError && (
                      <p className="text-sm text-red-700" role="alert">
                        {proofUploadError}
                      </p>
                    )}

                    {isUploadingProof && (
                      <div
                        className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={uploadProgress}
                      >
                        <div
                          className="h-full rounded-full bg-gold transition-[width] duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!paymentProofFile || isUploadingProof || isPreparingProof}
                      className="action-primary inline-flex w-full items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isUploadingProof && <Loader2 size={16} className="animate-spin" />}
                      {isUploadingProof ? t.uploading(uploadProgress) : t.submitProof}
                    </button>
                  </div>
                </form>

                <button
                  type="button"
                  onClick={startNewRegistration}
                  className="inline-flex min-h-11 items-center justify-center px-1 text-xs font-medium text-gray-500 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-navy"
                >
                  {t.startNew}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ------------------------------- form stage -------------------------------- */
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-warm-white px-3 py-3 sm:px-6 sm:py-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_360px]">
                <div className="space-y-5">
                  {/* Course */}
                  <section className={sectionCardClass} aria-labelledby="course-heading">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 id="course-heading" className="text-base font-semibold text-navy">
                        {t.chooseCourse}
                      </h3>
                      {coursesLoaded && !loadError && (
                        <span className="text-sm text-gray-500">{t.available(courses.length)}</span>
                      )}
                    </div>
                    {!coursesLoaded ? (
                      <SkeletonRows count={3} />
                    ) : loadError && courses.length === 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-center">
                        <p className="text-sm font-medium text-amber-800">{loadError}</p>
                        <button onClick={() => setReloadKey((k) => k + 1)} className="action-secondary mt-3">
                          {t.tryAgain}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5" role="radiogroup" aria-labelledby="course-heading">
                        {courses.map((c) => {
                          const price = c.discountPrice ?? c.price;
                          const isSelected = selectedCourseId === c.id;
                          return (
                            <label
                              key={c.id}
                              className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-gold sm:gap-4 sm:p-4 ${
                                isSelected
                                  ? "border-gold bg-[#fffaf1]"
                                  : "border-transparent hover:border-gray-200 hover:bg-warm-white"
                              }`}
                            >
                              <RadioDot selected={isSelected} />
                              <input
                                type="radio"
                                name="course"
                                value={c.id}
                                checked={isSelected}
                                onChange={(e) => setSelectedCourseId(e.target.value)}
                                className="sr-only"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-start justify-between gap-2 sm:gap-4">
                                  <span className="min-w-0 break-words text-sm font-semibold text-navy sm:text-base">
                                    {c.title}
                                  </span>
                                  <span className="shrink-0 text-right">
                                    <span className="block text-base font-bold text-navy sm:text-lg">
                                      {formatBirr(price)}
                                    </span>
                                    {c.discountPrice && (
                                      <span className="block text-xs text-gray-400 line-through">
                                        {formatBirr(c.price)}
                                      </span>
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

                  {/* Schedule (flattened: one tap picks group + session) */}
                  <section className={sectionCardClass} aria-labelledby="schedule-heading">
                    <h3 id="schedule-heading" className="mb-3 text-base font-semibold text-navy">
                      {t.chooseSchedule}
                    </h3>
                    {!schedulesLoaded ? (
                      <SkeletonRows count={2} className="h-14" />
                    ) : scheduleGroups.length === 0 ? (
                      scheduleError ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-center">
                          <p className="text-sm font-medium text-amber-800">{scheduleError}</p>
                          <button onClick={() => setReloadKey((k) => k + 1)} className="action-secondary mt-3">
                            {t.tryAgain}
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-xl bg-warm-white px-4 py-3 text-sm text-gray-500">{t.noSchedules}</div>
                      )
                    ) : (
                      <div className="space-y-4" role="radiogroup" aria-labelledby="schedule-heading">
                        {scheduleGroups.map((g) => (
                          <div key={g.group}>
                            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="text-sm font-bold text-navy">{t.scheduleLabel(g.group)}</span>
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <Calendar size={12} /> {g.days}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {g.sessions.map((s) => {
                                const isSelected = selectedSessionId === s.id;
                                const low = !s.isFull && s.seatsAvailable <= LOW_SEATS_THRESHOLD;
                                return (
                                  <label
                                    key={s.id}
                                    className={`flex min-h-14 items-start gap-3 rounded-xl border p-3 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-gold ${
                                      s.isFull
                                        ? "cursor-not-allowed border-transparent bg-gray-50 opacity-60"
                                        : isSelected
                                          ? "cursor-pointer border-gold bg-[#fffaf1]"
                                          : "cursor-pointer border-transparent hover:border-gray-200 hover:bg-warm-white"
                                    }`}
                                  >
                                    <RadioDot selected={isSelected} disabled={s.isFull} />
                                    <input
                                      type="radio"
                                      name="schedule-session"
                                      value={s.id}
                                      checked={isSelected}
                                      onChange={() => setSelectedSessionId(s.id)}
                                      disabled={s.isFull}
                                      className="sr-only"
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-semibold text-navy">{s.session}</span>
                                        {s.isFull ? (
                                          <span className="text-xs font-bold text-red-500">{t.full}</span>
                                        ) : low ? (
                                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                            {t.lowSeats(s.seatsAvailable)}
                                          </span>
                                        ) : (
                                          <span className="text-xs font-medium text-gray-500">
                                            {t.seats(s.seatsAvailable)}
                                          </span>
                                        )}
                                      </span>
                                      <span className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                                        <span>
                                          {s.startTime} – {s.endTime}
                                        </span>
                                        <span aria-hidden="true">•</span>
                                        <span>{computeDuration(s.startTime, s.endTime)}</span>
                                      </span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Details */}
                  <section className={sectionCardClass} aria-labelledby="details-heading">
                    <h3 id="details-heading" className="text-base font-semibold text-navy">
                      {t.yourDetails}
                    </h3>
                    <div className="mt-4 space-y-4">
                      <div>
                        <label htmlFor="reg-name" className="mb-1.5 block text-sm font-medium text-gray-700">
                          {t.fullName} <span className="text-gold">*</span>
                        </label>
                        <input
                          ref={fullNameRef}
                          id="reg-name"
                          type="text"
                          placeholder={t.namePh}
                          autoComplete="name"
                          aria-required="true"
                          aria-invalid={Boolean(fieldErrors.name)}
                          aria-describedby={fieldErrors.name ? "reg-name-error" : undefined}
                          onBlur={handleFieldBlur("name")}
                          onChange={handleFieldChange("name")}
                          className={fieldClass}
                        />
                        <FieldError id="reg-name-error" message={fieldErrors.name} />
                      </div>
                      <div>
                        <label htmlFor="reg-phone" className="mb-1.5 block text-sm font-medium text-gray-700">
                          {t.phone} <span className="text-gold">*</span>
                        </label>
                        <input
                          ref={phoneRef}
                          id="reg-phone"
                          type="tel"
                          inputMode="tel"
                          placeholder={t.phonePh}
                          autoComplete="tel"
                          aria-required="true"
                          aria-invalid={Boolean(fieldErrors.phone)}
                          aria-describedby={fieldErrors.phone ? "reg-phone-error" : undefined}
                          onBlur={handleFieldBlur("phone")}
                          onChange={handleFieldChange("phone")}
                          className={fieldClass}
                        />
                        <FieldError id="reg-phone-error" message={fieldErrors.phone} />
                      </div>
                      <div>
                        <label htmlFor="reg-age" className="mb-1.5 block text-sm font-medium text-gray-700">
                          {t.age} <span className="text-gold">*</span>
                        </label>
                        <input
                          ref={ageRef}
                          id="reg-age"
                          type="number"
                          inputMode="numeric"
                          min={10}
                          max={99}
                          placeholder="22"
                          aria-required="true"
                          aria-invalid={Boolean(fieldErrors.age)}
                          aria-describedby={fieldErrors.age ? "reg-age-error" : undefined}
                          onBlur={handleFieldBlur("age")}
                          onChange={handleFieldChange("age")}
                          className={fieldClass}
                        />
                        <FieldError id="reg-age-error" message={fieldErrors.age} />
                      </div>
                    </div>
                  </section>
                </div>

                {/* Summary */}
                <aside className="lg:pt-2">
                  <div className="lg:sticky lg:top-0">
                    <div className={sectionCardClass}>
                      <h3 className="text-base font-semibold text-navy">{t.registrationSummary}</h3>

                      <div className="mt-4">
                        <p className="break-words text-sm font-semibold text-navy">
                          {selectedCourse?.title || t.courseNotSelected}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
                          <span>{t.schedule}</span>
                          <span className="min-w-0 text-right font-medium text-navy">
                            {scheduleText || t.notSelected}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
                          <span>{t.days}</span>
                          <span className="min-w-0 text-right font-medium text-navy">{scheduleDays || "—"}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
                          <span>{t.duration}</span>
                          <span className="min-w-0 text-right font-medium text-navy">{duration || "—"}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-end justify-between gap-3 border-t border-gray-100 pt-3">
                        <span className="text-sm font-medium text-gray-600">{t.total}</span>
                        <span className="text-right">
                          <span className="block text-xl font-bold text-navy">
                            {coursePrice !== null ? formatBirr(coursePrice) : "—"}
                          </span>
                          {selectedCourse?.discountPrice && (
                            <span className="block text-xs text-gray-400 line-through">
                              {formatBirr(selectedCourse.price)}
                            </span>
                          )}
                          {selectedCourse?.discountLabel && (
                            <span className="block text-xs font-medium text-emerald-700">
                              {selectedCourse.discountLabel}
                            </span>
                          )}
                        </span>
                      </div>

                      <p className="mt-3 text-xs leading-relaxed text-gray-500">{t.summaryNext}</p>

                      {/* Desktop CTA (mobile uses the sticky bar below) */}
                      <div className="mt-4 hidden lg:block">
                        {errorBox && <div className="mb-3">{errorBox}</div>}
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={isSubmitting}
                          aria-busy={isSubmitting}
                          className="action-primary flex w-full items-center justify-center gap-2 text-base disabled:opacity-60"
                        >
                          {submitIcon}
                          {submitLabel}
                        </button>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>

            {/* Sticky mobile action bar */}
            <div className="shrink-0 border-t border-gray-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] lg:hidden">
              {errorBox && <div className="mb-2">{errorBox}</div>}
              <div className="flex items-center gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">{t.total}</p>
                  <p className="truncate text-lg font-bold leading-tight text-navy">
                    {coursePrice !== null ? formatBirr(coursePrice) : "—"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="action-primary ml-auto flex min-h-12 flex-1 items-center justify-center gap-2 text-base disabled:opacity-60"
                >
                  {submitIcon}
                  <span className="truncate">{submitLabel}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
