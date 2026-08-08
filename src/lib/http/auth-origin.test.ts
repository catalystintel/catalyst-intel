import { describe, expect, it } from "vitest";

import {
  DEFAULT_PRODUCTION_AUTH_ORIGIN,
  authHostBounceUrl,
  getAllowedAuthHosts,
  getPreferredAuthOrigin,
  isAllowedAuthOrigin,
} from "./auth-origin";

describe("getAllowedAuthHosts", () => {
  it("includes known production and staging hosts", () => {
    const hosts = getAllowedAuthHosts({});
    expect(hosts.has("catalyst-intel-catalyst-intel.vercel.app")).toBe(true);
    expect(
      hosts.has("catalyst-intel-git-dev-zhbar10s-projects.vercel.app"),
    ).toBe(true);
  });

  it("adds NEXT_PUBLIC_APP_URL and production VERCEL_URL", () => {
    const hosts = getAllowedAuthHosts({
      NEXT_PUBLIC_APP_URL: "https://custom.example",
      VERCEL_ENV: "production",
      VERCEL_URL: "prod-deploy.vercel.app",
    });
    expect(hosts.has("custom.example")).toBe(true);
    expect(hosts.has("prod-deploy.vercel.app")).toBe(true);
  });

  it("does not treat preview VERCEL_URL as auth-safe by default", () => {
    const hosts = getAllowedAuthHosts({
      VERCEL_ENV: "preview",
      VERCEL_URL: "catalyst-intel-rouge.vercel.app",
    });
    expect(hosts.has("catalyst-intel-rouge.vercel.app")).toBe(false);
  });
});

describe("isAllowedAuthOrigin", () => {
  it("allows localhost and known hosts", () => {
    expect(isAllowedAuthOrigin("http://localhost:3000", {})).toBe(true);
    expect(
      isAllowedAuthOrigin(
        "https://catalyst-intel-catalyst-intel.vercel.app",
        {},
      ),
    ).toBe(true);
  });

  it("rejects ephemeral preview hosts", () => {
    expect(
      isAllowedAuthOrigin("https://catalyst-intel-rouge.vercel.app", {
        VERCEL_ENV: "preview",
        VERCEL_URL: "catalyst-intel-rouge.vercel.app",
      }),
    ).toBe(false);
  });
});

describe("authHostBounceUrl", () => {
  it("returns null on safe hosts", () => {
    expect(
      authHostBounceUrl(
        "https://catalyst-intel-catalyst-intel.vercel.app/login",
      ),
    ).toBeNull();
    expect(authHostBounceUrl("http://localhost:3000/login")).toBeNull();
  });

  it("bounces ephemeral preview login to production", () => {
    const bounced = authHostBounceUrl(
      "https://catalyst-intel-rouge.vercel.app/login?next=%2Fadmin",
      {},
    );
    expect(bounced).toBe(
      `${DEFAULT_PRODUCTION_AUTH_ORIGIN}/login?next=%2Fadmin&message=use_production_login`,
    );
  });

  it("prefers NEXT_PUBLIC_AUTH_ORIGIN when bouncing", () => {
    const bounced = authHostBounceUrl(
      "https://catalyst-intel-rouge.vercel.app/auth/login",
      { NEXT_PUBLIC_AUTH_ORIGIN: "https://app.example" },
    );
    expect(bounced).toBe(
      "https://app.example/login?message=use_production_login",
    );
  });
});

describe("getPreferredAuthOrigin", () => {
  it("falls back to the known production origin", () => {
    expect(getPreferredAuthOrigin({})).toBe(DEFAULT_PRODUCTION_AUTH_ORIGIN);
  });
});
