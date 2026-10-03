"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Loader2, Calendar, Info } from "lucide-react";

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

function formatBirr(amount: number) {
  return amount.toLocaleString("en-ET") + " Birr";
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
  const [scheduleError, setScheduleError] = useState("");
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

  // ── Load courses + schedules ──────────────────────────────
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadError("");
    setScheduleError("");
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
            setScheduleGroups(scheduleData.groups);
            setScheduleError("");
          }
          return;
        } catch {
          if (attempt === 0 && !cancelled) {
            await new Promise((resolve) => setTimeout(resolve, 1_000));
          }
        }
      }
      if (!cancelled) setScheduleError("We couldn't load schedules. Please check your connection and try again.");
    };
    void loadSchedules();

    return () => { cancelled = true; };
  }, [open, preselectedCourse, reloadKey]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) dialog.showModal();
    else dialog.close();
  }, [open]);

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
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const selectedGroup = scheduleGroups.find((g) => g.group === selectedGroupId) as ScheduleGroup | undefined;
  const selectedSession = selectedGroup?.sessions.find((s) => s.id === selectedSessionId);
  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const price = selectedCourse ? selectedCourse.discountPrice ?? selectedCourse.price : 0;
  const duration = computeDuration(selectedSession?.startTime, selectedSession?.endTime);
  const scheduleText =
    selectedGroup && selectedSession
      ? `Schedule ${selectedGroup.group}: ${selectedSession.session}`
      : "";
  const scheduleDays = selectedGroup?.days || "";

  const fieldClass = "w-full rounded-xl border border-gray-200 bg-[#f9faf8] px-3.5 py-2.75 text-sm text-navy placeholder:text-gray-400 transition-all focus:border-gold focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/20 disabled:bg-gray-50";
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
              Register for a course
            </h2>
          </div>
          <button onClick={() => dialogRef.current?.close()} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
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
                              onChange={(e) => { setSelectedCourseId(e.target.value); setSelectedGroupId(""); setSelectedSessionId(""); }}
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
                    scheduleError ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-center">
                        <p className="text-sm font-medium text-amber-800">{scheduleError}</p>
                        <button onClick={() => setReloadKey((key) => key + 1)} className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-700">
                          Try Again
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-warm-white px-4 py-3 text-sm text-gray-500">
                        No schedule groups are open right now. Please try again later.
                      </div>
                    )
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
                                onChange={() => { setSelectedGroupId(g.group); setSelectedSessionId(""); }}
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
                                  // isFull already includes the admin's
                                  // Available/Full marking from the API.
                                  const isFull = s.isFull;
                                  return (
                                    <label key={s.id} className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${selectedSessionId === s.id ? "border-gold bg-white" : "border-gray-200 hover:border-gold/50"}`}>
                                      <input
                                        type="radio"
                                        name="schedule-session"
                                        value={s.id}
                                        checked={selectedSessionId === s.id}
                                        onChange={() => setSelectedSessionId(s.id)}
                                        disabled={isFull}
                                        className="mt-0.5 accent-gold"
                                      />
                                      <span className="flex-1">
                                        <span className="flex items-center justify-between gap-2">
                                          <span className="text-sm font-semibold text-navy">{s.session}</span>
                                          {isFull ? (
                                            <span className="text-[11px] font-bold text-red-500">Full</span>
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
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="reg-email" className="mb-1.5 block text-sm font-medium text-gray-700">Email <span className="text-gold">*</span></label>
                        <input ref={emailRef} id="reg-email" type="email" placeholder="you@example.com" autoComplete="email" className={fieldClass} />
                      </div>
                      <div>
                        <label htmlFor="reg-phone" className="mb-1.5 block text-sm font-medium text-gray-700">Phone <span className="text-gold">*</span></label>
                        <input ref={phoneRef} id="reg-phone" type="tel" placeholder="+251 9XX XXX XXX" autoComplete="tel" className={fieldClass} />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="reg-age" className="mb-1.5 block text-sm font-medium text-gray-700">Age <span className="text-gold">*</span></label>
                      <input ref={ageRef} id="reg-age" type="number" min={10} max={99} placeholder="22" className={fieldClass} />
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
                      <p className="mt-2 text-[11px] text-white/65">Online checkout is temporarily paused.</p>
                    </div>

                    <button
                      type="button"
                      disabled
                      className="mt-4 w-full rounded-xl bg-gold px-5 py-3.5 text-base font-bold tracking-wide text-navy transition-all duration-200 hover:bg-gold-hover hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Payments temporarily unavailable
                    </button>
                    <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] text-gray-500">
                      <Info size={12} className="mt-0.5 shrink-0 text-gold" />
                      Checkout is being reset before the new payment integration is added.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
        </div>
      </div>
    </dialog>
  );
}
