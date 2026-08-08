import { cn } from "@/lib/utils";
import type { UsageStats } from "@/lib/ops/usage-stats";

function pct(used: number, limit: number | null): number | null {
  if (limit == null || limit <= 0) return null;
  return Math.min(100, Math.round((used / limit) * 100));
}

function barTone(percent: number | null): string {
  if (percent == null) return "bg-[var(--desk-live)]";
  if (percent >= 90) return "bg-[var(--desk-negative)]";
  if (percent >= 70) return "bg-[var(--desk-live)]";
  return "bg-[var(--desk-live-status)]";
}

/**
 * Admin consumption snapshot — delivery volume vs soft caps + app rate-limit presets.
 */
export function UsageConsumptionPanel({ stats }: { stats: UsageStats }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.channels
          .filter((c) => c.channel !== "webhook")
          .map((c) => {
            const percent = pct(c.sent24h, c.softDailyLimit);
            const label =
              c.channel === "email"
                ? "Email"
                : c.channel === "telegram"
                  ? "Telegram"
                  : "Push";
            const configured =
              c.channel === "email"
                ? stats.configured.email
                : c.channel === "telegram"
                  ? stats.configured.telegram
                  : stats.configured.push;

            return (
              <div
                key={c.channel}
                className="rounded-xl border border-[var(--desk-border)] bg-[var(--desk-header)]/40 px-3.5 py-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--desk-text)]">
                    {label}
                  </p>
                  <span className="font-mono text-[0.6rem] tracking-wide text-[var(--desk-text-dim)] uppercase">
                    {configured ? "on" : "off"}
                  </span>
                </div>
                <p className="mt-2 font-mono text-2xl text-[var(--desk-text)] tabular-nums">
                  {c.sent24h}
                  {c.softDailyLimit != null ? (
                    <span className="text-sm text-[var(--desk-text-muted)]">
                      {" "}
                      / {c.softDailyLimit}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[0.7rem] text-[var(--desk-text-muted)]">
                  sent · last 24h
                  {c.failed24h > 0 ? ` · ${c.failed24h} failed` : ""}
                </p>
                {c.softDailyLimit != null ? (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--desk-overlay-strong)]">
                    <div
                      className={cn("h-full rounded-full", barTone(percent))}
                      style={{ width: `${percent ?? 0}%` }}
                    />
                  </div>
                ) : (
                  <p className="mt-3 text-[0.7rem] text-[var(--desk-text-dim)]">
                    7d: {c.sent7d} sent
                    {c.failed7d > 0 ? ` · ${c.failed7d} failed` : ""}
                  </p>
                )}
                {c.softDailyLimit != null ? (
                  <p className="mt-1.5 text-[0.7rem] text-[var(--desk-text-dim)]">
                    7d: {c.sent7d} sent
                    {percent != null && percent >= 70
                      ? ` · ${percent}% of daily soft cap`
                      : ""}
                  </p>
                ) : null}
              </div>
            );
          })}

        <div className="rounded-xl border border-[var(--desk-border)] bg-[var(--desk-header)]/40 px-3.5 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--desk-text)]">
              Vendors
            </p>
            <span className="font-mono text-[0.6rem] tracking-wide text-[var(--desk-text-dim)] uppercase">
              {stats.configured.openRouter ? "AI on" : "AI off"}
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl text-[var(--desk-text)] tabular-nums">
            {stats.vendorsRateLimited}
          </p>
          <p className="mt-0.5 text-[0.7rem] text-[var(--desk-text-muted)]">
            sources last status = rate_limited
          </p>
        </div>
      </div>

      <p className="text-xs text-[var(--desk-text-muted)]">
        {stats.softLimits.note}
      </p>

      <details className="rounded-xl border border-[var(--desk-border)] bg-[var(--desk-header)]/30 px-3.5 py-3">
        <summary className="cursor-pointer font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
          App rate-limit presets (per isolate)
        </summary>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {stats.appRateLimits.map((r) => (
            <li
              key={r.key}
              className="flex items-center justify-between gap-2 font-mono text-[0.7rem] text-[var(--desk-text-secondary)]"
            >
              <span>{r.key}</span>
              <span className="text-[var(--desk-text-dim)] tabular-nums">
                {r.limit}/{Math.round(r.windowMs / 1000)}s
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
