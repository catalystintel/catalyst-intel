import { describe, expect, it } from "vitest";

import { shouldForwardOAuthCodeToCallback } from "./oauth-callback-path";

describe("shouldForwardOAuthCodeToCallback", () => {
  it("forwards a PKCE code stranded on the homepage", () => {
    expect(
      shouldForwardOAuthCodeToCallback(
        "/",
        new URLSearchParams("code=abc-123"),
      ),
    ).toBe(true);
  });

  it("forwards a code stranded on /login", () => {
    expect(
      shouldForwardOAuthCodeToCallback(
        "/login",
        new URLSearchParams("code=abc-123&next=%2Fcatalyst-feed"),
      ),
    ).toBe(true);
  });

  it("does not forward when already on the callback route", () => {
    expect(
      shouldForwardOAuthCodeToCallback(
        "/auth/callback",
        new URLSearchParams("code=abc-123"),
      ),
    ).toBe(false);
  });

  it("ignores API routes and pages without a code", () => {
    expect(
      shouldForwardOAuthCodeToCallback(
        "/api/health",
        new URLSearchParams("code=abc-123"),
      ),
    ).toBe(false);
    expect(
      shouldForwardOAuthCodeToCallback("/", new URLSearchParams("preview=1")),
    ).toBe(false);
  });
});
