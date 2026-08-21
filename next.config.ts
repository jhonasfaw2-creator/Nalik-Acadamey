import type { NextConfig } from "next";

// ── Content Security Policy ───────────────────
// Without nonces (preserves static generation).
// 'unsafe-inline' required for framer-motion inline styles and Next.js runtime.
const isDev = process.env.NODE_ENV === "development";

const cspDefault = [
  "default-src 'self'",
  `script-src 'self'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
]
  .join("; ")
  .replace(/\s{2,}/g, " ")
  .trim();

// Admin CSP: relaxed for media uploads and admin UI needs
const cspAdmin = [
  "default-src 'self'",
  `script-src 'self'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "media-src 'self' blob: data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
]
  .join("; ")
  .replace(/\s{2,}/g, " ")
  .trim();

// ── Permissions Policy ────────────────────────
const permissionsPolicy = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "browsing-topics=()",
  "interest-cohort=()",
  "payment=()",
  "usb=()",
  "magnetometer=()",
  "gyroscope=()",
  "accelerometer=()",
].join(", ");

// ── Next.js Config ────────────────────────────
const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    formats: ["image/avif", "image/webp"],
  },

  async headers() {
    return [
      // ── Global headers (all routes) ─────────────
      {
        source: "/(.*)",
        headers: [
          // HTTPS enforcement (2 years, include subdomains, eligible for HSTS preload list)
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Prevent MIME type sniffing
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Control referrer information
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Disable browser features not needed
          {
            key: "Permissions-Policy",
            value: permissionsPolicy,
          },
          // Legacy XSS protection (still useful for older browsers)
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          // DNS prefetch for performance
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          // Prevent embedding in frames (clickjacking protection)
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Cross-origin isolation headers
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
          // Content Security Policy
          {
            key: "Content-Security-Policy",
            value: cspDefault,
          },
        ],
      },
      // ── Admin routes (relaxed CSP for media) ────
      {
        source: "/admin/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspAdmin,
          },
        ],
      },
      // ── API routes: no cache for dynamic data ───
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
        ],
      },
      // ── Static assets: aggressive caching ───────
      {
        source: "/images/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/videos/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400",
          },
        ],
      },
      {
        source: "/logo/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
