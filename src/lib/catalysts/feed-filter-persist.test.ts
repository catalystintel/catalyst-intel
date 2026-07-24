import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import {
  DEFAULT_FEED_FILTERS,
  FEED_FILTER_IDLE_MS,
  FEED_FILTER_STORAGE_KEY,
  clearPersistedFeedFilters,
  isFiltersDefault,
  minScoreForFeedImpactFloor,
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

  it("product default is Med+ with no other gates", () => {
    expect(DEFAULT_FEED_FILTERS.minImpact).toBe("medium");
    expect(isFiltersDefault(DEFAULT_FEED_FILTERS)).toBe(true);
    expect(minScoreForFeedImpactFloor("medium")).toBe(45);
    expect(minScoreForFeedImpactFloor("high")).toBe(70);
  });

  it("round-trips active filters within the idle window", () => {
    writePersistedFeedFilters({
      tickerQuery: "TSLA",
      categoryFilter: "news",
      timeWindow: "4h",
      minImpact: "high",
    });
    expect(readPersistedFeedFilters()).toEqual({
      tickerQuery: "TSLA",
      categoryFilter: "news",
      timeWindow: "4h",
      minImpact: "high",
    });
  });

  it("persists All impact (non-default) even with empty ticker", () => {
    writePersistedFeedFilters({
      ...DEFAULT_FEED_FILTERS,
      minImpact: "all",
    });
    expect(readPersistedFeedFilters()?.minImpact).toBe("all");
  });

  it("does not persist product defaults", () => {
    writePersistedFeedFilters(DEFAULT_FEED_FILTERS);
    expect(localStorage.getItem(FEED_FILTER_STORAGE_KEY)).toBeNull();
  });

  it("expires after 1 hour of idle and clears storage", () => {
    writePersistedFeedFilters({
      tickerQuery: "AMZN",
      categoryFilter: null,
      timeWindow: "1h",
      minImpact: "medium",
    });
    vi.setSystemTime(Date.now() + FEED_FILTER_IDLE_MS + 1);
    expect(readPersistedFeedFilters()).toBeNull();
    expect(localStorage.getItem(FEED_FILTER_STORAGE_KEY)).toBeNull();
  });

  it("defaults missing minImpact on legacy payloads to Med+", () => {
    localStorage.setItem(
      FEED_FILTER_STORAGE_KEY,
      JSON.stringify({
        tickerQuery: "NVDA",
        categoryFilter: null,
        timeWindow: "all",
        lastActiveAt: Date.now(),
      }),
    );
    expect(readPersistedFeedFilters()).toEqual({
      tickerQuery: "NVDA",
      categoryFilter: null,
      timeWindow: "all",
      minImpact: "medium",
    });
  });

  it("clearPersistedFeedFilters removes the key", () => {
    writePersistedFeedFilters({
      tickerQuery: "X",
      categoryFilter: null,
      timeWindow: "all",
      minImpact: "high",
    });
    clearPersistedFeedFilters();
    expect(localStorage.getItem(FEED_FILTER_STORAGE_KEY)).toBeNull();
  });
});
