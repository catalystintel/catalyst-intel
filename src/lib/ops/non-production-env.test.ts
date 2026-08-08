import { describe, expect, it } from "vitest";

import { isDbResetAllowed, isNonProductionEnv } from "./non-production-env";

describe("isNonProductionEnv", () => {
  it("allows local (unset VERCEL_ENV)", () => {
    expect(isNonProductionEnv({})).toBe(true);
  });

  it("allows preview", () => {
    expect(isNonProductionEnv({ VERCEL_ENV: "preview" })).toBe(true);
  });

  it("blocks production", () => {
    expect(isNonProductionEnv({ VERCEL_ENV: "production" })).toBe(false);
  });
});

describe("isDbResetAllowed", () => {
  it("allows local without ALLOW_DB_RESET", () => {
    expect(isDbResetAllowed({})).toBe(true);
    expect(isDbResetAllowed({ ALLOW_DB_RESET: "false" })).toBe(true);
  });

  it("blocks production even with ALLOW_DB_RESET", () => {
    expect(
      isDbResetAllowed({
        VERCEL_ENV: "production",
        ALLOW_DB_RESET: "true",
      }),
    ).toBe(false);
  });

  it("allows preview only when explicitly enabled", () => {
    expect(isDbResetAllowed({ VERCEL_ENV: "preview" })).toBe(false);
    expect(
      isDbResetAllowed({ VERCEL_ENV: "preview", ALLOW_DB_RESET: "true" }),
    ).toBe(true);
  });
});
