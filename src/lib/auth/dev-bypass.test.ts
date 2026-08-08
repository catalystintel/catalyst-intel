import { afterEach, describe, expect, it } from "vitest";

import { getSignInStartHref, isDevAuthBypassEnabled } from "./dev-bypass";

describe("dev auth bypass sign-in href", () => {
  const originalBypass = process.env.DEV_AUTH_BYPASS;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalBypass === undefined) {
      delete process.env.DEV_AUTH_BYPASS;
    } else {
      process.env.DEV_AUTH_BYPASS = originalBypass;
    }
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("routes CTAs to /login when bypass is on outside production", () => {
    process.env.NODE_ENV = "development";
    process.env.DEV_AUTH_BYPASS = "true";
    expect(isDevAuthBypassEnabled()).toBe(true);
    expect(getSignInStartHref("/catalyst-feed")).toBe(
      "/login?next=%2Fcatalyst-feed",
    );
  });

  it("starts Google OAuth when bypass is off", () => {
    process.env.NODE_ENV = "development";
    process.env.DEV_AUTH_BYPASS = "false";
    expect(isDevAuthBypassEnabled()).toBe(false);
    expect(getSignInStartHref("/catalyst-feed")).toBe(
      "/auth/login?next=%2Fcatalyst-feed",
    );
  });

  it("never enables bypass in production even if the flag is set", () => {
    process.env.NODE_ENV = "production";
    process.env.DEV_AUTH_BYPASS = "true";
    expect(isDevAuthBypassEnabled()).toBe(false);
    expect(getSignInStartHref()).toBe("/auth/login?next=%2Fcatalyst-feed");
  });
});
