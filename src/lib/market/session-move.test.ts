import { describe, expect, it } from "vitest";

import {
  MAX_PLAUSIBLE_SESSION_PCT,
  reconcileSessionMove,
  sessionMoveFromPreviousClose,
} from "./session-move";

describe("sessionMoveFromPreviousClose", () => {
  it("computes a normal session move", () => {
    expect(sessionMoveFromPreviousClose(4.63, 4.65)).toEqual({
      change: -0.02,
      changePercent: -0.43,
    });
  });

  it("nulls absurd hundreds-of-percent moves", () => {
    expect(sessionMoveFromPreviousClose(4.63, 0.05).changePercent).toBeNull();
    expect(MAX_PLAUSIBLE_SESSION_PCT).toBe(200);
  });
});

describe("reconcileSessionMove", () => {
  it("prefers previous-close math over a lying vendor dp", () => {
    expect(
      reconcileSessionMove({
        price: 10,
        previousClose: 9.5,
        vendorChangePercent: 900,
        vendorChange: 85,
      }),
    ).toEqual({
      change: 0.5,
      changePercent: 5.263,
    });
  });

  it("drops vendor % when previous close is unusable and dp is absurd", () => {
    expect(
      reconcileSessionMove({
        price: 10,
        previousClose: null,
        open: 9.8,
        vendorChangePercent: 850,
        vendorChange: 85,
      }),
    ).toEqual({ change: null, changePercent: null });
  });
});
