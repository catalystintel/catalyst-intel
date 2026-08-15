import { redirect } from "next/navigation";

import { LandingGoogleCta } from "@/components/landing-google-cta";
import { LandingGuestSearch } from "@/components/landing-guest-search";
import { LandingHeroFeedPreview } from "@/components/landing-hero-feed-preview";
import { PreLoginChrome } from "@/components/pre-login-chrome";
import { PreLoginLandingSections } from "@/components/pre-login-landing-sections";
import { PreloginRisingChart } from "@/components/prelogin-rising-chart";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isAdminEmail } from "@/lib/auth/admin";
import { getSignInStartHref } from "@/lib/auth/dev-bypass";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // Local/owner convenience: `?preview=1` outside production lets an
    // allowlisted admin reload `/` to check landing design without signing out.
    const isPreviewBypass =
      process.env.NODE_ENV !== "production" &&
      preview === "1" &&
      isAdminEmail(user?.email);
    if (user && !isPreviewBypass) {
      redirect("/catalyst-feed");
    }
  }

  return (
    <PreLoginChrome glowClassName="h-[55vh]">
      <main className="page-enter relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-start gap-10 px-4 pt-2 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:gap-12 sm:px-8 sm:pt-6 sm:pb-20">
        <PreloginRisingChart />
        {/* Hero: text/CTA beside the feed preview on desktop/tablet (matches
            reference design), stacking back to a single column on mobile. */}
        <div className="relative z-[1] grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-10">
          <div className="max-w-2xl">
            <h1 className="marketing-headline text-4xl text-balance text-[var(--desk-text)] sm:text-5xl">
              Real-Time Market-Moving Catalysts. Trade Smarter, Faster.
            </h1>
            <p className="desk-body mt-4 max-w-xl text-pretty text-[var(--desk-text-secondary)] sm:text-base sm:leading-relaxed">
              Instant alerts, AI-powered summaries, and plain-language insights
              on earnings, filings, events and more — so you never miss what
              moves the market.
            </p>
            <div className="mt-8">
              <LandingGoogleCta
                showIcon
                subtext="Full access during Open Early Access"
              />
            </div>
            <div className="mt-5">
              <LandingGuestSearch signInHref={getSignInStartHref()} />
            </div>
          </div>

          <LandingHeroFeedPreview />
        </div>

        <div className="relative z-[1] mt-6 sm:mt-10">
          <PreLoginLandingSections />
        </div>
      </main>
    </PreLoginChrome>
  );
}
