import { afterEach, describe, expect, it } from "vitest";

import {
  canAccessPreviewDeployment,
  isPreviewAccessExemptPath,
  isPreviewDeployment,
} from "./preview-access";

describe("isPreviewDeployment", () => {
  it("is true only when VERCEL_ENV=preview", () => {
    expect(isPreviewDeployment({})).toBe(false);
    expect(isPreviewDeployment({ VERCEL_ENV: "development" })).toBe(false);
    expect(isPreviewDeployment({ VERCEL_ENV: "production" })).toBe(false);
    expect(isPreviewDeployment({ VERCEL_ENV: "preview" })).toBe(true);
  });
});

describe("isPreviewAccessExemptPath", () => {
  it("allows auth, health, admin APIs, and telegram webhook", () => {
    expect(isPreviewAccessExemptPath("/login")).toBe(true);
    expect(isPreviewAccessExemptPath("/auth/callback")).toBe(true);
    expect(isPreviewAccessExemptPath("/auth/login")).toBe(true);
    expect(isPreviewAccessExemptPath("/api/health")).toBe(true);
    expect(isPreviewAccessExemptPath("/api/admin/fetch/all")).toBe(true);
    expect(isPreviewAccessExemptPath("/api/telegram/webhook")).toBe(true);
  });

  it("does not exempt desk or share surfaces", () => {
    expect(isPreviewAccessExemptPath("/")).toBe(false);
    expect(isPreviewAccessExemptPath("/catalyst-feed")).toBe(false);
    expect(isPreviewAccessExemptPath("/reports/s/abc")).toBe(false);
    expect(isPreviewAccessExemptPath("/api/reports/share/abc")).toBe(false);
    expect(isPreviewAccessExemptPath("/api/guest/search")).toBe(false);
  });
});

describe("canAccessPreviewDeployment", () => {
  const original = process.env.ADMIN_EMAILS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ADMIN_EMAILS;
    } else {
      process.env.ADMIN_EMAILS = original;
    }
  });

  it("allows allowlisted admins only", () => {
    process.env.ADMIN_EMAILS = "ops@example.com";
    expect(canAccessPreviewDeployment("ops@example.com")).toBe(true);
    expect(canAccessPreviewDeployment("OPS@example.com")).toBe(true);
    expect(canAccessPreviewDeployment("stranger@example.com")).toBe(false);
    expect(canAccessPreviewDeployment(null)).toBe(false);
  });
});
