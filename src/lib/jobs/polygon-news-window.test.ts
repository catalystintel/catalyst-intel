import { describe, expect, it } from "vitest";

import {
  resolvePolygonNewsWindow,
  type PolygonNewsWindowInput,
} from "./polygon-news-window";

describe("resolvePolygonNewsWindow", () => {
  const now = new Date("2026-07-24T12:10:00.000Z");

  it("uses default lookback when no watermark exists", () => {
    const w = resolvePolygonNewsWindow({ state: null, now });
    expect(w.sinceIso).toBe("2026-07-24T11:50:00.000Z");
    expect(w.limit).toBe(100);
    expect(w.catchingUp).toBe(true);
  });

  it("widens limit after rate_limited without moving since past watermark", () => {
    const state: PolygonNewsWindowInput["state"] = {
      lastFetchedAt: "2026-07-24T12:00:00.000Z",
      lastStatus: "rate_limited",
    };
    const w = resolvePolygonNewsWindow({ state, now });
    // Overlap: watermark - 90s
    expect(w.sinceIso).toBe("2026-07-24T11:58:30.000Z");
    expect(w.limit).toBe(100);
    expect(w.catchingUp).toBe(true);
  });

  it("catch-up when gap since last success exceeds threshold", () => {
    const state: PolygonNewsWindowInput["state"] = {
      lastFetchedAt: "2026-07-24T12:00:00.000Z",
      lastStatus: "ok",
    };
    // 10 min gap
    const later = new Date("2026-07-24T12:10:00.000Z");
    const w = resolvePolygonNewsWindow({ state, now: later });
    expect(w.catchingUp).toBe(true);
    expect(w.limit).toBe(100);
  });

  it("caps lookback at max window", () => {
    const state: PolygonNewsWindowInput["state"] = {
      lastFetchedAt: "2026-07-01T00:00:00.000Z",
      lastStatus: "rate_limited",
    };
    const w = resolvePolygonNewsWindow({ state, now });
    expect(w.sinceIso).toBe("2026-07-24T06:10:00.000Z"); // now - 6h
    expect(w.catchingUp).toBe(true);
  });
});
