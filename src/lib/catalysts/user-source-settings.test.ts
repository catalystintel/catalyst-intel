import {
  normalizeShowSourceLabels,
  constrainProvidersForEnabledSources,
  defaultEnabledFeedSources,
  FEED_ROW_SOURCE_IDS,
  isAllFeedSourcesEnabled,
  mergeSourceProviderFilters,
  NO_FEED_PROVIDER,
  normalizeEnabledSources,
  providersForEnabledSources,
  providersForSourceId,
} from "@/lib/catalysts/user-source-settings";

describe("user-source-settings", () => {
  it("excludes polygon-prices from feed-row sources", () => {
    expect(FEED_ROW_SOURCE_IDS).not.toContain("polygon-prices");
    expect(FEED_ROW_SOURCE_IDS).toContain("sec-edgar");
    expect(FEED_ROW_SOURCE_IDS).toContain("polygon-news");
  });

  it("maps polygon-news to provider polygon", () => {
    expect(providersForSourceId("polygon-news")).toEqual(["polygon"]);
    expect(providersForSourceId("sec-edgar")).toEqual(["sec-edgar"]);
    expect(providersForSourceId("polygon-prices")).toEqual([]);
  });

  it("normalizes junk and drops enrichment-only ids", () => {
    expect(
      normalizeEnabledSources([
        "sec-edgar",
        "nope",
        "polygon-prices",
        "finnhub",
        "sec-edgar",
      ]),
    ).toEqual(["sec-edgar", "finnhub"]);
  });

  it("defaults to every feed-row source", () => {
    expect(defaultEnabledFeedSources()).toEqual([...FEED_ROW_SOURCE_IDS]);
    expect(isAllFeedSourcesEnabled(defaultEnabledFeedSources())).toBe(true);
  });

  it("returns null provider constraint when all sources are on", () => {
    expect(
      constrainProvidersForEnabledSources(defaultEnabledFeedSources()),
    ).toBeNull();
  });

  it("returns providers for a subset and sentinel when empty", () => {
    expect(
      constrainProvidersForEnabledSources(["sec-edgar", "pr-wire"]),
    ).toEqual(["sec-edgar", "pr-wire"]);
    expect(constrainProvidersForEnabledSources(["polygon-news"])).toEqual([
      "polygon",
    ]);
    expect(constrainProvidersForEnabledSources([])).toEqual([NO_FEED_PROVIDER]);
    expect(providersForEnabledSources([])).toEqual([]);
  });

  it("merges admin providers with existing local-dev facet", () => {
    expect(mergeSourceProviderFilters([], ["sec-edgar"])).toEqual([
      "sec-edgar",
    ]);
    expect(
      mergeSourceProviderFilters(
        ["sec-edgar", "finnhub"],
        ["finnhub", "pr-wire"],
      ),
    ).toEqual(["finnhub"]);
    expect(
      mergeSourceProviderFilters(["macro-calendar"], ["sec-edgar"]),
    ).toEqual([NO_FEED_PROVIDER]);
    expect(mergeSourceProviderFilters(["sec-edgar"], null)).toEqual([
      "sec-edgar",
    ]);
  });

  it("normalizes showSourceLabels from JSON-ish values", () => {
    expect(normalizeShowSourceLabels(true)).toBe(true);
    expect(normalizeShowSourceLabels(1)).toBe(true);
    expect(normalizeShowSourceLabels("true")).toBe(true);
    expect(normalizeShowSourceLabels("1")).toBe(true);
    expect(normalizeShowSourceLabels(false)).toBe(false);
    expect(normalizeShowSourceLabels(0)).toBe(false);
    expect(normalizeShowSourceLabels(null)).toBe(false);
    expect(normalizeShowSourceLabels(undefined)).toBe(false);
    expect(normalizeShowSourceLabels("no")).toBe(false);
  });
});
