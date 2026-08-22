import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ApplicationProvider } from "@/components/application/ApplicationContext";
import { ApplicationModal } from "@/components/application/ApplicationModal";
import { SiteContentProvider } from "@/lib/hooks/use-site-content";
import { SITE_URL } from "@/lib/constants";
import { validateEnv } from "@/lib/env";
import "./globals.css";

// Validate environment variables on server startup
validateEnv();

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nalik Academy | Professional Video Editing Education",
    template: "%s | Nalik Academy",
  },
  description:
    "Nalik Academy is a skill-focused video editing academy in Addis Ababa, Ethiopia. Master DaVinci Resolve and Adobe Premiere Pro with hands-on, career-focused training.",
  keywords: [
    "video editing",
    "DaVinci Resolve",
    "Adobe Premiere Pro",
    "creative education",
    "Ethiopia",
    "Addis Ababa",
    "motion graphics",
    "post-production",
    "content creation",
  ],
  authors: [{ name: "Nalik Academy" }],
  creator: "Nalik Academy",
  publisher: "Nalik Academy",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_ET",
    url: SITE_URL,
    siteName: "Nalik Academy",
    title: "Nalik Academy | Professional Video Editing Education",
    description:
      "Master DaVinci Resolve and Adobe Premiere Pro with hands-on, career-focused training at Nalik Academy in Addis Ababa, Ethiopia.",
    images: [
      {
        url: "/logo/nalik-acadamey.png",
        width: 1200,
        height: 630,
        alt: "Nalik Academy | Professional Video Editing Education",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nalik Academy | Professional Video Editing Education",
    description:
      "Master DaVinci Resolve and Adobe Premiere Pro with hands-on, career-focused training at Nalik Academy.",
    images: ["/logo/nalik-acadamey.png"],
    creator: "@nalikacademy",
  },
  alternates: {
    canonical: SITE_URL,
  },
  category: "Education",
  icons: {
    icon: [
      { url: "/logo/nalik-acadamey.png", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/logo/nalik-acadamey.png",
    apple: "/logo/nalik-acadamey.png",
  },
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-warm-white text-navy antialiased">
        <SiteContentProvider>
          <ApplicationProvider>
            <Navbar />
            {children}
            <Footer />
            <ApplicationModal />
          </ApplicationProvider>
        </SiteContentProvider>
      </body>
    </html>
  );
}
