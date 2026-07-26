import { describe, expect, it, vi } from "vitest";

import { withDbRetry } from "./with-db-retry";

describe("withDbRetry", () => {
  it("returns the result on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withDbRetry(fn, { delayMs: 0 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries once on a transient connection error, then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("ConnectionFailed: fetch failed"))
      .mockResolvedValueOnce("ok");
    await expect(withDbRetry(fn, { delayMs: 0 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("rethrows immediately for a non-transient error, without retrying", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("no such table: users"));
    await expect(withDbRetry(fn, { delayMs: 0 })).rejects.toThrow(
      "no such table: users",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry Turso BLOCKED quota errors and normalizes the message", async () => {
    const fn = vi.fn().mockRejectedValue(
      new Error("Failed query: select 1", {
        cause: new Error(
          "BLOCKED: Operation was blocked: SQL read operations are forbidden (reads are blocked, do you need to upgrade your plan?)",
        ),
      }),
    );
    await expect(withDbRetry(fn, { attempts: 3, delayMs: 0 })).rejects.toThrow(
      /quota exceeded \(BLOCKED\)/i,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up and rethrows after exhausting all attempts", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(new Error("ETIMEDOUT: connection timed out"));
    await expect(withDbRetry(fn, { attempts: 3, delayMs: 0 })).rejects.toThrow(
      "ETIMEDOUT",
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
