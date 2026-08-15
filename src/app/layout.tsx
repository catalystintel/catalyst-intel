import type { Metadata, Viewport } from "next";
import { DM_Mono, DM_Sans } from "next/font/google";

import { PostHogProvider } from "@/components/posthog-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { APP_NAME } from "@/lib/brand";

import "./globals.css";

/** Signal Fintech system theme: DM Sans + DM Mono, TradingView dark + mint. */
const deskSans = DM_Sans({
  variable: "--font-desk-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const deskMono = DM_Mono({
  variable: "--font-desk-mono",
  subsets: ["latin"],
  // DM Mono only ships 300/400/500 — 600/700 break next/font.
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  applicationName: APP_NAME,
  description:
    "Live SEC catalysts for day traders — on-spot filings on a trading-desk feed.",
  openGraph: {
    siteName: APP_NAME,
  },
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
          storageKey="ci.theme.signal"
        >
          <PostHogProvider>{children}</PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
