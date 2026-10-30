"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useLang, type Lang } from "@/hooks/useLang";
import { useReveal } from "@/hooks/useReveal";

/* -------------------------------------------------------------------------- */
/*  Types and constants                                                        */
/* -------------------------------------------------------------------------- */

interface FoundersProps {
  /** Optional: when provided, an "Apply now" button is shown next to "See the work". */
  onApplyClick?: () => void;
}

// Space reserved for the fixed header when scrolling to #our-work.

const DEFAULTS = {
  badge: "Meet the founder",
  name: "",
  role: "Founder of Nalik Academy",
  heading: "He learned the craft editing for other creators. Nalik Academy is where he teaches it.",
  portraitUrl: "/assets/natiii.jpg",
  bio:
    "Before Nalik Academy, he worked as a freelance video editor in Ethiopia. The work covered YouTube videos, short form clips, and longer stories, and it taught him how pacing, hooks, sound, and colour decide whether an edit holds attention." +
    "\n\n" +
    "The academy grew out of that experience. He wanted to teach editing the way he learned it, through real projects and practical decisions instead of theory alone. Students here work on the same kinds of edits he handled as a freelancer, with the same attention to story and finish.",
  specialties: [
    "Video Editing",
    "YouTube Editing",
    "Short Form Editing",
    "Short Film Editing",
    "Colour Grading",
    "Sound Design",
    "Motion Graphics",
    "Storytelling and Pacing",
  ],
  // Optional Amharic overrides from the CMS
  nameAm: "",
  badgeAm: "",
  roleAm: "",
  headingAm: "",
  bioAm: "",
  specialtiesAm: [] as string[],
};

const AM_DEFAULTS = {
  badge: "መስራቹን ያግኙ",
  role: "የናሊክ አካዳሚ መስራች",
  heading: "ሙያውን ለሌሎች ፈጣሪዎች ኤዲት በማድረግ ተማረ። ናሊክ አካዳሚ ደግሞ የሚያስተምርበት ቦታ ነው።",
  bio:
    "ናሊክ አካዳሚን ከመመሥረቱ በፊት በኢትዮጵያ ነፃ ቪዲዮ ኤዲተር ሆኖ ይሠራ ነበር። ሥራው የዩቲዩብ ቪዲዮዎችን፣ አጫጭር ክሊፖችን እና ረዘም ያሉ ታሪኮችን ያካተተ ነበር፤ ፍጥነት፣ ተመልካችን የሚስብ ጅማሬ፣ ድምፅ እና ቀለም አንድ ኤዲት ተመልካችን ይዞ መቆየቱን እንዴት እንደሚወስኑ አስተምሮታል።" +
    "\n\n" +
    "አካዳሚው ከዚያ ልምድ የተወለደ ነው። ኤዲቲንግን እሱ በተማረበት መንገድ፣ ማለትም ከንድፈ ሐሳብ ብቻ ሳይሆን በእውነተኛ ፕሮጀክቶች እና በተግባራዊ ውሳኔዎች ማስተማር ፈለገ። እዚህ ያሉ ተማሪዎች እሱ እንደ ነፃ ሠራተኛ ይሠራቸው የነበሩትን ዓይነት ኤዲቶች ለታሪክና ለአጨራረስ በተመሳሳይ ትኩረት ይሠራሉ።",
  specialties: [
    "ቪዲዮ ኤዲቲንግ",
    "የዩቲዩብ ኤዲቲንግ",
    "የአጫጭር ቪዲዮዎች ኤዲቲንግ",
    "የአጭር ፊልም ኤዲቲንግ",
    "የቀለም ማስተካከያ",
    "የድምፅ ንድፍ",
    "ሞሽን ግራፊክስ",
    "ታሪክ አተራረክ እና ፍጥነት",
  ],
};

/** Amharic text if the CMS has it; the Amharic default only while the English text is still the default. */
function localize(lang: Lang, current: string, currentAm: string, defaultEn: string, defaultAm: string) {
  if (lang !== "am") return current;
  if (currentAm) return currentAm;
  return current === defaultEn ? defaultAm : current;
}

function localizeList(lang: Lang, current: string[], currentAm: string[], defaultEn: string[], defaultAm: string[]) {
  if (lang !== "am") return current;
  if (currentAm.length) return currentAm;
  const isDefault = current.length === defaultEn.length && current.every((item, i) => item === defaultEn[i]);
  return isDefault ? defaultAm : current;
}

const str = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value : fallback;

const strList = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  return cleaned.length ? cleaned : fallback;
};

/* -------------------------------------------------------------------------- */
/*  Copy (English / Amharic). Have a native speaker review the Amharic.        */
/* -------------------------------------------------------------------------- */

const en = {
  specialtiesLabel: "Editing specialties",
  seeWork: "See the work",
  apply: "Apply now",
  portraitAlt: (who: string) => `${who}, Ethiopian freelance video editor`,
  caption: "Ethiopian freelance video editor",
};

const am: typeof en = {
  specialtiesLabel: "የኤዲቲንግ ልዩ ክህሎቶች",
  seeWork: "ሥራዎቹን ይመልከቱ",
  apply: "አሁን ያመልክቱ",
  portraitAlt: (who) => `${who}፣ ኢትዮጵያዊ ነፃ ቪዲዮ ኤዲተር`,
  caption: "ኢትዮጵያዊ ነፃ ቪዲዮ ኤዲተር",
};

