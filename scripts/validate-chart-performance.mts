/**
 * One-off validation: desk chart header % vs Yahoo reference for every range.
 * Run: npx tsx scripts/validate-chart-performance.mts
 */
import {
  CHART_RANGE_KEYS,
  chartRangeDef,
  chartRangeWindow,
  isIntradayMinuteRange,
  type ChartRangeKey,
} from "../src/lib/market/chart-range.ts";
import {
  chartHeaderMove,
  fetchDeskCandles,
  type DeskCandle,
} from "../src/lib/market/fetch-candles.ts";
import { fetchYahooQuote } from "../src/lib/market/yahoo-market.ts";

const SYMBOLS = ["MRAI", "AAPL", "TSLA", "MSFT", "GME"];

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";

function yahooParams(range: ChartRangeKey): {
  interval: string;
  range: string;
} {
  switch (range) {
    case "1m":
    case "5m":
    case "10m":
    case "30m":
    case "1H":
      return { interval: "1m", range: "1d" };
    case "1D":
      return { interval: "5m", range: "5d" };
    case "5D":
      return { interval: "60m", range: "5d" };
    case "1M":
      return { interval: "1d", range: "1mo" };
    case "3M":
      return { interval: "1d", range: "3mo" };
    case "6M":
      return { interval: "1d", range: "6mo" };
    case "YTD":
      return { interval: "1d", range: "ytd" };
    case "1Y":
      return { interval: "1wk", range: "1y" };
    case "5Y":
      return { interval: "1wk", range: "5y" };
    case "ALL":
      return { interval: "1mo", range: "max" };
    default:
      return { interval: "1d", range: "1mo" };
  }
}

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

async function fetchYahooRawCandles(
  symbol: string,
  range: ChartRangeKey,
): Promise<DeskCandle[]> {
  const { interval, range: yRange } = yahooParams(range);
  const url = new URL(`${YAHOO_CHART}/${encodeURIComponent(symbol)}`);
  url.searchParams.set("interval", interval);
  url.searchParams.set("range", yRange);
  url.searchParams.set("includePrePost", "false");
  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "catalyst-intel-desk/1.0",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const payload = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            open?: Array<number | null>;
            high?: Array<number | null>;
            low?: Array<number | null>;
            close?: Array<number | null>;
          }>;
        };
      }>;
    };
  };
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result?.timestamp?.length || !quote) return [];
  const candles: DeskCandle[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const time = result.timestamp[i];
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    if (
      !finite(time) ||
      !finite(open) ||
      !finite(high) ||
      !finite(low) ||
      !finite(close)
    ) {
      continue;
    }
    candles.push({ time, open, high, low, close });
  }
  if (isIntradayMinuteRange(range)) {
    const { fromSec, toSec } = chartRangeWindow(range);
    const live = candles.filter((c) => c.time >= fromSec && c.time <= toSec);
    if (live.length > 0) return live;
    const mins = chartRangeDef(range).lookbackMinutes ?? 1;
    const last = candles[candles.length - 1]!;
    const from = last.time - mins * 60;
    const trailing = candles.filter(
      (c) => c.time >= from && c.time <= last.time,
    );
    return trailing.length > 0 ? trailing : candles.slice(-1);
  }
  return candles;
}

function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function absDiff(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) {
    return null;
  }
  return Math.abs(a - b);
}

function status(
  ourPct: number | null,
  refPct: number | null,
  tolerancePctPoints: number,
): "PASS" | "WARN" | "FAIL" | "SKIP" {
  if (ourPct == null && refPct == null) return "SKIP";
  if (ourPct == null || refPct == null) return "WARN";
  const d = Math.abs(ourPct - refPct);
  if (d <= tolerancePctPoints) return "PASS";
  if (d <= tolerancePctPoints * 3) return "WARN";
  return "FAIL";
}

type Row = {
  symbol: string;
  range: ChartRangeKey;
  ourPct: number | null;
  refPct: number | null;
  oldBuggy1dPct: number | null;
  yahooSessionPct: number | null;
  price: number | null;
  previousClose: number | null;
  bars: number;
  provider: string | null;
  note: string;
  verdict: "PASS" | "WARN" | "FAIL" | "SKIP";
};

