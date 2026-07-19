import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function Home() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect("/dashboard");
    }
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div aria-hidden className="desk-grid pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[42vh] bg-[radial-gradient(ellipse_at_top,rgba(148,163,184,0.14),transparent_60%)]"
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span
            aria-hidden
            className="inline-block size-2 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.55)]"
          />
          Catalyst Intel
        </div>
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "btn-press")}
        >
          Sign in
        </Link>
      </header>

      <main className="page-enter relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 pb-20 pt-8 text-center">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-amber-400/90">
          For day traders
        </p>
        <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Catalyst Intel
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-pretty text-base text-muted-foreground sm:text-lg">
          Spot market-moving filings before the crowd — SEC 8-Ks ranked for urgency on a
          live trading desk feed.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ size: "lg" }),
              "btn-press bg-amber-500 text-zinc-950 hover:bg-amber-400",
            )}
          >
            Sign in with Google
          </Link>
        </div>
        <p className="mt-6 font-mono text-xs text-muted-foreground">
          After sign-in you land on the Live feed.
        </p>
      </main>
    </div>
  );
}
