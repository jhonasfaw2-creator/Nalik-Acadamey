"use client";

import Link from "next/link";
import {
  Layout,
  Info,
  BookOpen,
  Star,
  Route,
  Phone,
  MousePointerClick,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";

const SECTIONS = [
  { slug: "hero", label: "Hero", description: "Main banner with video, heading, and CTAs", icon: Layout, publicPath: "/" },
  { slug: "about", label: "About", description: "Academy info, video, and teaching pillars", icon: Info, publicPath: "/#about" },
  { slug: "what-we-teach", label: "What We Teach", description: "Core disciplines and teaching topics", icon: BookOpen, publicPath: "/#what-we-teach" },
  { slug: "featured-courses", label: "Featured Courses", description: "Course cards heading and subtitle", icon: Star, publicPath: "/#courses" },
  { slug: "programs", label: "Programs", description: "Programs section heading and CTA", icon: BookOpen, publicPath: "/#courses" },
  { slug: "career-path", label: "Career Path", description: "Career path steps and outcomes", icon: Route, publicPath: "/#career-path" },
  { slug: "why-nalik", label: "Why Nalik Academy", description: "Founder story and highlights", icon: Star, publicPath: "/#founder" },
  { slug: "learning-process", label: "Learning Process", description: "How You Learn steps and note", icon: Route, publicPath: "/#how-you-learn" },
  { slug: "final-cta", label: "Final CTA", description: "Bottom call-to-action section", icon: MousePointerClick, publicPath: "/" },
  { slug: "contact", label: "Contact Settings", description: "Phone, email, location, and social links", icon: Phone, publicPath: "/#contact" },
];

export default function ContentIndexPage() {
  const { user, loading: authLoading } = useAdminAuth();

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Website Content</h1>
          <p className="mt-1 text-sm text-navy/50">
            Edit content for each section of the public website. Changes appear
            immediately after saving.
          </p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded border border-navy/15 px-4 py-2.5 text-sm font-medium text-navy transition-colors hover:bg-navy/5"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Preview Website
        </a>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link
            key={section.slug}
            href={`/admin/content/${section.slug}`}
            className="group flex items-start gap-4 rounded border border-navy/10 bg-white p-5 transition-colors hover:border-gold/30"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-navy/5 text-navy/40 transition-colors group-hover:bg-gold/10 group-hover:text-gold">
              <section.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-navy group-hover:text-gold">
                {section.label}
              </p>
              <p className="mt-0.5 text-xs text-navy/50">
                {section.description}
              </p>
            </div>
            <span className="mt-1 text-xs text-navy/30 transition-colors group-hover:text-gold">
              Edit
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
