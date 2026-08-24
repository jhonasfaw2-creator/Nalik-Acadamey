import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nalik Academy",
  description:
    "Professional media production training — filmmaking, video editing, and visual storytelling from industry experts.",
  icons: {
    icon: "/assets/logo.jpeg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-navy antialiased">
        {children}
      </body>
    </html>
  );
}
