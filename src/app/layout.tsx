import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ClientShell } from "@/components/ClientShell";
import { SOCIAL_LINKS } from "@/lib/socials";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Nalik Academy | Film & Video Editing Training in Ethiopia",
    template: "%s | Nalik Academy",
  },
  description:
    "Learn filmmaking, video editing, and media production through practical training in Addis Ababa, Ethiopia. Build creative skills with Nalik Academy.",
  applicationName: "Nalik Academy",
  keywords: [
    "Nalik Academy",
    "video editing training Ethiopia",
    "filmmaking school Addis Ababa",
    "media production training",
    "film school Ethiopia",
    "creative media academy",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Nalik Academy | Film & Video Editing Training in Ethiopia",
    description:
      "Learn filmmaking, video editing, and media production through practical training in Addis Ababa, Ethiopia.",
    url: `${siteUrl}/`,
    siteName: "Nalik Academy",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/assets/hero/poster.jpg",
        width: 1280,
        height: 720,
        alt: "Nalik Academy - Master the Art of Visual Storytelling",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nalik Academy | Film & Video Editing Training in Ethiopia",
    description: "Practical filmmaking and video editing training in Addis Ababa, Ethiopia.",
    images: ["/assets/hero/poster.jpg"],
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
  const organizationSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EducationalOrganization",
        "@id": `${siteUrl}/#organization`,
        name: "Nalik Academy",
        url: `${siteUrl}/`,
        description: metadata.description,
        logo: `${siteUrl}/assets/logo.jpeg`,
        image: `${siteUrl}/assets/hero/poster.jpg`,
        telephone: "+251979989079",
        address: {
          "@type": "PostalAddress",
          streetAddress: "Yeab Building, 5th Floor",
          addressLocality: "Addis Ababa",
          addressCountry: "ET",
        },
        sameAs: SOCIAL_LINKS.map((link) => link.href),
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: `${siteUrl}/`,
        name: "Nalik Academy",
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: ["en", "am"],
      },
    ],
  };

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="/" />
        <link
          rel="preload"
          as="image"
          type="image/webp"
          href="/assets/hero/poster.webp"
          imageSrcSet="/assets/hero/poster-640.webp 640w, /assets/hero/poster-960.webp 960w, /assets/hero/poster.webp 1280w"
          imageSizes="100vw"
          fetchPriority="high"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body className="min-h-screen bg-white text-navy antialiased">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
