import { afterEach, describe, expect, it } from "vitest";

import { mutableProcessEnv } from "@/lib/test/mutable-process-env";
import { getSignInStartHref, isDevAuthBypassEnabled } from "./dev-bypass";

describe("dev auth bypass sign-in href", () => {
  const env = mutableProcessEnv();
  const originalBypass = env.DEV_AUTH_BYPASS;
  const originalNodeEnv = env.NODE_ENV;

  afterEach(() => {
    if (originalBypass === undefined) {
      delete env.DEV_AUTH_BYPASS;
    } else {
      env.DEV_AUTH_BYPASS = originalBypass;
    }
    env.NODE_ENV = originalNodeEnv;
  });

  it("routes CTAs to /login when bypass is on outside production", () => {
    env.NODE_ENV = "development";
    env.DEV_AUTH_BYPASS = "true";
    expect(isDevAuthBypassEnabled()).toBe(true);
    expect(getSignInStartHref("/catalyst-feed")).toBe(
      "/login?next=%2Fcatalyst-feed",
    );
  });

  it("starts Google OAuth when bypass is off", () => {
    env.NODE_ENV = "development";
    env.DEV_AUTH_BYPASS = "false";
    expect(isDevAuthBypassEnabled()).toBe(false);
    expect(getSignInStartHref("/catalyst-feed")).toBe(
      "/auth/login?next=%2Fcatalyst-feed",
    );
  });

  it("never enables bypass in production even if the flag is set", () => {
    env.NODE_ENV = "production";
    env.DEV_AUTH_BYPASS = "true";
    expect(isDevAuthBypassEnabled()).toBe(false);
    expect(getSignInStartHref()).toBe("/auth/login?next=%2Fcatalyst-feed");
  });
});
