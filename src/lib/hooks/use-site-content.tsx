"use client";

import { useEffect, useState, createContext, useContext, type ReactNode } from "react";

// ── Default content (matches hard-coded values in public components) ──

export const DEFAULT_CONTENT: Record<string, Record<string, string>> = {
  hero: {
    badge: "Nalik Academy | Creative Learning",
    heading: "Edit Your Vision.",
    headingHighlight: "Create Your Future.",
    description:
      "Master video editing, motion graphics, and creative technology with hands-on courses designed to launch your career in the creative industry.",
    ctaPrimary: "Explore Courses",
    ctaPrimaryLink: "/#courses",
    ctaSecondary: "Start Learning",
    video: "/videos/hero.mp4",
    poster: "/images/general/hero-poster.jpg",
  },
  about: {
    label: "About the Academy",
    title: "A New Academy.",
    titleHighlight: "Focused",
    description:
      "Nalik Academy is a new, focused video-editing academy built around one belief: that real skill comes from hands-on practice, not theory alone.",
    description2:
      "Created by an experienced editor and content creator, the academy trains students in DaVinci Resolve and Adobe Premiere Pro, the tools professionals actually use. Every lesson is designed around editing, storytelling, and the skills that matter in the creator economy.",
    video: "/videos/about.mp4",
    poster: "/images/general/about-poster.jpg",
    videoLabel: "Nalik Academy | Behind the Edit",
    cta: "Explore Programs",
    ctaLink: "/#courses",
    pillar1Label: "Editing",
    pillar1Desc: "Precision cuts, pacing, and timeline craft.",
    pillar2Label: "Storytelling",
    pillar2Desc: "Narrative structure that connects with audiences.",
    pillar3Label: "Creator Skills",
    pillar3Desc: "Workflows built for the modern content landscape.",
  },
  what_we_teach: {
    eyebrow: "What We Teach",
    heading: "Turn Creativity Into a Skill.",
    subtitle: "The core disciplines every editor needs to master.",
    item1Title: "Video Editing",
    item1Desc: "Precision cuts, pacing, and timeline craft that shape raw footage into a compelling story.",
    item2Title: "Motion Graphics",
    item2Desc: "Dynamic animations, text effects, and visual elements that bring energy to every frame.",
    item3Title: "Color Grading",
    item3Desc: "Cinematic color correction and grading techniques that set the mood and tone of your work.",
    item4Title: "Audio & Sound",
    item4Desc: "Sound design, mixing, and audio cleanup that give your edits a polished, professional finish.",
  },
  featured_courses: {
    eyebrow: "Our Programs",
    heading: "Learn. Create. Master.",
    subtitle: "Two focused programs designed to take you from beginner to professional editor.",
    viewAll: "View All Courses",
  },
  founder: {
    label: "The Founder",
    title: "Learn From Someone",
    titleHighlight: "Done It.",
    description:
      "Built by a professional video editor and content creator who has worked behind the scenes for established Ethiopian digital creators and TikTok creators, turning raw footage into compelling stories that reach real audiences.",
    description2:
      "This academy exists to pass on the exact skills, workflows, and creative thinking that power professional content, without the guesswork.",
    video: "/videos/founder.mp4",
    cta: "Meet the Founder",
    highlight1: "Video Editing",
    highlight2: "Storytelling",
    highlight3: "Content Creation",
    highlight4: "Industry Connections",
  },
  our_work: {
    title: "Work That",
    titleHighlight: "Inspires.",
    subtitle:
      "A look at the projects we have created. Real edits, built for real audiences.",
  },
  career_path: {
    title: "Your Path to",
    titleHighlight: "Work-Ready",
    subtitle:
      "Nalik Academy focuses on developing strong video-editing skills and preparing students for career opportunities in the creative industry.",
    note:
      "High-performing students may have opportunities to be connected with potential first clients through the academy\u2019s network. This is an opportunity, not a guarantee.",
    step1Label: "Learn",
    step1Desc:
      "Master the fundamentals of video editing, motion design, and creative storytelling through structured lessons.",
    step2Label: "Practice",
    step2Desc:
      "Reinforce your skills with hands-on exercises and real-world editing challenges that build muscle memory.",
    step3Label: "Build Your Skills",
    step3Desc:
      "Develop a polished portfolio of professional-quality edits that showcase your creative and technical range.",
    step4Label: "Become Work-Ready",
    step4Desc:
      "Graduate with the confidence, workflows, and industry knowledge to take on freelance or team-based editing work.",
  },
  learning_process: {
    title: "How You",
    titleHighlight: "Learn",
    subtitle:
      "A structured, skill-focused journey from first lesson to portfolio-ready editor.",
    note:
      "Built for skill. Every step is designed to develop your craft \u2014 no shortcuts, just focused, practical learning that prepares you for real creative work.",
    step1Label: "Choose Your Program",
    step1Desc:
      "Select a program that aligns with your goals \u2014 from DaVinci Resolve to Adobe Premiere Pro \u2014 and start with a clear roadmap.",
    step2Label: "Learn the Skills",
    step2Desc:
      "Follow structured lessons covering editing fundamentals, motion design, color grading, and creative storytelling.",
    step3Label: "Practice & Create",
    step3Desc:
      "Apply what you learn through hands-on projects, real footage, and exercises that build professional muscle memory.",
    step4Label: "Build Your Career",
    step4Desc:
      "Develop a portfolio of polished work and gain the confidence to pursue freelance or team-based editing opportunities.",
  },
  contact: {
    title: "Let\u2019s Create Something Great.",
    subtitle:
      "Have questions about our programs? Ready to start your creative journey? Get in touch \u2014 we\u2019d love to hear from you.",
    phone: "+251 9XX XXX XXX",
    whatsapp: "+251911234567",
    whatsappMessage: "Hello! I\u2019m interested in Nalik Academy.",
    email: "info@nalikacademy.com",
    location: "Addis Ababa, Ethiopia",
    instagram: "https://instagram.com/nalikacademy",
    tiktok: "https://tiktok.com/@nalikacademy",
    facebook: "https://facebook.com/nalikacademy",
    formRecipientEmail: "",
  },
  final_cta: {
    heading: "Ready to Start Editing?",
    description:
      "Develop professional video-editing skills and bring your creative vision to life with hands-on training from industry experts.",
    cta: "Join Nalik Academy",
    video: "/videos/hero.mp4",
    poster: "/images/general/editing-workspace.jpg",
  },
  footer: {
    facebook: "https://facebook.com/nalikacademy",
    instagram: "https://instagram.com/nalikacademy",
    youtube: "https://youtube.com/nalikacademy",
    telegram: "https://t.me/nalikacademy",
  },
};

