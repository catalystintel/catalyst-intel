import { describe, expect, it, vi } from "vitest";

import { withTimeBudget } from "./with-time-budget";

describe("withTimeBudget", () => {
  it("returns the promise value when it resolves in time", async () => {
    await expect(
      withTimeBudget(Promise.resolve("ok"), "fallback", 50),
    ).resolves.toBe("ok");
  });

  it("returns the fallback when the promise rejects", async () => {
    await expect(
      withTimeBudget(Promise.reject(new Error("boom")), "fallback", 50),
    ).resolves.toBe("fallback");
  });

  it("returns the fallback when the promise exceeds the budget", async () => {
    vi.useFakeTimers();
    const slow = new Promise<string>((resolve) => {
      setTimeout(() => resolve("late"), 100);
    });
    const raced = withTimeBudget(slow, "fallback", 20);
    await vi.advanceTimersByTimeAsync(20);
    await expect(raced).resolves.toBe("fallback");
    vi.useRealTimers();
  });
});
