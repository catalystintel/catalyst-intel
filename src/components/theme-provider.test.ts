import { describe, expect, it } from "vitest";

import { isPreloginPath } from "@/components/theme-provider";

describe("isPreloginPath", () => {
  it("treats marketing and login routes as prelogin", () => {
    expect(isPreloginPath("/")).toBe(true);
    expect(isPreloginPath("/about")).toBe(true);
    expect(isPreloginPath("/about/team")).toBe(true);
    expect(isPreloginPath("/login")).toBe(true);
    expect(isPreloginPath("/login/")).toBe(true);
  });

  it("leaves the authenticated desk on the user theme", () => {
    expect(isPreloginPath("/catalyst-feed")).toBe(false);
    expect(isPreloginPath("/profile")).toBe(false);
    expect(isPreloginPath("/admin")).toBe(false);
    expect(isPreloginPath(null)).toBe(false);
  });
});
