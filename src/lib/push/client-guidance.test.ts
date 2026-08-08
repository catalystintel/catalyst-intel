import { describe, expect, it } from "vitest";

import {
  detectPushBrowser,
  detectPushPlatform,
  pushBrowserLabel,
  pushOsBlockedHint,
  pushSiteBlockedHint,
} from "./client-guidance";

describe("detectPushPlatform", () => {
  it("detects mac from platform / UA", () => {
    expect(
      detectPushPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X)", "MacIntel"),
    ).toBe("mac");
  });

  it("detects windows", () => {
    expect(
      detectPushPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Win32"),
    ).toBe("windows");
  });
});

describe("detectPushBrowser", () => {
  it("prefers Edge over Chrome substring", () => {
    expect(
      detectPushBrowser(
        "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      ),
    ).toBe("edge");
  });

  it("detects Chrome", () => {
    expect(
      detectPushBrowser("Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36"),
    ).toBe("chrome");
  });
});

describe("hints", () => {
  it("names Chrome in macOS blocked hint", () => {
    expect(pushOsBlockedHint("mac", "chrome")).toContain("Google Chrome");
    expect(pushOsBlockedHint("mac", "chrome")).toContain("System Settings");
  });

  it("labels browsers for site-block copy", () => {
    expect(pushBrowserLabel("chrome")).toBe("Google Chrome");
    expect(pushSiteBlockedHint("chrome")).toContain("lock icon");
  });
});
