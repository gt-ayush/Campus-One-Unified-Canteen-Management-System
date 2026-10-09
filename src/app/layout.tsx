/**
 * SOURCE OF TRUTH KEYWORDS: layout, root-layout, providers, metadata, nextjs-app-router
 * WHAT: Root layout for the Next.js App Router with global providers and metadata
 * WHY: Provides the foundational HTML structure, global providers (React Query, Theme), and metadata for the entire application
 * WHERE: src/app/layout.tsx
 */

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/lib/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "One Campus, One Food Pass",
  description: "Smart Pre-Order and Multi-Canteen Management Platform",
  keywords: ["campus", "food", "pre-order", "canteen", "student", "qr-code"],
  authors: [{ name: "Campus Food Pass Team" }],
  openGraph: {
    title: "One Campus, One Food Pass",
    description: "Smart Pre-Order and Multi-Canteen Management Platform",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}