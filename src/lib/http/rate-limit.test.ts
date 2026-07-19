import { describe, expect, it, beforeEach } from "vitest";

import { checkRateLimit, resetRateLimitStore } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("allows requests under the limit", () => {
    const first = checkRateLimit({
      key: "t:a",
      limit: 3,
      windowMs: 60_000,
      now: 1_000,
    });
    expect(first.ok).toBe(true);
    expect(first.remaining).toBe(2);

    const second = checkRateLimit({
      key: "t:a",
      limit: 3,
      windowMs: 60_000,
      now: 1_100,
    });
    expect(second.ok).toBe(true);
    expect(second.remaining).toBe(1);
  });

  it("blocks when the limit is exceeded", () => {
    const now = 5_000;
    for (let i = 0; i < 3; i++) {
      expect(
        checkRateLimit({ key: "t:b", limit: 3, windowMs: 60_000, now }).ok,
      ).toBe(true);
    }
    const blocked = checkRateLimit({
      key: "t:b",
      limit: 3,
      windowMs: 60_000,
      now: now + 10,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after the window elapses", () => {
    const windowMs = 1_000;
    checkRateLimit({ key: "t:c", limit: 1, windowMs, now: 0 });
    expect(
      checkRateLimit({ key: "t:c", limit: 1, windowMs, now: 500 }).ok,
    ).toBe(false);
    expect(
      checkRateLimit({ key: "t:c", limit: 1, windowMs, now: 1_000 }).ok,
    ).toBe(true);
  });

  it("isolates keys from each other", () => {
    checkRateLimit({ key: "t:d1", limit: 1, windowMs: 60_000, now: 0 });
    expect(
      checkRateLimit({ key: "t:d2", limit: 1, windowMs: 60_000, now: 0 }).ok,
    ).toBe(true);
  });
});
