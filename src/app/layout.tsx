import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nalik Academy",
  description:
    "Professional media production training — filmmaking, video editing, and visual storytelling from industry experts.",
  icons: {
    icon: "/assets/logo.jpeg",
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

        {/* Preload Hero background video assets for instant play */}
        <link rel="preload" href="/assets/hero/poster.jpg" as="image" />
        <link
          rel="preload"
          href="/assets/hero/hero.mp4"
          as="video"
          type="video/mp4"
        />
      </head>
      <body className="min-h-screen bg-white text-navy antialiased">
        {children}
      </body>
    </html>
  );
}