import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = (
  process.env.NEXT_PUBLIC_APP_URL || "https://nalik-acadamey.vercel.app"
).replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Nalik Academy",
    template: "%s | Nalik Academy",
  },
  description:
    "Nalik Academy offers professional media production training in filmmaking, video editing, photography, and visual storytelling for students and creatives.",
  applicationName: "Nalik Academy",
  keywords: [
    "Nalik Academy",
    "Nalik Acadeamey",
    "Nalik Academy Ethiopia",
    "film school",
    "media production training",
    "video editing training",
    "filmmaking courses",
    "creative media education",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Nalik Academy",
    description:
      "Professional media production training in filmmaking, video editing, and visual storytelling.",
    url: siteUrl,
    siteName: "Nalik Academy",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nalik Academy",
    description:
      "Professional media production training in filmmaking, video editing, and visual storytelling.",
  },
  icons: {
    icon: "/assets/logo.jpeg",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#151B29",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Performance: preconnect to self for API calls */}
        <link rel="preconnect" href="/" />

        {/* Poster preload is supported everywhere. The hero <video> element
            already uses preload="auto", so a <link rel=preload as=video> is
            redundant AND unsupported in Chrome (it logs a console warning
            and is ignored). */}
        <link rel="preload" href="/assets/hero/poster.jpg" as="image" />
      </head>
      <body className="min-h-screen bg-white text-navy antialiased">
        {children}
      </body>
    </html>
  );
}