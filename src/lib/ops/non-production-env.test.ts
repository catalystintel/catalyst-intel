import { describe, expect, it } from "vitest";

import {
  DB_RESET_CONFIRM_PHRASE,
  isDbResetAllowed,
  isNonProductionEnv,
} from "./non-production-env";

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
  it("allows every environment (admin + confirm phrase gate the wipe)", () => {
    expect(isDbResetAllowed({})).toBe(true);
    expect(isDbResetAllowed({ VERCEL_ENV: "preview" })).toBe(true);
    expect(isDbResetAllowed({ VERCEL_ENV: "production" })).toBe(true);
  });
});

describe("DB_RESET_CONFIRM_PHRASE", () => {
  it("is the exact type-to-confirm token", () => {
    expect(DB_RESET_CONFIRM_PHRASE).toBe("delete");
  });
});
