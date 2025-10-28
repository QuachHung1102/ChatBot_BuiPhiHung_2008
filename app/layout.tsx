import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AS Chatbot",
  description: "A polished test chatbot UI with anonymous conversations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="relative min-h-screen">
          {/* Background gradient */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_circle_at_50%_-200px,rgba(59,130,246,0.15),transparent_60%),radial-gradient(800px_circle_at_0%_100%,rgba(16,185,129,0.12),transparent_50%)] dark:bg-[radial-gradient(1200px_circle_at_50%_-200px,rgba(59,130,246,0.2),transparent_60%),radial-gradient(800px_circle_at_0%_100%,rgba(16,185,129,0.18),transparent_50%)]" />

          {/* Animated blobs */}
          <div aria-hidden className="pointer-events-none absolute -left-20 top-10 -z-10 h-56 w-56 rounded-full bg-gradient-to-br from-blue-500/30 to-indigo-500/30 blur-3xl animate-blob" />
          <div aria-hidden className="pointer-events-none absolute -right-16 bottom-20 -z-10 h-48 w-48 rounded-full bg-gradient-to-br from-emerald-400/30 to-cyan-400/30 blur-3xl animate-blob animation-delay-2000" />

          {children}
        </div>
      </body>
    </html>
  );
}