const STRINGS: Record<Lang, typeof en> = { en, am };

/** Fade-and-rise entrance built from Tailwind classes, so no extra CSS is needed. */
const reveal = (visible: boolean) =>
  `transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none ${
    visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
  }`;

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function Founders({ onApplyClick }: FoundersProps) {
  const { lang } = useLang();
  const t = STRINGS[lang];

  const [data, setData] = useState(DEFAULTS);
  const [portraitFailed, setPortraitFailed] = useState(false);

  const header = useReveal<HTMLDivElement>(0.15);
  const figure = useReveal<HTMLElement>(0.15);
  const story = useReveal<HTMLDivElement>(0.1);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/content?section=founders")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d || typeof d !== "object") return;
        setData({
          badge: str(d.badge, DEFAULTS.badge),
          name: typeof d.name === "string" ? d.name.trim() : DEFAULTS.name,
          role: str(d.role, DEFAULTS.role),
          heading: str(d.heading, DEFAULTS.heading),
          portraitUrl: str(d.portraitUrl, DEFAULTS.portraitUrl),
          bio: str(d.bio, DEFAULTS.bio),
          specialties: strList(d.specialties, DEFAULTS.specialties),
          nameAm: typeof d.nameAm === "string" ? d.nameAm.trim() : "",
          badgeAm: str(d.badgeAm, ""),
          roleAm: str(d.roleAm, ""),
          headingAm: str(d.headingAm, ""),
          bioAm: str(d.bioAm, ""),
          specialtiesAm: strList(d.specialtiesAm, []),
        });
        setPortraitFailed(false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const badge = localize(lang, data.badge, data.badgeAm, DEFAULTS.badge, AM_DEFAULTS.badge);
  const role = localize(lang, data.role, data.roleAm, DEFAULTS.role, AM_DEFAULTS.role);
  const heading = localize(lang, data.heading, data.headingAm, DEFAULTS.heading, AM_DEFAULTS.heading);
  const bio = localize(lang, data.bio, data.bioAm, DEFAULTS.bio, AM_DEFAULTS.bio);
  const specialties = localizeList(lang, data.specialties, data.specialtiesAm, DEFAULTS.specialties, AM_DEFAULTS.specialties);
  const name = (lang === "am" && data.nameAm) || data.name;
  const displayName = name || role;

  const bioParagraphs = bio
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <section
      id="founders"
      lang={lang}
      aria-labelledby="founders-title"
      className="bg-warm-white px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div ref={header.ref} className={reveal(header.visible)}>
          <p className="text-sm font-medium text-gold">{badge}</p>

          <div className="mt-4 max-w-4xl sm:mt-5">
            <h2
              id="founders-title"
              className="text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-navy"
            >
              {heading}
            </h2>
          </div>
        </div>

        <div className="mt-8 grid gap-8 sm:mt-10 sm:gap-10 lg:mt-12 lg:grid-cols-12 lg:items-start lg:gap-12">
          <figure
            ref={figure.ref}
            className={`mx-auto w-full max-w-xs lg:col-span-5 lg:mx-0 lg:max-w-sm ${reveal(figure.visible)}`}
          >
            <div className="relative aspect-[4/5] overflow-hidden bg-navy">
              {portraitFailed ? (
                <div
                  className="flex h-full w-full items-center justify-center text-7xl font-semibold text-gold"
                  aria-hidden="true"
                >
                  {Array.from(displayName)[0]?.toUpperCase() ?? "N"}
                </div>
              ) : (
                <img
                  src={data.portraitUrl}
                  alt={t.portraitAlt(displayName)}
                  className="h-full w-full object-cover object-[center_18%]"
                  loading="lazy"
                  decoding="async"
                  onError={() => setPortraitFailed(true)}
                />
              )}
            </div>
            <figcaption className="mt-3">
              <p className="text-sm font-semibold text-navy">{displayName}</p>
              <p className="mt-0.5 text-sm text-gray-500">{name ? role : t.caption}</p>
            </figcaption>
          </figure>

          <div
            ref={story.ref}
            className={`lg:col-span-7 ${reveal(story.visible)}`}
            style={{ transitionDelay: "120ms" }}
          >
            <div className="max-w-3xl space-y-5 text-base leading-7 text-gray-700 sm:text-[17px] sm:leading-8">
              {bioParagraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>

            <div className="mt-8">
              <p className="text-sm font-semibold text-navy">{t.specialtiesLabel}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {specialties.map((specialty) => (
                  <li
                    key={specialty}
                    className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-sm text-gray-700"
                  >
                    {specialty}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              {onApplyClick && (
                <button
                  type="button"
                  onClick={onApplyClick}
                  className="action-primary group/btn inline-flex items-center justify-center gap-3"
                >
                  {t.apply}
                  <ArrowRight
                    size={18}
                    className="transition-transform duration-200 group-hover/btn:translate-x-1"
                  />
                </button>
              )}

              <Link
                href="/#our-work"
                className="group inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-navy underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                {t.seeWork}
                <ArrowUpRight size={16} strokeWidth={1.8} className="transition-colors group-hover:text-gold" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}