type SiteContent = Record<string, Record<string, string>>;

interface SiteContentContextValue {
  content: SiteContent;
  loading: boolean;
}

const SiteContentContext = createContext<SiteContentContextValue>({
  content: DEFAULT_CONTENT,
  loading: true,
});

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<SiteContent>(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/content");
        if (!res.ok) return;
        const data = await res.json();

        if (!cancelled && data.content) {
          // Merge database content with defaults
          const merged: SiteContent = {};
          for (const sectionKey of Object.keys(DEFAULT_CONTENT)) {
            merged[sectionKey] = {
              ...DEFAULT_CONTENT[sectionKey],
              ...(data.content[sectionKey] || {}),
            };
          }
          setContent(merged);
        }
      } catch {
        // Use defaults on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SiteContentContext.Provider value={{ content, loading }}>
      {children}
    </SiteContentContext.Provider>
  );
}

/**
 * Hook to get a specific section's content from the database.
 * Falls back to hard-coded defaults if the section hasn't been edited.
 *
 * Usage:
 *   const { about } = useSiteContent();
 *   // about.title, about.description, etc.
 */
export function useSiteContent(): SiteContent {
  return useContext(SiteContentContext).content;
}

/**
 * Helper to get a single value with fallback.
 */
export function getContentValue(
  section: Record<string, string>,
  key: string,
  fallback: string = ""
): string {
  return section[key] || fallback;
}
