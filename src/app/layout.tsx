import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";

import { PostHogProvider } from "@/components/posthog-provider";
import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

/**
 * Font decision (trader UX research → interesting + dense-feed readable):
 * WINNER: Space Grotesk + JetBrains Mono.
 *
 * Criteria for this audience (day traders / catalyst watchers): authority,
 * scan speed, data clarity, terminal heritage, modern premium — not Inter/
 * Geist/Roboto SaaS generics.
 *
 * Space Grotesk wins the sans for user interest: geometric, technical, and
 * distinctive on marketing hero while staying clear at feed-row sizes.
 * IBM Plex remains strong for institutional calm but reads more "corporate
 * default" than memorable product. JetBrains Mono wins the mono: terminal /
 * IDE heritage traders recognize, sharper SYMBOL/TIME columns than Plex Mono.
 *
 * See PR body for full 4+ candidate comparison.
 */
const deskSans = Space_Grotesk({
  variable: "--font-desk-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const deskMono = JetBrains_Mono({
  variable: "--font-desk-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
      className={`${deskSans.variable} ${deskMono.variable} h-full overflow-x-hidden antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col overflow-x-hidden font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="ci.theme"
        >
          <PostHogProvider>{children}</PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
