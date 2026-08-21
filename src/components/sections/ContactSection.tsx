"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Send,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { FadeUp } from "@/components/motion/FadeUp";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";
import { useSiteContent } from "@/lib/hooks/use-site-content";

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(1000, "Message must be under 1000 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

const inputBase =
  "w-full rounded border border-navy/15 bg-white px-4 py-3 text-sm leading-normal text-navy placeholder:text-navy/30 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 transition-colors";

const labelBase =
  "block text-xs font-semibold text-navy/70 uppercase tracking-wider mb-1.5";

export function ContactSection() {
  const prefersReduced = useReducedMotion();
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { contact } = useSiteContent();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data: ContactFormData) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Failed to send message");
      }
      setSubmitted(true);
      reset();
      setTimeout(() => setSubmitted(false), 5000);
    } catch {
      setServerError("Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const phone = contact.phone || "+251 9XX XXX XXX";
  const whatsapp = contact.whatsapp || "+251911234567";
  const whatsappMessage = contact.whatsappMessage || "Hello! I\u2019m interested in Nalik Academy.";
  const email = contact.email || "info@nalikacademy.com";
  const location = contact.location || "Addis Ababa, Ethiopia";
  const instagram = contact.instagram || "https://instagram.com/nalikacademy";
  const tiktok = contact.tiktok || "https://tiktok.com/@nalikacademy";
  const facebook = contact.facebook || "https://facebook.com/nalikacademy";

  const contactItems = [
    { icon: Phone, label: "Phone", value: phone, href: `tel:${phone.replace(/\s/g, "")}` },
    { icon: MessageCircle, label: "WhatsApp", value: whatsapp, href: `https://wa.me/${whatsapp.replace(/[+\s]/g, "")}?text=${encodeURIComponent(whatsappMessage)}` },
    { icon: Mail, label: "Email", value: email, href: `mailto:${email}` },
    { icon: MapPin, label: "Location", value: location, href: null },
    {
      icon: () => (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      ),
      label: "Instagram",
      value: "@nalikacademy",
      href: instagram,
    },
    {
      icon: () => (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.87a8.16 8.16 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.3z" />
        </svg>
      ),
      label: "TikTok",
      value: "@nalikacademy",
      href: tiktok,
    },
    {
      icon: () => (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
      label: "Facebook",
      value: "Nalik Academy",
      href: facebook,
    },
  ];

  return (
    <section id="contact" className="bg-white py-24 sm:py-32">
      <Container>
        <FadeUp>
          <div className="text-center">
            <div className="mx-auto mb-5 inline-block h-1 w-10 bg-gold" />
            <h2 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl lg:text-[2.75rem]">
              {contact.title || "Let\u2019s Create Something Great."}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              {contact.subtitle || "Have questions about our programs? Ready to start your creative journey? Get in touch \u2014 we\u2019d love to hear from you."}
            </p>
          </div>
        </FadeUp>

        <div className="mt-16 grid gap-12 lg:grid-cols-5 lg:gap-16">
          <div className="lg:col-span-2">
            <FadeUp delay={0.1}>
              <h3 className="mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-gold">
                Get in Touch
              </h3>
            </FadeUp>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {contactItems.map((item, i) => (
                <FadeUp key={item.label} delay={0.15 + i * 0.05}>
                  <motion.div
                    className="group flex items-start gap-3.5 rounded border border-navy/10 bg-warm-white px-4 py-3.5 transition-colors duration-150 hover:border-gold/30"
                    {...(prefersReduced
                      ? {}
                      : {
                          whileHover: { x: 2 },
                          transition: {
                            type: "spring",
                            stiffness: 400,
                            damping: 25,
                          },
                        })}
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-navy/5 text-navy/50 transition-colors group-hover:bg-gold/10 group-hover:text-gold">
                      <item.icon className="h-5 w-5" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-navy/40">
                        {item.label}
                      </p>
                      {item.href ? (
                        <a
                          href={item.href}
                          target={item.href.startsWith("http") ? "_blank" : undefined}
                          rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                          className="mt-0.5 block truncate py-1 text-sm font-medium text-navy transition-colors hover:text-gold"
                       >
                          {item.value}
                        </a>
                      ) : (
                        <p className="mt-0.5 text-sm font-medium text-navy">
                          {item.value}
                        </p>
                      )}
                    </div>
                  </motion.div>
                </FadeUp>
              ))}
            </div>

            <FadeUp delay={0.5}>
              <a
                href={`https://wa.me/${whatsapp.replace(/[+\s]/g, "")}?text=${encodeURIComponent(whatsappMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 flex h-12 w-full items-center justify-center gap-2.5 rounded bg-emerald-600 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              >
                <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2} />
                Chat on WhatsApp
              </a>
            </FadeUp>
          </div>

          <FadeUp delay={0.2} className="lg:col-span-3">
            <div className="rounded border border-navy/10 bg-warm-white p-5 sm:p-8">
              <h3 className="mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-gold">
                Send a Message
              </h3>

              {submitted ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle className="h-7 w-7 text-emerald-600" aria-hidden="true" />
                  </div>
                  <h4 className="mt-5 text-lg font-bold text-navy">
                    Message Sent!
                  </h4>
                  <p className="mt-2 max-w-xs text-sm text-navy/60">
                    Thank you for reaching out. We&apos;ll get back to you as soon as possible.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit(onSubmit)}
                  noValidate
                  className="flex flex-col gap-4"
                  aria-label="Contact form"
                >
                  <div>
                    <label htmlFor="contact-name" className={labelBase}>Name *</label>
                    <input
                      id="contact-name"
                      type="text"
                      autoComplete="name"
                      placeholder="Your full name"
                      className={cn(inputBase, errors.name && "border-red-500 focus:border-red-500 focus:ring-red-200")}
                      {...register("name")}
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? "contact-name-error" : undefined}
                    />
                    {errors.name && <p id="contact-name-error" className="mt-1 text-xs text-red-600" role="alert">{errors.name.message}</p>}
                  </div>

                  <div>
                    <label htmlFor="contact-email" className={labelBase}>Email *</label>
                    <input
                      id="contact-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={cn(inputBase, errors.email && "border-red-500 focus:border-red-500 focus:ring-red-200")}
                      {...register("email")}
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? "contact-email-error" : undefined}
                    />
                    {errors.email && <p id="contact-email-error" className="mt-1 text-xs text-red-600" role="alert">{errors.email.message}</p>}
                  </div>

                  <div>
                    <label htmlFor="contact-message" className={labelBase}>Message *</label>
                    <textarea
                      id="contact-message"
                      rows={4}
                      maxLength={1000}
                      placeholder="How can we help you?"
                      className={cn(inputBase, "resize-none", errors.message && "border-red-500 focus:border-red-500 focus:ring-red-200")}
                      {...register("message")}
                      aria-invalid={!!errors.message}
                      aria-describedby={errors.message ? "contact-message-error" : undefined}
                    />
                    {errors.message && <p id="contact-message-error" className="mt-1 text-xs text-red-600" role="alert">{errors.message.message}</p>}
                  </div>

                  {serverError && (
                    <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                      {serverError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={cn(
                      "mt-2 flex h-12 items-center justify-center gap-2 rounded bg-gold px-6 text-sm font-bold text-navy transition-all duration-150",
                      "hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                      "disabled:pointer-events-none disabled:opacity-60"
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" aria-hidden="true" />
                        Send Message
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </FadeUp>
        </div>
      </Container>
    </section>
  );
}
