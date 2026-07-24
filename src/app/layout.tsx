import type { Metadata, Viewport } from "next";
import { Inter, Roboto } from "next/font/google";

import { PostHogProvider } from "@/components/posthog-provider";
import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
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
      className={`${inter.variable} ${roboto.variable} h-full overflow-x-hidden antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col overflow-x-hidden font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="ci.theme"
        >
          <PostHogProvider>{children}</PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
