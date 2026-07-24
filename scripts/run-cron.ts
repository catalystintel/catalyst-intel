/**
 * Local continuous ingestion runner. Start with `npm run cron` and leave it
 * running in its own terminal while you develop - it re-fetches all catalyst
 * sources on an interval so the dashboard always has fresh data.
 *
 * In production the same job is triggered by cron-job.org every 1 minute
 * hitting `/api/admin/fetch/all` (optional GHA backup) — see ARCHITECTURE.md
 * and DEPLOYMENT.md.
 */
async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // .env.local is optional (e.g. if vars are already set in the shell).
  }

  // Dynamic import so env vars are loaded before any module (like the DB
  // client) reads process.env at import time - static imports are hoisted
  // above this point and would run too early.
  const { fetchAllCatalystSources } =
    await import("@/lib/jobs/fetch-all-sources");

  const intervalMinutes = Number(process.env.CRON_INTERVAL_MINUTES ?? 1);
  const intervalMs = intervalMinutes * 60 * 1000;

  let running = false;

  async function runOnce() {
    if (running) {
      console.log("[cron] previous run still in progress, skipping this tick");
      return;
    }
    running = true;
    try {
      const result = await fetchAllCatalystSources();
      const parts = result.sources
        .map(
          (s) =>
            `${s.source}:${s.status}(+${s.inserted}/skip${s.skipped}/err${s.errors})`,
        )
        .join(" ");
      console.log(
        `[cron] ${result.ranAt} totals inserted=${result.totals.inserted} skipped=${result.totals.skipped} errors=${result.totals.errors} | ${parts}`,
      );
    } catch (error) {
      console.error(
        "[cron] run failed:",
        error instanceof Error ? error.message : error,
      );
    } finally {
      running = false;
    }
  }

  console.log(
    `[cron] starting multi-source ingest every ${intervalMinutes} minute(s). Press Ctrl+C to stop.`,
  );
  await runOnce();
  const timer = setInterval(runOnce, intervalMs);

  process.on("SIGINT", () => {
    console.log("\n[cron] stopping");
    clearInterval(timer);
    process.exit(0);
  });
}

main();
