/**
 * Local continuous ingestion runner. Start with `npm run cron` and leave it
 * running in its own terminal while you develop - it re-fetches SEC EDGAR
 * on an interval so the dashboard always has fresh data.
 *
 * In production this same job is instead triggered by a GitHub Actions
 * schedule hitting the deployed admin endpoint - see DEPLOYMENT.md.
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
  const { fetchSecEdgar } = await import("@/lib/jobs/fetch-sec-edgar");

  const intervalMinutes = Number(process.env.CRON_INTERVAL_MINUTES ?? 2);
  const intervalMs = intervalMinutes * 60 * 1000;

  let running = false;

  async function runOnce() {
    if (running) {
      console.log("[cron] previous run still in progress, skipping this tick");
      return;
    }
    running = true;
    try {
      const result = await fetchSecEdgar();
      console.log(
        `[cron] ${result.ranAt} fetched=${result.fetched} inserted=${result.inserted} skipped=${result.skipped} errors=${result.errors}`,
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
    `[cron] starting - running every ${intervalMinutes} minute(s). Press Ctrl+C to stop.`,
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
