import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import { PostHogProvider } from "@/components/posthog-provider";
import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

/**
 * Font decision (trader desk research): KEEP IBM Plex Sans + Mono.
 * Winner because one coherent family covers dense feed rows, marketing
 * headlines, and tabular mono for symbols/times — terminal/fintech feel
 * without Inter/Geist AI-SaaS generics. Runners-up rejected: Source Sans 3
 * (strong UI but no matching mono; less desk character), Geist (Vercel/AI
 * SaaS association), JetBrains Mono as UI body (too mono for marketing),
 * DM Sans (previous default — softer, less terminal).
 */
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
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
      className={`${plexSans.variable} ${plexMono.variable} h-full overflow-x-hidden antialiased`}
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
