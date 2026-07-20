import type { Metadata, Viewport } from "next";
import { DM_Sans, IBM_Plex_Mono } from "next/font/google";

import { PostHogProvider } from "@/components/posthog-provider";

import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Catalyst Intel",
  description:
    "Live SEC catalysts for day traders — on-spot filings on a trading-desk feed.",
};

/** Phone-friendly viewport; `viewportFit` keeps notched Safari usable. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${dmSans.variable} ${plexMono.variable} h-full overflow-x-hidden antialiased`}
    >
      <body className="flex min-h-dvh flex-col overflow-x-hidden font-sans">
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
