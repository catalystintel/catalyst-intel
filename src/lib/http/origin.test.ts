import { describe, expect, it } from "vitest";

import {
  getRequestOrigin,
  getTrustedAppOrigin,
  resolveOAuthRedirectOrigin,
  safeNextPath,
} from "./origin";

describe("getRequestOrigin", () => {
  it("prefers x-forwarded-host over Origin (mobile / proxy safe)", () => {
    const headers = new Headers({
      origin: "http://localhost:3000",
      "x-forwarded-host": "catalyst-intel.vercel.app",
      "x-forwarded-proto": "https",
    });
    expect(getRequestOrigin(headers)).toBe("https://catalyst-intel.vercel.app");
  });

  it("uses http for localhost when Origin is missing", () => {
    const headers = new Headers({ host: "localhost:3000" });
    expect(getRequestOrigin(headers)).toBe("http://localhost:3000");
  });

  it("uses https for non-local hosts when Origin is missing", () => {
    const headers = new Headers({ host: "catalyst-intel.vercel.app" });
    expect(getRequestOrigin(headers)).toBe("https://catalyst-intel.vercel.app");
  });

  it("falls back to Origin when no host headers exist", () => {
    const headers = new Headers({ origin: "http://localhost:3000" });
    expect(getRequestOrigin(headers)).toBe("http://localhost:3000");
  });
});

describe("getTrustedAppOrigin", () => {
  it("prefers NEXT_PUBLIC_APP_URL", () => {
    const request = new Request("https://ignored.example/auth/callback");
    expect(
      getTrustedAppOrigin(request, {
        NEXT_PUBLIC_APP_URL: "https://app.example",
      }),
    ).toBe("https://app.example");
  });
});

describe("resolveOAuthRedirectOrigin", () => {
  it("rejects a mismatched forwarded host in favor of trusted origin", () => {
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    const previousNode = process.env.NODE_ENV;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example";
    process.env.NODE_ENV = "production";
    try {
      const request = new Request("https://app.example/auth/callback", {
        headers: { "x-forwarded-host": "evil.example" },
      });
      expect(resolveOAuthRedirectOrigin(request)).toBe("https://app.example");
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = previous;
      process.env.NODE_ENV = previousNode;
    }
  });
});

describe("safeNextPath", () => {
  it("allows relative app paths", () => {
    expect(safeNextPath("/catalyst-feed")).toBe("/catalyst-feed");
  });

  it("rejects open redirects", () => {
    expect(safeNextPath("https://evil.example")).toBe("/catalyst-feed");
    expect(safeNextPath("//evil.example")).toBe("/catalyst-feed");
  });

  it("rewrites legacy /dashboard next paths to /catalyst-feed", () => {
    expect(safeNextPath("/dashboard")).toBe("/catalyst-feed");
    expect(safeNextPath("/dashboard/catalyst/12")).toBe(
      "/catalyst-feed/catalyst/12",
    );
  });
});
