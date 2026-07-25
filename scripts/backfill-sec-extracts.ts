/**
 * One-shot: backfill SEC primary-doc extracts for rows that still lack them.
 * Usage: npx tsx scripts/backfill-sec-extracts.ts [limit=200]
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("module") as typeof import("module") & {
  prototype: { require: (...args: unknown[]) => unknown };
};
const originalRequire = Module.prototype.require;
Module.prototype.require = function (
  this: NodeModule,
  id: string,
  ...rest: unknown[]
) {
  if (id === "server-only") return {};
  return originalRequire.apply(this, [id, ...rest] as never);
};

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    /* optional */
  }
  const limit = Math.max(1, Number(process.argv[2] ?? 200) || 200);
  const { getSecUserAgent } = await import("@/lib/jobs/sec-edgar-http");
  const { backfillSecFilingExtractsFromDb } =
    await import("@/lib/jobs/enrich-sec-filings");
  console.log(`[backfill] enriching up to ${limit} SEC rows…`);
  const result = await backfillSecFilingExtractsFromDb({
    userAgent: getSecUserAgent(),
    limit,
    mode: "primary",
  });
  console.log(
    `[backfill] scanned=${result.scanned} enriched=${result.enriched}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
