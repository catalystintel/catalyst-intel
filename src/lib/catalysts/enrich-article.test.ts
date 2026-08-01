import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                all: async () => [],
              }),
            }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@/db/env", () => ({
  isLibsqlConfigured: () => false,
}));

vi.mock("@/lib/jobs/vendor-env", () => ({
  getFinnhubApiKey: vi.fn(),
  getPolygonApiKey: vi.fn(),
}));

import {
  clearArticleEnrichmentCache,
  fetchArticleEnrichment,
} from "./enrich-article";
import { getFinnhubApiKey, getPolygonApiKey } from "@/lib/jobs/vendor-env";

const finnhubKey = getFinnhubApiKey as unknown as ReturnType<typeof vi.fn>;
const polygonKey = getPolygonApiKey as unknown as ReturnType<typeof vi.fn>;

describe("fetchArticleEnrichment", () => {
  beforeEach(() => {
    clearArticleEnrichmentCache();
    finnhubKey.mockReset();
    polygonKey.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns empty enrichment without symbol or keys", async () => {
    finnhubKey.mockReturnValue(null);
    polygonKey.mockReturnValue(null);
    expect(await fetchArticleEnrichment({ symbol: null })).toEqual({
      profile: null,
      relatedHeadlines: [],
      quote: null,
    });
    expect(await fetchArticleEnrichment({ symbol: "!!!" })).toEqual({
      profile: null,
      relatedHeadlines: [],
      quote: null,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches Finnhub profile, news, and quote when key is set", async () => {
    finnhubKey.mockReturnValue("fh-test");
    polygonKey.mockReturnValue(null);

    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/stock/profile2")) {
          return Response.json({
            name: "Apple Inc",
            symbol: "AAPL",
            finnhubIndustry: "Technology",
            marketCapitalization: 3_200_000,
            exchange: "NASDAQ NMS",
            country: "US",
            weburl: "https://www.apple.com",
          });
        }
        if (url.includes("/company-news")) {
          return Response.json([
            {
              headline: "Apple unveils new chip",
              datetime: 1_720_000_000,
              source: "Reuters",
              url: "https://example.com/aapl-1",
            },
            {
              headline: "Apple unveils new chip",
              datetime: 1_720_000_100,
              source: "Dup",
              url: "https://example.com/dup",
            },
            {
              headline: "Services revenue climbs",
              datetime: 1_719_900_000,
              source: "Bloomberg",
              url: "https://example.com/aapl-2",
            },
          ]);
        }
        if (url.includes("/quote")) {
          return Response.json({
            c: 190.5,
            d: 1.25,
            dp: 0.66,
            h: 191,
            l: 188,
            o: 189,
            pc: 189.25,
            t: 1_720_000_000,
          });
        }
        return new Response("not found", { status: 404 });
      },
    );

    const result = await fetchArticleEnrichment({
      symbol: "aapl",
      excludeCatalystId: 99,
    });

    expect(result.profile?.name).toBe("Apple Inc");
    expect(result.profile?.industry).toBe("Technology");
    expect(result.quote?.price).toBe(190.5);
    expect(result.quote?.provider).toBe("finnhub");
    expect(result.relatedHeadlines).toHaveLength(2);
    expect(result.relatedHeadlines[0]?.title).toBe("Apple unveils new chip");
  });

  it("soft-fails vendor errors and still returns a usable object", async () => {
    finnhubKey.mockReturnValue("fh-test");
    polygonKey.mockReturnValue(null);
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network down"),
    );

    await expect(fetchArticleEnrichment({ symbol: "MSFT" })).resolves.toEqual({
      profile: null,
      relatedHeadlines: [],
      quote: null,
    });
  });

  it("caches enrichment briefly", async () => {
    finnhubKey.mockReturnValue("fh-test");
    polygonKey.mockReturnValue(null);
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/stock/profile2")) {
        return Response.json({ name: "NVIDIA", symbol: "NVDA" });
      }
      if (url.includes("/company-news")) {
        return Response.json([]);
      }
      if (url.includes("/quote")) {
        return Response.json({
          c: 10,
          d: 0,
          dp: 0,
          h: 10,
          l: 10,
          o: 10,
          pc: 10,
          t: 1,
        });
      }
      return new Response("not found", { status: 404 });
    });

    await fetchArticleEnrichment({ symbol: "NVDA" });
    await fetchArticleEnrichment({ symbol: "NVDA" });

    // profile + news + quote once each (3), not doubled — Yahoo not hit
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("falls back to Polygon news and prev quote without Finnhub", async () => {
    finnhubKey.mockReturnValue(null);
    polygonKey.mockReturnValue("poly-test");

    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/v2/reference/news")) {
          return Response.json({
            results: [
              {
                title: "NVDA rallies on AI demand",
                published_utc: "2026-07-20T15:00:00Z",
                article_url: "https://example.com/nvda",
                publisher: { name: "Benzinga" },
              },
            ],
          });
        }
        if (url.includes("/range/1/day/")) {
          return Response.json({
            results: [
              {
                o: 98,
                c: 100,
                h: 101,
                l: 97,
                t: 1_720_000_000_000,
              },
              {
                o: 100,
                c: 105,
                h: 106,
                l: 99,
                t: 1_720_086_400_000,
              },
            ],
          });
        }
        return new Response("not found", { status: 404 });
      },
    );

    const result = await fetchArticleEnrichment({ symbol: "NVDA" });
    expect(result.relatedHeadlines[0]?.title).toBe("NVDA rallies on AI demand");
    expect(result.quote?.provider).toBe("polygon");
    expect(result.quote?.changePercent).toBeCloseTo(5, 2);
  });
});
