import { describe, expect, it } from "vitest";

import { isValidCronSecret } from "./cron-secret";

describe("isValidCronSecret", () => {
  it("accepts a matching secret", () => {
    expect(isValidCronSecret("abc123", "abc123")).toBe(true);
  });

  it("rejects a mismatched secret", () => {
    expect(isValidCronSecret("abc123", "wrong")).toBe(false);
  });

  it("rejects when no header is provided", () => {
    expect(isValidCronSecret("abc123", null)).toBe(false);
  });

  it("rejects when CRON_SECRET is not configured", () => {
    expect(isValidCronSecret(undefined, "abc123")).toBe(false);
  });

  it("rejects secrets of different lengths", () => {
    expect(isValidCronSecret("abc123", "ab")).toBe(false);
  });
});
