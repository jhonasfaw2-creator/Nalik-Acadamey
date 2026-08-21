"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Phone,
  MessageCircle,
  Mail,
  ExternalLink,
} from "lucide-react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { Field, Input, Textarea, StatusMessage } from "@/components/admin/AdminFormFields";

interface ContactSettings {
  title: string;
  subtitle: string;
  phone: string;
  whatsapp: string;
  whatsappMessage: string;
  email: string;
  location: string;
  instagram: string;
  tiktok: string;
  facebook: string;
  formRecipientEmail: string;
}

const DEFAULTS: ContactSettings = {
  title: "Let\u2019s Create Something Great.",
  subtitle: "Have questions about our programs? Ready to start your creative journey? Get in touch \u2014 we\u2019d love to hear from you.",
  phone: "+251 9XX XXX XXX",
  whatsapp: "+251911234567",
  whatsappMessage: "Hello! I\u2019m interested in Nalik Academy.",
  email: "info@nalikacademy.com",
  location: "Addis Ababa, Ethiopia",
  instagram: "https://instagram.com/nalikacademy",
  tiktok: "https://tiktok.com/@nalikacademy",
  facebook: "https://facebook.com/nalikacademy",
  formRecipientEmail: "",
};

export default function AdminContactPage() {
  const { user, loading: authLoading } = useAdminAuth();
  const [settings, setSettings] = useState<ContactSettings>(DEFAULTS);
  const [saved, setSaved] = useState<ContactSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load current settings
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/admin/content");
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (!cancelled && data.content?.contact) {
          const merged = { ...DEFAULTS, ...data.content.contact };
          setSettings(merged);
          setSaved(merged);
        }
      } catch {
        if (!cancelled) setStatus({ type: "error", message: "Failed to load settings" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user]);

  const handleChange = useCallback((field: keyof ContactSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    // Clear field error on edit
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!settings.phone.trim()) {
      newErrors.phone = "Phone number is required";
    }
    if (!settings.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!settings.location.trim()) {
      newErrors.location = "Location is required";
    }
    if (settings.whatsapp && !/^\+?[\d\s-]{7,15}$/.test(settings.whatsapp.replace(/\s/g, ""))) {
      newErrors.whatsapp = "Please enter a valid WhatsApp number";
    }
    if (settings.formRecipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.formRecipientEmail)) {
      newErrors.formRecipientEmail = "Please enter a valid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [settings]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;

    setSaving(true);
    setStatus(null);

    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "contact", value: settings }),
      });

      if (!res.ok) throw new Error("Failed to save");
      setSaved(settings);
      setStatus({ type: "success", message: "Contact settings saved successfully" });
    } catch {
      setStatus({ type: "error", message: "Failed to save settings. Please try again." });
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(null), 3000);
    }
  }, [settings, validate]);

  const handleCancel = useCallback(() => {
    setSettings(saved);
    setErrors({});
    setStatus(null);
  }, [saved]);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(saved);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Contact Settings</h1>
          <p className="mt-1 text-sm text-navy/50">
            Edit contact information displayed on the public website.
          </p>
        </div>
        <a
          href="/#contact"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded border border-navy/15 px-4 py-2.5 text-sm font-medium text-navy transition-colors hover:bg-navy/5"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View on Site
        </a>
      </div>

      {/* Status */}
      <StatusMessage {...(status || { type: "success", message: "" })} />

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Contact Information */}
          <div className="rounded border border-navy/10 bg-white p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-9 w-9 items-center justify-center rounded bg-navy/5">
                <Phone className="h-4 w-4 text-navy/50" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-navy">Contact Information</h2>
                <p className="text-xs text-navy/50">Phone, email, and location details</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone Number" error={errors.phone} required>
                <Input
                  value={settings.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="+251 9XX XXX XXX"
                  error={errors.phone}
                />
              </Field>

              <Field label="Email Address" error={errors.email} required>
                <Input
                  type="email"
                  value={settings.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="info@nalikacademy.com"
                  error={errors.email}
                />
              </Field>

              <Field label="Location" error={errors.location} required>
                <Input
                  value={settings.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  placeholder="Addis Ababa, Ethiopia"
                  error={errors.location}
                />
              </Field>

              <Field label="Contact Form Recipient Email" error={errors.formRecipientEmail}>
                <Input
                  type="email"
                  value={settings.formRecipientEmail}
                  onChange={(e) => handleChange("formRecipientEmail", e.target.value)}
                  placeholder="Where contact form submissions are sent"
                  error={errors.formRecipientEmail}
                />
              </Field>
            </div>
          </div>

          {/* WhatsApp */}
          <div className="rounded border border-navy/10 bg-white p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-9 w-9 items-center justify-center rounded bg-emerald-50">
                <MessageCircle className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-navy">WhatsApp</h2>
                <p className="text-xs text-navy/50">WhatsApp button on the public website</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="WhatsApp Number" error={errors.whatsapp}>
                <Input
                  value={settings.whatsapp}
                  onChange={(e) => handleChange("whatsapp", e.target.value)}
                  placeholder="+251911234567"
                  error={errors.whatsapp}
                />
              </Field>

              <Field label="Default Message">
                <Input
                  value={settings.whatsappMessage}
                  onChange={(e) => handleChange("whatsappMessage", e.target.value)}
                  placeholder="Hello! I'm interested in Nalik Academy."
                />
              </Field>
            </div>

            {settings.whatsapp && (
              <div className="mt-3 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                Preview:{" "}
                <a
                  href={`https://wa.me/${settings.whatsapp.replace(/[+\s]/g, "")}?text=${encodeURIComponent(settings.whatsappMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-emerald-900"
                >
                  wa.me/{settings.whatsapp.replace(/[+\s]/g, "")}
                </a>
              </div>
            )}
          </div>

          {/* Social Media */}
          <div className="rounded border border-navy/10 bg-white p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-9 w-9 items-center justify-center rounded bg-navy/5">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-navy/50" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-navy">Social Media</h2>
                <p className="text-xs text-navy/50">Social media links shown on the website</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Instagram URL">
                <Input
                  value={settings.instagram}
                  onChange={(e) => handleChange("instagram", e.target.value)}
                  placeholder="https://instagram.com/nalikacademy"
                />
              </Field>

              <Field label="TikTok URL">
                <Input
                  value={settings.tiktok}
                  onChange={(e) => handleChange("tiktok", e.target.value)}
                  placeholder="https://tiktok.com/@nalikacademy"
                />
              </Field>

              <Field label="Facebook URL">
                <Input
                  value={settings.facebook}
                  onChange={(e) => handleChange("facebook", e.target.value)}
                  placeholder="https://facebook.com/nalikacademy"
                />
              </Field>
            </div>
          </div>

          {/* Section Content */}
          <div className="rounded border border-navy/10 bg-white p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-9 w-9 items-center justify-center rounded bg-navy/5">
                <Mail className="h-4 w-4 text-navy/50" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-navy">Section Content</h2>
                <p className="text-xs text-navy/50">Heading and description shown on the contact page</p>
              </div>
            </div>

            <div className="space-y-4">
              <Field label="Section Title">
                <Input
                  value={settings.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  placeholder="Let's Create Something Great."
                />
              </Field>

              <Field label="Section Subtitle">
                <Textarea
                  rows={3}
                  value={settings.subtitle}
                  onChange={(e) => handleChange("subtitle", e.target.value)}
                  placeholder="Have questions about our programs?"
                />
              </Field>
            </div>
          </div>

          {/* Save / Cancel bar */}
          <div className="sticky bottom-0 flex items-center justify-between rounded border border-navy/10 bg-white px-5 py-4 shadow-sm">
            <button
              type="button"
              onClick={handleCancel}
              disabled={!hasChanges || saving}
              className="rounded border border-navy/15 px-4 py-2.5 text-sm font-medium text-navy transition-colors hover:bg-navy/5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <div className="flex items-center gap-3">
              {hasChanges && (
                <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="flex items-center gap-2 rounded bg-gold px-5 py-2.5 text-sm font-bold text-navy transition-all duration-150 hover:bg-gold/90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
