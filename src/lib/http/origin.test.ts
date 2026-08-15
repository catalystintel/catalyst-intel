import { describe, expect, it } from "vitest";

import {
  getRequestOrigin,
  getTelegramWebhookOrigin,
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
  it("prefers NEXT_PUBLIC_AUTH_ORIGIN / APP_URL when host is a known auth host", () => {
    const request = new Request("https://ignored.example/auth/callback");
    expect(
      getTrustedAppOrigin(request, {
        NEXT_PUBLIC_APP_URL: "https://www.marveel.com",
      }),
    ).toBe("https://www.marveel.com");
  });

  it("ignores mistyped APP_URL like www.marvel.com", () => {
    const request = new Request("https://www.marveel.com/auth/callback");
    expect(
      getTrustedAppOrigin(request, {
        NEXT_PUBLIC_APP_URL: "https://www.marvel.com",
      }),
    ).toBe("https://www.marveel.com");
  });
});

describe("getTelegramWebhookOrigin", () => {
  it("uses the request host, not NEXT_PUBLIC_APP_URL", () => {
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://dead.example";
    try {
      const request = new Request(
        "https://catalyst-intel-rouge.vercel.app/api/admin/telegram/setup",
        {
          headers: {
            host: "catalyst-intel-rouge.vercel.app",
            "x-forwarded-proto": "https",
          },
        },
      );
      expect(getTelegramWebhookOrigin(request)).toBe(
        "https://catalyst-intel-rouge.vercel.app",
      );
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = previous;
    }
  });
});

describe("resolveOAuthRedirectOrigin", () => {
  it("rejects a mismatched forwarded host in favor of trusted origin", () => {
    const env = process.env as unknown as Record<string, string | undefined>;
    const previous = env.NEXT_PUBLIC_APP_URL;
    const previousNode = env.NODE_ENV;
    env.NEXT_PUBLIC_APP_URL = "https://www.marveel.com";
    env.NODE_ENV = "production";
    try {
      const request = new Request("https://www.marveel.com/auth/callback", {
        headers: { "x-forwarded-host": "evil.example" },
      });
      expect(resolveOAuthRedirectOrigin(request, env)).toBe(
        "https://www.marveel.com",
      );
    } finally {
      if (previous === undefined) delete env.NEXT_PUBLIC_APP_URL;
      else env.NEXT_PUBLIC_APP_URL = previous;
      env.NODE_ENV = previousNode;
    }
  });

  it("keeps www.marveel.com even when APP_URL is mistyped as marvel.com", () => {
    const env: Record<string, string | undefined> = {
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://www.marvel.com",
    };
    const request = new Request("https://www.marveel.com/auth/callback", {
      headers: { "x-forwarded-host": "www.marveel.com" },
    });
    expect(resolveOAuthRedirectOrigin(request, env)).toBe(
      "https://www.marveel.com",
    );
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
