import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Catalyst Intelligence Platform
        </span>
        <h1 className="text-4xl font-semibold tracking-tight">
          Find market-moving events before the crowd.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Real-time catalyst detection from SEC filings, FDA actions, and more —
          ranked by impact, built for traders.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "default" }))}>
          View dashboard
        </Link>
        <Link href="/login" className={cn(buttonVariants({ variant: "outline" }))}>
          Log in
        </Link>
      </div>
    </div>
  );
}
