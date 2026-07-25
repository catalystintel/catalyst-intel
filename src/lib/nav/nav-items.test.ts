import { describe, expect, it } from "vitest";

import { navKeyFromPathname } from "./nav-items";

describe("navKeyFromPathname", () => {
  it("maps desk routes to nav keys", () => {
    expect(navKeyFromPathname("/catalyst-feed")).toBe("live");
    expect(navKeyFromPathname("/catalyst-feed/catalyst/12")).toBe("live");
    expect(navKeyFromPathname("/analytics")).toBe("analytics");
    expect(navKeyFromPathname("/admin")).toBe("admin");
    expect(navKeyFromPathname("/alerts")).toBe("alerts");
    expect(navKeyFromPathname("/watchlist")).toBe("watchlist");
    expect(navKeyFromPathname("/profile")).toBe("profile");
  });

  it("defaults unknown paths to live", () => {
    expect(navKeyFromPathname(null)).toBe("live");
    expect(navKeyFromPathname("/about")).toBe("live");
  });
});