async function validateSymbol(symbol: string): Promise<Row[]> {
  const rows: Row[] = [];
  const yahooQuote = await fetchYahooQuote(symbol);

  for (const range of CHART_RANGE_KEYS) {
    const series = await fetchDeskCandles({ symbol, range, allowDemo: false });
    const move = chartHeaderMove({
      range,
      candles: series.candles,
      previousClose: series.previousClose,
    });

    let refPct: number | null = null;
    let note = "";
    let tolerance = 0.35; // percentage points

    if (range === "1D") {
      // Industry session % = price vs previous close (Yahoo quote path).
      refPct = yahooQuote?.changePercent ?? null;
      note = "vs Yahoo session (prev close)";
      tolerance = 0.5; // OTC can be noisy
    } else {
      // Same definition the desk uses for lookbacks: last close vs first open
      // of the vendor series for that window.
      const raw = await fetchYahooRawCandles(symbol, range);
      if (raw.length > 0) {
        const first = raw[0]!;
        const last = raw[raw.length - 1]!;
        if (first.open !== 0) {
          refPct = Number(
            (((last.close - first.open) / first.open) * 100).toFixed(3),
          );
        }
      }
      note = "vs Yahoo first-open lookback";
      if (isIntradayMinuteRange(range)) {
        tolerance = 1.0; // thin tape / bar alignment
        note = "vs Yahoo 1m clip lookback";
      }
    }

    let oldBuggy1dPct: number | null = null;
    if (range === "1D" && series.candles.length > 0) {
      const first = series.candles[0]!;
      const last = series.candles[series.candles.length - 1]!;
      if (first.open !== 0) {
        oldBuggy1dPct = Number(
          (((last.close - first.open) / first.open) * 100).toFixed(3),
        );
      }
    }

    const ourPct = move.changePercent;
    const verdict = status(ourPct, refPct, tolerance);

    rows.push({
      symbol,
      range,
      ourPct,
      refPct,
      oldBuggy1dPct,
      yahooSessionPct: yahooQuote?.changePercent ?? null,
      price: move.price,
      previousClose: series.previousClose,
      bars: series.candles.length,
      provider: series.provider,
      note,
      verdict,
    });

    // Be polite to Yahoo.
    await new Promise((r) => setTimeout(r, 120));
  }

  return rows;
}

function printTable(rows: Row[]) {
  const header = [
    "Symbol".padEnd(6),
    "Range".padEnd(4),
    "Ours".padStart(9),
    "Ref".padStart(9),
    "Δpp".padStart(7),
    "OldBug1D".padStart(9),
    "Bars".padStart(5),
    "Prov".padEnd(7),
    "Result".padEnd(5),
    "Note",
  ].join("  ");
  console.log(header);
  console.log("-".repeat(header.length));

  for (const r of rows) {
    const d = absDiff(r.ourPct, r.refPct);
    console.log(
      [
        r.symbol.padEnd(6),
        r.range.padEnd(4),
        pct(r.ourPct).padStart(9),
        pct(r.refPct).padStart(9),
        (d == null ? "—" : d.toFixed(2)).padStart(7),
        (r.oldBuggy1dPct == null ? "—" : pct(r.oldBuggy1dPct)).padStart(9),
        String(r.bars).padStart(5),
        (r.provider ?? "—").padEnd(7),
        r.verdict.padEnd(5),
        r.note,
      ].join("  "),
    );
  }
}

async function main() {
  console.log("Validating desk chart header % against Yahoo for:");
  console.log(`  symbols: ${SYMBOLS.join(", ")}`);
  console.log(`  ranges:  ${CHART_RANGE_KEYS.join(", ")}`);
  console.log("");

  const all: Row[] = [];
  for (const symbol of SYMBOLS) {
    console.log(`\n=== ${symbol} ===`);
    const rows = await validateSymbol(symbol);
    printTable(rows);
    all.push(...rows);
  }

  const fails = all.filter((r) => r.verdict === "FAIL");
  const warns = all.filter((r) => r.verdict === "WARN");
  const passes = all.filter((r) => r.verdict === "PASS");
  const skips = all.filter((r) => r.verdict === "SKIP");

  console.log("\n=== SUMMARY ===");
  console.log(
    `PASS ${passes.length}  WARN ${warns.length}  FAIL ${fails.length}  SKIP ${skips.length}  TOTAL ${all.length}`,
  );

  // Highlight 1D fix specifically.
  console.log(
    "\n=== 1D FIX CHECK (ours vs Yahoo session; old open-based shown) ===",
  );
  for (const r of all.filter((x) => x.range === "1D")) {
    const fixedDiff = absDiff(r.ourPct, r.yahooSessionPct);
    const buggyDiff = absDiff(r.oldBuggy1dPct, r.yahooSessionPct);
    console.log(
      `${r.symbol}: price=${r.price?.toFixed(2)} pc=${r.previousClose?.toFixed(2)} ours=${pct(r.ourPct)} yahoo=${pct(r.yahooSessionPct)} oldOpenBased=${pct(r.oldBuggy1dPct)} | |ours-yahoo|=${fixedDiff?.toFixed(3) ?? "—"} |old-yahoo|=${buggyDiff?.toFixed(3) ?? "—"} ${r.verdict}`,
    );
  }

  if (fails.length > 0) {
    console.log("\nFAIL details:");
    for (const r of fails) {
      console.log(
        `  ${r.symbol} ${r.range}: ours=${pct(r.ourPct)} ref=${pct(r.refPct)} bars=${r.bars} provider=${r.provider}`,
      );
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
