/**
 * Dedicated FMP economic-calendar runner (~10 min). Keeps FMP off the
 * 1-min multi-source cron so free-tier quota (~250/day) lasts.
 *
 * Local: npm run cron:fmp-econ
 * Prod: cron-job.org POSTs /api/admin/fetch/fmp-econ-calendar with
 * x-cron-secret every 10 minutes (cron expression: star-slash-10).
 *
 * Must run with --conditions=react-server (see npm script).
 */
async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // optional
  }

  const { fetchFmpEconomicCalendar } =
    await import("@/lib/jobs/fetch-fmp-economic-calendar");

  const intervalMinutes = Number(
    process.env.FMP_ECON_CRON_INTERVAL_MINUTES ?? 10,
  );
  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;

  let running = false;

  async function runOnce() {
    if (running) {
      console.log(
        "[cron:fmp-econ] previous run still in progress, skipping this tick",
      );
      return;
    }
    running = true;
    try {
      const result = await fetchFmpEconomicCalendar();
      console.log(
        `[cron:fmp-econ] ${result.ranAt} ${result.status}` +
          `(+${result.inserted}/skip${result.skipped}/err${result.errors})` +
          (result.message ? ` — ${result.message}` : ""),
      );
    } catch (error) {
      console.error(
        "[cron:fmp-econ] run failed:",
        error instanceof Error ? error.message : error,
      );
    } finally {
      running = false;
    }
  }

  console.log(
    `[cron:fmp-econ] starting every ${intervalMinutes} minute(s). Press Ctrl+C to stop.`,
  );
  await runOnce();
  const timer = setInterval(runOnce, intervalMs);

  process.on("SIGINT", () => {
    console.log("\n[cron:fmp-econ] stopping");
    clearInterval(timer);
    process.exit(0);
  });
}

main();
