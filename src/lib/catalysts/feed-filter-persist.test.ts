import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import {
  DEFAULT_FEED_FILTERS,
  FEED_FILTER_IDLE_MS,
  FEED_FILTER_STORAGE_KEY,
  clearPersistedFeedFilters,
  feedApiQuery,
  isFiltersDefault,
  isPanelFiltersDefault,
  readPersistedFeedFilters,
  writePersistedFeedFilters,
} from "./feed-filter-persist";

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
  vi.stubGlobal("window", { localStorage });
  return localStorage;
}

describe("feed-filter-persist", () => {
  let localStorage: ReturnType<typeof installMemoryLocalStorage>;

  beforeEach(() => {
    localStorage = installMemoryLocalStorage();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns null when nothing is stored", () => {
    expect(readPersistedFeedFilters()).toBeNull();
  });

  it("product default has no gates", () => {
    expect(isFiltersDefault(DEFAULT_FEED_FILTERS)).toBe(true);
    expect(isPanelFiltersDefault(DEFAULT_FEED_FILTERS)).toBe(true);
  });

  it("tickerOnly alone does not count as panel filters", () => {
    expect(
      isPanelFiltersDefault({ ...DEFAULT_FEED_FILTERS, tickerOnly: false }),
    ).toBe(true);
    expect(
      isFiltersDefault({ ...DEFAULT_FEED_FILTERS, tickerOnly: false }),
    ).toBe(false);
  });

  it("round-trips multi filters", () => {
    writePersistedFeedFilters({
      tickerQuery: "TSLA",
      categoryFilters: ["news", "earnings"],
      sectorFilters: ["information_technology"],
      formFilters: ["8-K"],
      sourceFilters: ["sec-edgar"],
      timeWindow: "4h",
      tickerOnly: false,
    });
    expect(readPersistedFeedFilters()).toEqual({
      tickerQuery: "TSLA",
      categoryFilters: ["news", "earnings"],
      sectorFilters: ["information_technology"],
      formFilters: ["8-K"],
      sourceFilters: ["sec-edgar"],
      timeWindow: "4h",
      // Always coerced on read — desk rule is not optional.
      tickerOnly: true,
    });
  });

  it("migrates legacy single categoryFilter", () => {
    localStorage.setItem(
      "ci.feed-filters.v1",
      JSON.stringify({
        tickerQuery: "NVDA",
        categoryFilter: "earnings",
        timeWindow: "all",
        lastActiveAt: Date.now(),
      }),
    );
    expect(readPersistedFeedFilters()?.categoryFilters).toEqual(["earnings"]);
  });

  it("does not persist product defaults", () => {
    writePersistedFeedFilters(DEFAULT_FEED_FILTERS);
    expect(localStorage.getItem(FEED_FILTER_STORAGE_KEY)).toBeNull();
  });

  it("expires after idle", () => {
    writePersistedFeedFilters({
      ...DEFAULT_FEED_FILTERS,
      tickerQuery: "AMZN",
    });
    vi.setSystemTime(Date.now() + FEED_FILTER_IDLE_MS + 1);
    expect(readPersistedFeedFilters()).toBeNull();
  });

  it("clearPersistedFeedFilters removes the key", () => {
    writePersistedFeedFilters({
      ...DEFAULT_FEED_FILTERS,
      tickerQuery: "X",
    });
    clearPersistedFeedFilters();
    expect(localStorage.getItem(FEED_FILTER_STORAGE_KEY)).toBeNull();
  });

  it("feedApiQuery encodes filters", () => {
    const qs = feedApiQuery({
      tickerQuery: "AAPL",
      categoryFilters: ["earnings"],
      sectorFilters: ["financials"],
      formFilters: ["8-K"],
      sourceFilters: ["sec-edgar"],
      timeWindow: "24h",
      tickerOnly: false,
    });
    const params = new URLSearchParams(qs);
    expect(params.get("q")).toBe("AAPL");
    expect(params.get("categories")).toBe("earnings");
    expect(params.get("sectors")).toBe("financials");
    expect(params.get("forms")).toBe("8-K");
    expect(params.get("window")).toBe("24h");
    // Always sent — tape gate is not optional.
    expect(params.get("tickerOnly")).toBe("1");
    // Source facet is local-dev only; vitest runs with NODE_ENV=test.
    expect(params.get("sources")).toBeNull();
  });

  it("feedApiQuery includes sources only in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const qs = feedApiQuery({
      ...DEFAULT_FEED_FILTERS,
      sourceFilters: ["sec-edgar"],
    });
    expect(new URLSearchParams(qs).get("sources")).toBe("sec-edgar");
    vi.unstubAllEnvs();
  });

  it("defaults missing tickerOnly to true on read", () => {
    localStorage.setItem(
      FEED_FILTER_STORAGE_KEY,
      JSON.stringify({
        tickerQuery: "X",
        categoryFilters: [],
        sectorFilters: [],
        formFilters: [],
        sourceFilters: [],
        timeWindow: "all",
        lastActiveAt: Date.now(),
      }),
    );
    expect(readPersistedFeedFilters()?.tickerOnly).toBe(true);
  });
});
