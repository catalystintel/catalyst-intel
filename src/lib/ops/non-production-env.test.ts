import { describe, expect, it } from "vitest";

import { isNonProductionEnv } from "./non-production-env";

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
