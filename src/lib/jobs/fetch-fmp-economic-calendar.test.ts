import { describe, expect, it, vi } from "vitest";

import {
  classifyFmpMacroEvent,
  fetchFmpEconomicCalendar,
  fmpRowToMacroEventDef,
  fmpRowToNormalized,
  shouldIngestFmpEvent,
  utcDateTimeToTimeEt,
  type FmpEconomicEvent,
} from "@/lib/jobs/fetch-fmp-economic-calendar";

const sampleCpi: FmpEconomicEvent = {
  date: "2026-08-12 12:30:00",
  country: "US",
  event: "CPI YoY",
  currency: "USD",
  previous: 2.7,
  estimate: 2.6,
  actual: null,
  impact: "High",
};

describe("classifyFmpMacroEvent", () => {
  it("maps core desk names", () => {
    expect(classifyFmpMacroEvent("CPI YoY")).toBe("cpi");
    expect(classifyFmpMacroEvent("Non-Farm Payrolls")).toBe("nfp");
    expect(classifyFmpMacroEvent("PPI MoM")).toBe("ppi");
    expect(classifyFmpMacroEvent("FOMC Rate Decision")).toBe("fomc");
    expect(classifyFmpMacroEvent("Initial Jobless Claims")).toBe("other");
  });
});

describe("shouldIngestFmpEvent", () => {
  it("keeps US high impact", () => {
    expect(shouldIngestFmpEvent(sampleCpi)).toBe(true);
  });

  it("drops non-US", () => {
    expect(shouldIngestFmpEvent({ ...sampleCpi, country: "GB" })).toBe(false);
  });

  it("keeps medium core desk prints", () => {
    expect(
      shouldIngestFmpEvent({ ...sampleCpi, impact: "Medium", event: "CPI" }),
    ).toBe(true);
  });
});

describe("fmpRowToNormalized / MacroEventDef", () => {
  it("builds tape + desk shapes", () => {
    const n = fmpRowToNormalized(sampleCpi);
    expect(n?.provider).toBe("fmp-econ-calendar");
    expect(n?.eventCategory).toBe("macro");
    expect(n?.subcategory).toBe("cpi");
    expect(n?.summary).toContain("Est 2.6");

    const desk = fmpRowToMacroEventDef(sampleCpi);
    expect(desk?.subcategory).toBe("cpi");
    expect(desk?.date).toBe("2026-08-12");
    expect(desk?.timeEt).toBe(utcDateTimeToTimeEt(sampleCpi.date));
  });

  it("filters non-US from normalize", () => {
    const rows: FmpEconomicEvent[] = [
      sampleCpi,
      {
        date: "2026-08-12 12:30:00",
        country: "GB",
        event: "CPI YoY",
        impact: "High",
      },
    ];
    const normalized = rows
      .map(fmpRowToNormalized)
      .filter((n): n is NonNullable<typeof n> => n != null);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.externalId).toContain("cpi");
  });
});

describe("fetchFmpEconomicCalendar", () => {
  it("soft-skips without API key", async () => {
    const prev = process.env.FMP_API_KEY;
    delete process.env.FMP_API_KEY;
    const result = await fetchFmpEconomicCalendar({
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    expect(result.status).toBe("skipped");
    expect(result.configured).toBe(false);
    if (prev) process.env.FMP_API_KEY = prev;
    else delete process.env.FMP_API_KEY;
  });

  it("soft-skips HTTP 402 paid gate", async () => {
    process.env.FMP_API_KEY = "test-key";
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ Error: "Payment Required" }), {
          status: 402,
        }),
    ) as unknown as typeof fetch;
    const result = await fetchFmpEconomicCalendar({ fetchImpl });
    expect(result.status).toBe("skipped");
    expect(result.configured).toBe(true);
    expect(result.message).toMatch(/402|paid/i);
    delete process.env.FMP_API_KEY;
  });

  it("marks rateLimited on HTTP 429", async () => {
    process.env.FMP_API_KEY = "test-key";
    const result = await fetchFmpEconomicCalendar({
      fetchImpl: vi.fn(
        async () => new Response("", { status: 429 }),
      ) as unknown as typeof fetch,
    });
    expect(result.rateLimited).toBe(true);
    expect(result.status).toBe("error");
    delete process.env.FMP_API_KEY;
  });
});
