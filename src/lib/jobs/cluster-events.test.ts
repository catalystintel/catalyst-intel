import { describe, expect, it } from "vitest";

import { groupIntoWindows } from "./cluster-events";

describe("groupIntoWindows", () => {
  it("merges same-ticker events within the window", () => {
    const groups = groupIntoWindows(
      [
        {
          id: 1,
          ticker: "ACME",
          timestamp: "2026-07-20T13:00:00.000Z",
          impactScore: 60,
          eventCategory: "trading_halt",
        },
        {
          id: 2,
          ticker: "ACME",
          timestamp: "2026-07-20T13:10:00.000Z",
          impactScore: 90,
          eventCategory: "disclosure",
        },
      ],
      45,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      ticker: "ACME",
      memberIds: [1, 2],
      primaryId: 2,
      category: "disclosure",
    });
  });

  it("does not merge events outside the window", () => {
    const groups = groupIntoWindows(
      [
        {
          id: 1,
          ticker: "ACME",
          timestamp: "2026-07-20T13:00:00.000Z",
          impactScore: 60,
          eventCategory: "trading_halt",
        },
        {
          id: 2,
          ticker: "ACME",
          timestamp: "2026-07-20T14:00:00.000Z",
          impactScore: 90,
          eventCategory: "disclosure",
        },
      ],
      45,
    );

    expect(groups).toHaveLength(0);
  });

  it("does not merge across different tickers", () => {
    const groups = groupIntoWindows(
      [
        {
          id: 1,
          ticker: "ACME",
          timestamp: "2026-07-20T13:00:00.000Z",
          impactScore: 60,
          eventCategory: "trading_halt",
        },
        {
          id: 2,
          ticker: "OTHR",
          timestamp: "2026-07-20T13:05:00.000Z",
          impactScore: 90,
          eventCategory: "disclosure",
        },
      ],
      45,
    );

    expect(groups).toHaveLength(0);
  });

  it("chains sequential windows from the first member of each new window", () => {
    // 0min, 40min, 80min with a 45min window: (0,40) merge; 80 starts fresh
    // relative to 40 (40min gap <= 45) so it should still merge all three.
    const groups = groupIntoWindows(
      [
        {
          id: 1,
          ticker: "ACME",
          timestamp: "2026-07-20T13:00:00.000Z",
          impactScore: 50,
          eventCategory: "news",
        },
        {
          id: 2,
          ticker: "ACME",
          timestamp: "2026-07-20T13:40:00.000Z",
          impactScore: 50,
          eventCategory: "news",
        },
        {
          id: 3,
          ticker: "ACME",
          timestamp: "2026-07-20T14:20:00.000Z",
          impactScore: 95,
          eventCategory: "distress",
        },
      ],
      45,
    );

    // Window starts at 13:00; 14:20 is 80min later (> 45min from window
    // start), so it starts a new window and only merges with itself (dropped).
    expect(groups).toHaveLength(1);
    expect(groups[0].memberIds).toEqual([1, 2]);
  });

  it("picks the highest-impact member as primary, breaking ties toward the first", () => {
    const groups = groupIntoWindows(
      [
        {
          id: 1,
          ticker: "ACME",
          timestamp: "2026-07-20T13:00:00.000Z",
          impactScore: 70,
          eventCategory: "news",
        },
        {
          id: 2,
          ticker: "ACME",
          timestamp: "2026-07-20T13:05:00.000Z",
          impactScore: 70,
          eventCategory: "news",
        },
      ],
      45,
    );

    expect(groups[0].primaryId).toBe(1);
  });

  it("prefers SEC over Polygon when impact ties", () => {
    const groups = groupIntoWindows(
      [
        {
          id: 1,
          ticker: "ACME",
          timestamp: "2026-07-20T13:00:00.000Z",
          impactScore: 70,
          eventCategory: "deals",
          provider: "polygon",
          title: "Acme announces material agreement",
        },
        {
          id: 2,
          ticker: "ACME",
          timestamp: "2026-07-20T13:05:00.000Z",
          impactScore: 70,
          eventCategory: "deals",
          provider: "sec-edgar",
          title: "Material Agreement - Acme",
        },
      ],
      45,
    );

    expect(groups[0].primaryId).toBe(2);
  });

  it("does not merge unrelated Form 4 and earnings on the same ticker", () => {
    const groups = groupIntoWindows(
      [
        {
          id: 1,
          ticker: "ACME",
          timestamp: "2026-07-20T13:00:00.000Z",
          impactScore: 70,
          eventCategory: "earnings",
          title: "Earnings Report Q2 - Acme",
        },
        {
          id: 2,
          ticker: "ACME",
          timestamp: "2026-07-20T13:10:00.000Z",
          impactScore: 55,
          eventCategory: "insider",
          title: "Form 4 Insider Buy - Acme",
        },
      ],
      45,
    );

    expect(groups).toHaveLength(0);
  });
});
