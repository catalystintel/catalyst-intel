import { describe, expect, it } from "vitest";

import { getPrimaryNav, navKeyFromPathname } from "./nav-items";

describe("getPrimaryNav", () => {
  it("omits settings and admin for non-admins", () => {
    const keys = getPrimaryNav(false).map((item) => item.key);
    expect(keys).not.toContain("profile");
    expect(keys).not.toContain("admin");
    expect(keys).toEqual([
      "live",
      "news",
      "alerts",
      "watchlist",
      "reports",
      "analytics",
    ]);
  });

  it("appends admin-only System entry for admins", () => {
    const items = getPrimaryNav(true);
    const keys = items.map((item) => item.key);
    expect(keys).not.toContain("profile");
    expect(keys.at(-1)).toBe("admin");
    expect(items.find((item) => item.key === "admin")?.adminOnly).toBe(true);
  });
});

describe("navKeyFromPathname", () => {
  it("maps desk routes to nav keys", () => {
    expect(navKeyFromPathname("/catalyst-feed")).toBe("live");
    expect(navKeyFromPathname("/catalyst-feed/catalyst/12")).toBe("live");
    expect(navKeyFromPathname("/news-feed")).toBe("news");
    expect(navKeyFromPathname("/analytics")).toBe("analytics");
    expect(navKeyFromPathname("/admin")).toBe("admin");
    expect(navKeyFromPathname("/alerts")).toBe("alerts");
    expect(navKeyFromPathname("/watchlist")).toBe("watchlist");
    expect(navKeyFromPathname("/reports")).toBe("reports");
    expect(navKeyFromPathname("/reports/s/abc123")).toBe("reports");
    expect(navKeyFromPathname("/profile")).toBe("profile");
  });

  it("defaults unknown paths to live", () => {
    expect(navKeyFromPathname(null)).toBe("live");
    expect(navKeyFromPathname("/about")).toBe("live");
  });
});
